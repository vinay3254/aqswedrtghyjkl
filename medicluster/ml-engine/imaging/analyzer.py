"""imaging/analyzer.py — Multi-model chest X-ray / CT scan / DICOM analysis."""

import io
import numpy as np
import torch
import torchxrayvision as xrv
from PIL import Image

from clinical_knowledge import get_clinical_info

# PyTorch 2.6+ changed weights_only default to True which blocks torchxrayvision.
_orig_load = torch.load
def _patched_load(*args, **kwargs):
    kwargs.setdefault("weights_only", False)
    return _orig_load(*args, **kwargs)
torch.load = _patched_load

# ── Model registry ────────────────────────────────────────────────────────────

XRV_MODELS = {
    "densenet121-res224-chex": {
        "label": "CheXNet · CheXpert (recommended)",
        "desc":  "Best calibrated — trained on Stanford CheXpert (224k expert-labeled chest X-rays)",
        "loader": lambda: xrv.models.DenseNet(weights="densenet121-res224-chex"),
        "size":  224,
    },
    "densenet121-res224-all": {
        "label": "DenseNet121 · All datasets",
        "desc":  "General purpose — trained on CheXpert + NIH + MIMIC + PadChest",
        "loader": lambda: xrv.models.DenseNet(weights="densenet121-res224-all"),
        "size":  224,
    },
    "resnet50-res512-all": {
        "label": "ResNet50 · High-res (512px)",
        "desc":  "Higher resolution input — more detail, same dataset coverage",
        "loader": lambda: xrv.models.ResNet(weights="resnet50-res512-all"),
        "size":  512,
    },
    "densenet121-res224-nih": {
        "label": "DenseNet121 · NIH ChestX-ray14",
        "desc":  "Trained on NIH ChestX-ray14 — most widely validated benchmark",
        "loader": lambda: xrv.models.DenseNet(weights="densenet121-res224-nih"),
        "size":  224,
    },
    "densenet121-res224-pc": {
        "label": "DenseNet121 · PadChest",
        "desc":  "Trained on PadChest — detects the widest range of pathologies",
        "loader": lambda: xrv.models.DenseNet(weights="densenet121-res224-pc"),
        "size":  224,
    },
}

DEFAULT_MODEL = "densenet121-res224-chex"
_cache: dict = {}

CONFIDENCE_THRESHOLD = 0.15


def _is_medical_scan(arr: np.ndarray) -> str | None:
    """
    Returns a warning string if the image is probably not a medical scan,
    or None if it looks like one.
    Checks: near-grayscale colour channels and minimum size.
    """
    if arr.shape[0] < 128 or arr.shape[1] < 128:
        return "Image may not be a medical scan — resolution too low (min 128×128 px)"

    if arr.ndim == 3 and arr.shape[2] == 3:
        rg_diff = float(np.mean(np.abs(arr[:, :, 0].astype(float) - arr[:, :, 1].astype(float))))
        gb_diff = float(np.mean(np.abs(arr[:, :, 1].astype(float) - arr[:, :, 2].astype(float))))
        if rg_diff > 15 or gb_diff > 15:
            return "Image may not be a medical scan — results may be unreliable"

    return None


def _attach_clinical_info(findings: list[dict], threshold: float = CONFIDENCE_THRESHOLD) -> list[dict]:
    """
    Filter findings below threshold, attach clinical info, sort by confidence desc.
    """
    filtered = [f for f in findings if f.get("confidence", 0) >= threshold]
    filtered.sort(key=lambda f: f["confidence"], reverse=True)
    for f in filtered:
        info = get_clinical_info(f["label"])
        f["cause"]        = info["cause"]
        f["medications"]  = info["medications"]
        f["prevention"]   = info["prevention"]
        f["severity"]     = info["severity"]
    return filtered


def list_models() -> list:
    return [
        {"id": k, "label": v["label"], "desc": v["desc"], "size": v["size"]}
        for k, v in XRV_MODELS.items()
    ]


def _get_model(model_name: str):
    if model_name not in XRV_MODELS:
        raise ValueError(f"Unknown model: {model_name}")
    if model_name not in _cache:
        m = XRV_MODELS[model_name]["loader"]()
        m.eval()
        _cache[model_name] = m
    return _cache[model_name]


# ── Preprocessing ─────────────────────────────────────────────────────────────

def _load_pixels(image_bytes: bytes, filename: str = "") -> tuple[np.ndarray, bool]:
    """
    Returns (arr, is_dicom).
    - Regular images: float32 [0, 255] grayscale.
    - DICOM: float32 Hounsfield units (may be negative).
    """
    ext = filename.lower()
    if ext.endswith(".dcm") or ext.endswith(".dicom"):
        import pydicom
        ds = pydicom.dcmread(io.BytesIO(image_bytes))
        arr = ds.pixel_array.astype(np.float32)
        slope    = float(getattr(ds, "RescaleSlope",     1.0))
        intercept = float(getattr(ds, "RescaleIntercept", 0.0))
        return arr * slope + intercept, True

    img = Image.open(io.BytesIO(image_bytes)).convert("L")
    return np.array(img, dtype=np.float32), False


def _apply_clahe(arr: np.ndarray) -> np.ndarray:
    """CLAHE contrast enhancement — bridges gap between stock images and DICOM."""
    import cv2
    uint8 = np.clip(arr, 0, 255).astype(np.uint8)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(uint8).astype(np.float32)


def _preprocess(arr: np.ndarray, size: int, is_dicom: bool) -> torch.Tensor:
    """
    Use torchxrayvision's own normaliser and transforms — exactly matching
    the preprocessing used during training.
    """
    if not is_dicom:
        arr = _apply_clahe(arr)

    # xrv.datasets.normalize: float32 path → maps input to [-1024, 1024]
    arr = xrv.datasets.normalize(arr, 255)

    # Add channel dim → (1, H, W)
    if arr.ndim == 2:
        arr = arr[None, ...]

    # torchxrayvision's own center-crop + resizer (same as training pipeline)
    import torchvision.transforms as T
    transform = T.Compose([
        xrv.datasets.XRayCenterCrop(),
        xrv.datasets.XRayResizer(size),
    ])
    arr = transform(arr)

    return torch.from_numpy(arr).unsqueeze(0)  # (1, 1, H, W)


# ── Main entry ────────────────────────────────────────────────────────────────

def analyze_image(
    image_bytes: bytes,
    model_name: str = DEFAULT_MODEL,
    filename: str = "",
) -> dict:
    cfg = XRV_MODELS.get(model_name)
    if cfg is None:
        raise ValueError(f"Unknown model: {model_name}")

    arr, is_dicom = _load_pixels(image_bytes, filename)

    # Validate image looks like a medical scan
    scan_warning = None
    if not is_dicom:
        rgb_arr = np.stack([arr, arr, arr], axis=-1) if arr.ndim == 2 else arr
        if rgb_arr.dtype != np.uint8:
            rgb_arr = np.clip(rgb_arr, 0, 255).astype(np.uint8)
        scan_warning = _is_medical_scan(rgb_arr)

    model  = _get_model(model_name)
    tensor = _preprocess(arr, cfg["size"], is_dicom)

    with torch.no_grad():
        output = model(tensor)

    probs = torch.sigmoid(output).squeeze().cpu().numpy()

    raw_findings = [
        {"label": label, "confidence": round(float(prob), 4)}
        for label, prob in zip(model.pathologies, probs)
        if label
    ]

    findings = _attach_clinical_info(raw_findings, threshold=CONFIDENCE_THRESHOLD)

    result = {
        "findings":    findings,
        "model":       model_name,
        "model_label": cfg["label"],
    }
    if scan_warning:
        result["scan_warning"] = scan_warning

    return result
