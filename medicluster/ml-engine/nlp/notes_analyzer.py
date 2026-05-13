"""
nlp/notes_analyzer.py
Analyzes free-text clinical notes using BioBERT/ClinicalBERT or fallback NLP.

Pipeline:
  1. Medical Named Entity Recognition (NER) — extract drugs, diagnoses, symptoms
  2. Sentiment/trajectory analysis — improving / stable / deteriorating
  3. Risk keyword extraction
  4. Plain-language AI summary
  5. ICD-10 code suggestion (rule-based hybrid)

Gracefully degrades if heavy transformers/scispacy are not installed.
"""

import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ── Optional heavy imports ─────────────────────────────────────────────────────

try:
    import spacy
    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False

try:
    from transformers import pipeline as hf_pipeline
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

# ── Risk keyword lexicon ───────────────────────────────────────────────────────

RISK_KEYWORDS = {
    "critical": [
        "cardiac arrest", "respiratory failure", "septic shock", "multi-organ failure",
        "acute mi", "stroke", "intubated", "icu", "critical", "emergent", "life-threatening",
        "code blue", "vasopressors", "mechanical ventilation",
    ],
    "high": [
        "pneumonia", "pulmonary embolism", "heart failure", "acute kidney injury",
        "hyperglycemia", "hypertensive crisis", "severe", "acute", "hospitalized",
        "emergency", "deteriorating", "worsening",
    ],
    "moderate": [
        "diabetes", "hypertension", "copd", "atrial fibrillation", "chronic",
        "elevated", "abnormal", "monitoring", "follow-up required", "concern",
    ],
    "low": [
        "stable", "improving", "discharged", "routine", "normal", "within limits",
        "no acute", "well-controlled",
    ],
}

DETERIORATION_PHRASES = [
    "deteriorating", "worsening", "decompensating", "declining", "acute exacerbation",
    "rapid decline", "hemodynamically unstable", "desaturating",
]

IMPROVEMENT_PHRASES = [
    "improving", "responding to treatment", "stable", "afebrile", "tolerating",
    "ambulatory", "discharged", "resolving",
]

# ICD-10 mapping: keyword → (code, description)
ICD10_RULES = {
    "pneumonia":        ("J18.9", "Pneumonia, unspecified organism"),
    "sepsis":           ("A41.9", "Sepsis, unspecified organism"),
    "heart failure":    ("I50.9", "Heart failure, unspecified"),
    "myocardial infarction": ("I21.9", "Acute MI, unspecified"),
    "diabetes":         ("E11.9", "Type 2 diabetes mellitus without complications"),
    "hypertension":     ("I10",   "Essential (primary) hypertension"),
    "copd":             ("J44.9", "COPD, unspecified"),
    "atrial fibrillation": ("I48.91", "Unspecified atrial fibrillation"),
    "stroke":           ("I63.9", "Cerebral infarction, unspecified"),
    "pulmonary embolism": ("I26.99", "Other pulmonary embolism without acute cor pulmonale"),
    "acute kidney injury": ("N17.9", "Acute kidney failure, unspecified"),
    "anemia":           ("D64.9", "Anemia, unspecified"),
    "pneumothorax":     ("J93.9", "Pneumothorax, unspecified"),
    "edema":            ("R60.9", "Oedema, unspecified"),
    "fracture":         ("S22.9", "Fracture of other parts of thorax"),
    "chest pain":       ("R07.9", "Chest pain, unspecified"),
    "dyspnea":          ("R06.09","Other forms of dyspnea"),
    "fever":            ("R50.9", "Fever, unspecified"),
    "hypoxia":          ("R09.02","Hypoxemia"),
    "cardiomegaly":     ("I51.7", "Cardiomegaly"),
}

# Drug name patterns (simplified NER fallback)
DRUG_PATTERN = re.compile(
    r"\b(aspirin|metformin|lisinopril|atorvastatin|metoprolol|furosemide|"
    r"amoxicillin|azithromycin|heparin|warfarin|insulin|prednisone|"
    r"salbutamol|tiotropium|digoxin|enalapril|amlodipine|losartan|"
    r"pantoprazole|omeprazole|ondansetron|paracetamol|ibuprofen|morphine|"
    r"vancomycin|piperacillin|ceftriaxone|ciprofloxacin|fluconazole)\b",
    re.IGNORECASE,
)

LAB_PATTERN = re.compile(
    r"(hba1c|hemoglobin|haemoglobin|wbc|white blood cell|platelet|creatinine|"
    r"bun|troponin|bnp|nt-probnp|sodium|potassium|glucose|bilirubin|alt|ast|"
    r"egfr|pao2|spo2|fev1|d-dimer)\s*(?:was|is|of|=|:)?\s*([0-9]+\.?[0-9]*)\s*(%|mg\/dl|mmol\/l|g\/dl|u\/l|iu\/l|mm hg|%)?",
    re.IGNORECASE,
)


# ── Spacy NER (optional) ───────────────────────────────────────────────────────

_spacy_model = None

def _get_spacy():
    global _spacy_model
    if _spacy_model is not None:
        return _spacy_model
    if not SPACY_AVAILABLE:
        return None
    try:
        import en_core_sci_md
        _spacy_model = en_core_sci_md.load()
        logger.info("Loaded scispacy en_core_sci_md model")
    except Exception:
        try:
            _spacy_model = spacy.load("en_core_web_sm")
            logger.info("Loaded spacy en_core_web_sm (fallback)")
        except Exception as e:
            logger.warning(f"No spacy model available: {e}")
            _spacy_model = None
    return _spacy_model


# ── Sentiment pipeline (optional) ─────────────────────────────────────────────

_sentiment_pipe = None

def _get_sentiment_pipeline():
    global _sentiment_pipe
    if _sentiment_pipe is not None:
        return _sentiment_pipe
    if not TRANSFORMERS_AVAILABLE:
        return None
    try:
        _sentiment_pipe = hf_pipeline(
            "text-classification",
            model="distilbert-base-uncased-finetuned-sst-2-english",
            device=-1,  # CPU
        )
    except Exception as e:
        logger.warning(f"Could not load sentiment pipeline: {e}")
        _sentiment_pipe = None
    return _sentiment_pipe


# ── Core analysis functions ────────────────────────────────────────────────────

def _extract_risk_keywords(text: str) -> dict:
    """Extract risk-level keywords from text."""
    text_lower = text.lower()
    found = {}
    for tier, keywords in RISK_KEYWORDS.items():
        matched = [kw for kw in keywords if kw in text_lower]
        if matched:
            found[tier] = matched
    return found


def _determine_trajectory(text: str) -> str:
    """Determine patient trajectory: improving / stable / deteriorating."""
    text_lower = text.lower()
    deter_hits = sum(1 for p in DETERIORATION_PHRASES if p in text_lower)
    improv_hits = sum(1 for p in IMPROVEMENT_PHRASES if p in text_lower)
    if deter_hits > improv_hits:
        return "deteriorating"
    elif improv_hits > deter_hits:
        return "improving"
    return "stable"


def _extract_drugs(text: str) -> list[str]:
    """Extract drug names via regex pattern."""
    return list(set(m.group(0).lower() for m in DRUG_PATTERN.finditer(text)))


def _extract_lab_values(text: str) -> list[dict]:
    """Extract embedded lab values from text."""
    results = []
    for m in LAB_PATTERN.finditer(text):
        results.append({
            "marker": m.group(1),
            "value":  m.group(2),
            "unit":   (m.group(3) or "").strip(),
        })
    return results


def _extract_diagnoses_spacy(text: str) -> list[str]:
    """Use spacy NER to extract medical entities."""
    nlp = _get_spacy()
    if nlp is None:
        return []
    doc = nlp(text)
    entities = list({ent.text.lower() for ent in doc.ents
                     if ent.label_ in ("DISEASE", "CHEMICAL", "ANATOMY", "PROBLEM", "TREATMENT", "TEST")})
    return entities[:20]


def _suggest_icd10(text: str, diagnoses: list[str]) -> list[dict]:
    """Rule-based ICD-10 code suggestions."""
    text_lower = text.lower()
    codes = []
    seen = set()
    for keyword, (code, desc) in ICD10_RULES.items():
        if keyword in text_lower or any(keyword in d for d in diagnoses):
            if code not in seen:
                codes.append({"code": code, "description": desc, "keyword": keyword})
                seen.add(code)
    return codes[:10]


def _infer_risk_tier(keyword_hits: dict, trajectory: str) -> str:
    """Infer overall risk tier from extracted signals."""
    if "critical" in keyword_hits:
        return "Critical"
    if trajectory == "deteriorating" and "high" in keyword_hits:
        return "Critical"
    if "high" in keyword_hits or trajectory == "deteriorating":
        return "High"
    if "moderate" in keyword_hits:
        return "Moderate"
    return "Low"


def _generate_summary(
    text: str,
    trajectory: str,
    risk_tier: str,
    drugs: list[str],
    lab_values: list[dict],
    icd_codes: list[dict],
) -> str:
    """
    Generate a plain-language patient summary.
    Uses transformers summarization if available, else rule-based template.
    """
    if TRANSFORMERS_AVAILABLE:
        try:
            summarizer = hf_pipeline(
                "text2text-generation",
                model="sshleifer/distilbart-cnn-12-6",
                device=-1,
            )
            # Truncate to model max length
            input_text = "summarize: " + text[:1000]
            summary = summarizer(input_text, max_new_tokens=120, min_new_tokens=20)
            ai_summary = summary[0]["generated_text"]
        except Exception as e:
            logger.warning(f"Summarization model failed: {e}, using template.")
            ai_summary = None
    else:
        ai_summary = None

    if ai_summary:
        return ai_summary

    # Fallback: template-based summary
    drug_str = ", ".join(drugs[:5]) if drugs else "none documented"
    lab_str = "; ".join(
        f"{lv['marker']} {lv['value']} {lv['unit']}" for lv in lab_values[:3]
    ) if lab_values else "none extracted"
    icd_str = ", ".join(c["code"] for c in icd_codes[:3]) if icd_codes else "not identified"

    return (
        f"Patient is {trajectory}. Assessed risk tier: {risk_tier}. "
        f"Active medications identified: {drug_str}. "
        f"Lab values noted: {lab_str}. "
        f"Suggested ICD-10 codes: {icd_str}."
    )


# ── Public API ─────────────────────────────────────────────────────────────────

def analyze_clinical_notes(notes: str) -> dict:
    """
    Full pipeline: analyze free-text clinical notes.

    Returns
    -------
    {
        trajectory, risk_tier, risk_keywords,
        entities, drugs, lab_values,
        icd10_suggestions, summary
    }
    """
    if not notes or not notes.strip():
        return {"error": "No notes provided"}

    risk_keywords = _extract_risk_keywords(notes)
    trajectory    = _determine_trajectory(notes)
    drugs         = _extract_drugs(notes)
    lab_values    = _extract_lab_values(notes)
    entities      = _extract_diagnoses_spacy(notes)
    icd_codes     = _suggest_icd10(notes, entities)
    risk_tier     = _infer_risk_tier(risk_keywords, trajectory)
    summary       = _generate_summary(notes, trajectory, risk_tier, drugs, lab_values, icd_codes)

    return {
        "trajectory":       trajectory,
        "risk_tier":        risk_tier,
        "risk_keywords":    risk_keywords,
        "entities":         entities,
        "drugs":            drugs,
        "lab_values":       lab_values,
        "icd10_suggestions": icd_codes,
        "summary":          summary,
        "note_length":      len(notes),
        "nlp_backend":      "scispacy" if _get_spacy() else "regex-fallback",
    }
