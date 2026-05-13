"""
imaging/gradcam.py
Grad-CAM heatmap generation for chest X-ray pathology localization.

Generates a saliency heatmap showing WHICH region of the X-ray triggered
each pathology detection — clinicians can visually confirm AI findings.
"""

import io
import logging
import numpy as np

logger = logging.getLogger(__name__)

try:
    import torch
    import torch.nn.functional as F
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False


def _normalize_cam(cam: np.ndarray) -> np.ndarray:
    """Normalize a CAM array to [0, 1]."""
    cam_min, cam_max = cam.min(), cam.max()
    if cam_max - cam_min < 1e-8:
        return np.zeros_like(cam)
    return (cam - cam_min) / (cam_max - cam_min)


def _cam_to_heatmap_b64(cam: np.ndarray, original_size: tuple[int, int]) -> str:
    """Convert a normalized CAM to a base64-encoded RGBA heatmap PNG."""
    import base64

    if not PIL_AVAILABLE:
        return ""

    # Resize CAM to original image size
    cam_img = Image.fromarray((cam * 255).astype(np.uint8)).resize(
        original_size, Image.BILINEAR
    )
    cam_arr = np.array(cam_img, dtype=np.float32) / 255.0

    # Jet colormap: red = high activation, blue = low
    r = np.clip(1.5 - np.abs(4.0 * cam_arr - 3.0), 0, 1)
    g = np.clip(1.5 - np.abs(4.0 * cam_arr - 2.0), 0, 1)
    b = np.clip(1.5 - np.abs(4.0 * cam_arr - 1.0), 0, 1)
    a = np.ones_like(r) * 0.6  # Semi-transparent overlay

    rgba = (np.stack([r, g, b, a], axis=-1) * 255).astype(np.uint8)
    heatmap_pil = Image.fromarray(rgba, mode="RGBA")

    buf = io.BytesIO()
    heatmap_pil.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def generate_gradcam(
    image_bytes: bytes,
    model_name: str,
    target_label: str,
    filename: str = "",
) -> dict:
    """
    Generate a Grad-CAM heatmap for a specific pathology label on a chest X-ray.

    Parameters
    ----------
    image_bytes  : raw image bytes (JPEG / PNG / DICOM)
    model_name   : XRV model key (e.g. "densenet121-res224-chex")
    target_label : pathology label to visualize (e.g. "Pneumonia")
    filename     : original filename for DICOM detection

    Returns
    -------
    {
        "heatmap_b64"      : base64-encoded PNG heatmap overlay,
        "target_label"     : str,
        "confidence"       : float,
        "gradcam_available": bool
    }
    """
    if not TORCH_AVAILABLE or not PIL_AVAILABLE:
        return {
            "heatmap_b64":       "",
            "target_label":      target_label,
            "confidence":        0.0,
            "gradcam_available": False,
            "message":           "PyTorch or Pillow not available.",
        }

    try:
        import torchxrayvision as xrv
        from imaging.analyzer import _load_pixels, _preprocess, _get_model, XRV_MODELS

        cfg = XRV_MODELS.get(model_name)
        if cfg is None:
            raise ValueError(f"Unknown model: {model_name}")

        arr, is_dicom = _load_pixels(image_bytes, filename)
        original_h, original_w = arr.shape[:2]
        tensor = _preprocess(arr, cfg["size"], is_dicom)  # (1, 1, H, W)

        model = _get_model(model_name)
        model.eval()

        # Find target label index
        if target_label not in model.pathologies:
            available = [p for p in model.pathologies if p]
            return {
                "heatmap_b64": "",
                "target_label": target_label,
                "confidence": 0.0,
                "gradcam_available": False,
                "message": f"Label '{target_label}' not in model. Available: {available[:5]}",
            }

        label_idx = list(model.pathologies).index(target_label)

        # ── Hook-based Grad-CAM ─────────────────────────────────────────────
        gradients = []
        activations = []

        def save_grad(grad):
            gradients.append(grad)

        def forward_hook(module, inp, out):
            activations.append(out)
            out.register_hook(save_grad)

        # Attach hook to last conv layer of DenseNet or ResNet
        target_layer = None
        for name, module in model.named_modules():
            if isinstance(module, torch.nn.Conv2d):
                target_layer = module

        if target_layer is None:
            return {
                "heatmap_b64":       "",
                "target_label":      target_label,
                "confidence":        0.0,
                "gradcam_available": False,
                "message":           "Could not locate conv layer for Grad-CAM.",
            }

        handle = target_layer.register_forward_hook(forward_hook)

        # Forward pass
        tensor.requires_grad_(True)
        output = model(tensor)
        confidence = float(torch.sigmoid(output[0, label_idx]).item())

        # Backward on target class
        model.zero_grad()
        score = output[0, label_idx]
        score.backward()
        handle.remove()

        if not gradients or not activations:
            raise RuntimeError("Grad-CAM hooks did not fire.")

        grads  = gradients[0].squeeze().cpu().detach().numpy()   # (C, H, W)
        acts   = activations[0].squeeze().cpu().detach().numpy()  # (C, H, W)

        # GAP over spatial dimensions
        weights = grads.mean(axis=(1, 2))  # (C,)
        cam     = np.sum(weights[:, None, None] * acts, axis=0)  # (H, W)
        cam     = np.maximum(cam, 0)  # ReLU
        cam     = _normalize_cam(cam)

        heatmap_b64 = _cam_to_heatmap_b64(cam, (original_w, original_h))

        return {
            "heatmap_b64":       heatmap_b64,
            "target_label":      target_label,
            "confidence":        round(confidence, 4),
            "gradcam_available": True,
        }

    except Exception as e:
        logger.error(f"Grad-CAM failed: {e}")
        return {
            "heatmap_b64":       "",
            "target_label":      target_label,
            "confidence":        0.0,
            "gradcam_available": False,
            "error":             str(e),
        }
