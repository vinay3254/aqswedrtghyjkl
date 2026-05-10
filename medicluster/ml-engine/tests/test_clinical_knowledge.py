import pytest
from clinical_knowledge import CLINICAL_KNOWLEDGE, get_clinical_info, ALL_LABELS

def test_all_18_labels_present():
    assert len(CLINICAL_KNOWLEDGE) == 18

def test_known_labels_present():
    for label in ALL_LABELS:
        assert label in CLINICAL_KNOWLEDGE, f"Missing: {label}"

def test_each_entry_has_required_keys():
    for label, info in CLINICAL_KNOWLEDGE.items():
        assert "cause" in info,        f"{label} missing 'cause'"
        assert "medications" in info,  f"{label} missing 'medications'"
        assert "prevention" in info,   f"{label} missing 'prevention'"
        assert "severity" in info,     f"{label} missing 'severity'"
        assert isinstance(info["medications"], list)
        assert isinstance(info["prevention"], list)
        assert info["severity"] in ("high", "moderate", "low"), f"{label} bad severity"

def test_get_clinical_info_known_label():
    info = get_clinical_info("Pneumonia")
    assert info["severity"] == "high"
    assert len(info["medications"]) > 0

def test_get_clinical_info_unknown_label():
    info = get_clinical_info("SomeFakeDisease")
    assert info["cause"] == "Unknown"
    assert info["medications"] == []
    assert info["prevention"] == []
    assert info["severity"] == "low"
