"""imaging/analyzer.py — Chest X-ray / CT scan analysis using torchxrayvision."""

import io
import numpy as np
import torch
import torchxrayvision as xrv
from PIL import Image

_model = None


def _get_model():
    global _model
    if _model is None:
        # DenseNet121 trained on CheXpert + NIH + MIMIC + PadChest datasets
        # Downloads ~85 MB on first call; cached in ~/.torchxrayvision/models/
        _model = xrv.models.DenseNet(weights="densenet121-res224-all")
        _model.eval()
    return _model


def analyze_image(image_bytes: bytes) -> dict:
    """
    Analyze a chest X-ray or CT scan image and return pathology findings.

    Parameters
    ----------
    image_bytes : raw image bytes (JPEG / PNG / GIF / WebP)

    Returns
    -------
    dict with keys:
        findings : list of {label, confidence} sorted by confidence desc
        model    : model identifier string
    """
    # Load as grayscale (X-ray / CT are single-channel)
    img = Image.open(io.BytesIO(image_bytes)).convert("L")

    # Center-crop to square, then resize to 224×224
    w, h = img.size
    min_dim = min(w, h)
    left = (w - min_dim) // 2
    top = (h - min_dim) // 2
    img = img.crop((left, top, left + min_dim, top + min_dim))
    img = img.resize((224, 224), Image.LANCZOS)

    img_array = np.array(img).astype(np.float32)

    # torchxrayvision expects pixel values in [-1024, 1024] (Hounsfield scale)
    img_array = (img_array / 255.0) * 2048.0 - 1024.0

    # Shape: (1, 1, 224, 224) — batch × channel × H × W
    img_tensor = torch.from_numpy(img_array[None, None])

    model = _get_model()
    with torch.no_grad():
        output = model(img_tensor)

    probs = torch.sigmoid(output).squeeze().cpu().numpy()

    findings = [
        {"label": label, "confidence": round(float(prob), 4)}
        for label, prob in zip(model.pathologies, probs)
        if label  # skip empty-string pathology slots
    ]
    findings.sort(key=lambda x: x["confidence"], reverse=True)

    return {
        "findings": findings,
        "model": "densenet121-res224-all",
    }
