import numpy as np
import pytest
from imaging.analyzer import _is_medical_scan, _attach_clinical_info

def test_grayscale_image_passes_validation():
    # Pure grayscale: R == G == B
    arr = np.ones((256, 256, 3), dtype=np.uint8) * 128
    warning = _is_medical_scan(arr)
    assert warning is None

def test_colour_photo_fails_validation():
    # Vivid colour image (green channel very different from red)
    arr = np.zeros((256, 256, 3), dtype=np.uint8)
    arr[:, :, 0] = 200   # R
    arr[:, :, 1] = 20    # G
    arr[:, :, 2] = 20    # B
    warning = _is_medical_scan(arr)
    assert warning is not None
    assert "may not be a medical scan" in warning

def test_small_image_fails_validation():
    arr = np.ones((64, 64, 3), dtype=np.uint8) * 128
    warning = _is_medical_scan(arr)
    assert warning is not None

def test_attach_clinical_info_adds_fields():
    findings = [
        {"label": "Pneumonia", "confidence": 0.87},
        {"label": "Atelectasis", "confidence": 0.43},
    ]
    result = _attach_clinical_info(findings, threshold=0.15)
    assert len(result) == 2
    for f in result:
        assert "cause" in f
        assert "medications" in f
        assert "prevention" in f
        assert "severity" in f

def test_attach_clinical_info_filters_below_threshold():
    findings = [
        {"label": "Pneumonia", "confidence": 0.87},
        {"label": "Nodule", "confidence": 0.10},  # below 0.15
    ]
    result = _attach_clinical_info(findings, threshold=0.15)
    assert len(result) == 1
    assert result[0]["label"] == "Pneumonia"

def test_attach_clinical_info_sorted_descending():
    findings = [
        {"label": "Atelectasis", "confidence": 0.43},
        {"label": "Pneumonia", "confidence": 0.87},
    ]
    result = _attach_clinical_info(findings, threshold=0.15)
    assert result[0]["confidence"] > result[1]["confidence"]
