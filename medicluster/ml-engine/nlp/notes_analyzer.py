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

SYMPTOM_LEXICON = {
    "chest pain": ["chest pain", "chest tightness", "angina"],
    "breathlessness": ["shortness of breath", "breathlessness", "dyspnea", "sob"],
    "fever": ["fever", "febrile", "high temperature"],
    "cough": ["cough", "coughing"],
    "wheeze": ["wheeze", "wheezing"],
    "palpitations": ["palpitations", "racing heart"],
    "syncope": ["syncope", "fainting", "blackout"],
    "weakness": ["weakness", "limb weakness", "hemiparesis"],
    "slurred speech": ["slurred speech", "speech difficulty"],
    "facial droop": ["facial droop", "face drooping"],
    "confusion": ["confusion", "altered sensorium", "disorientation"],
    "vomiting": ["vomiting", "emesis"],
    "diarrhea": ["diarrhea", "loose stools"],
    "abdominal pain": ["abdominal pain", "stomach pain"],
    "headache": ["headache", "migraine"],
    "swelling": ["swelling", "edema", "oedema"],
    "reduced urine": ["reduced urine", "low urine", "oliguria"],
    "fatigue": ["fatigue", "tiredness"],
    "weight loss": ["weight loss", "losing weight"],
    "blurred vision": ["blurred vision", "blurry vision"],
    "polyuria": ["polyuria", "frequent urination"],
    "polydipsia": ["polydipsia", "excessive thirst"],
}

ABBREVIATIONS = {
    "bp": "blood pressure",
    "hr": "heart rate",
    "rr": "respiratory rate",
    "sob": "shortness of breath",
    "c/o": "complains of",
    "h/o": "history of",
    "dm": "diabetes mellitus",
    "htn": "hypertension",
    "cad": "coronary artery disease",
    "ckd": "chronic kidney disease",
    "copd": "chronic obstructive pulmonary disease",
    "mi": "myocardial infarction",
    "ecg": "electrocardiogram",
    "cxr": "chest x-ray",
    "spo2": "oxygen saturation",
}

COMMON_MISSPELLINGS = {
    "diabtes": "diabetes",
    "diabetis": "diabetes",
    "hypertention": "hypertension",
    "pnuemonia": "pneumonia",
    "pneumoniae": "pneumonia",
    "breathlessnes": "breathlessness",
    "dizzyness": "dizziness",
    "vommiting": "vomiting",
    "feaver": "fever",
}

EMERGENCY_FLAGS = {
    "cardiac arrest": "Immediate resuscitation pathway.",
    "respiratory failure": "Immediate airway and breathing assessment.",
    "septic shock": "Sepsis emergency pathway.",
    "unconscious": "Urgent neurological and airway assessment.",
    "crushing chest pain": "Possible acute coronary syndrome.",
    "stroke": "Stroke protocol if symptoms are acute.",
    "slurred speech": "Possible stroke symptom.",
    "facial droop": "Possible stroke symptom.",
    "spo2 88": "Severe hypoxia signal.",
}

SYMPTOM_DEPARTMENT_MAP = {
    "chest pain": "Cardiology",
    "palpitations": "Cardiology",
    "syncope": "Cardiology",
    "breathlessness": "Pulmonology",
    "cough": "Pulmonology",
    "wheeze": "Pulmonology",
    "slurred speech": "Neurology",
    "facial droop": "Neurology",
    "weakness": "Neurology",
    "reduced urine": "Nephrology",
    "swelling": "Nephrology",
    "polyuria": "Endocrinology",
    "polydipsia": "Endocrinology",
    "blurred vision": "Endocrinology",
    "fever": "General Medicine",
}


def _word_pattern(phrase: str) -> re.Pattern:
    escaped = re.escape(phrase).replace(r"\ ", r"\s+")
    return re.compile(rf"\b{escaped}\b", re.IGNORECASE)


def _is_negated(text_lower: str, start: int) -> bool:
    """Detect simple clinical negation before a matched term."""
    window = text_lower[max(0, start - 45):start]
    return bool(re.search(r"\b(no|denies|denied|without|not|negative for|free of)\b(?:\W+\w+){0,5}\W*$", window))


def _extract_nearby(patterns: list[str], text_lower: str, start: int, end: int) -> Optional[str]:
    window = text_lower[max(0, start - 60):min(len(text_lower), end + 80)]
    for pattern in patterns:
        match = re.search(pattern, window, re.IGNORECASE)
        if match:
            return match.group(1).strip()
    return None


def _extract_duration(text_lower: str, start: int, end: int) -> Optional[str]:
    return _extract_nearby(
        [
            r"\bfor\s+(\d+\s*(?:hours?|hrs?|days?|weeks?|months?))",
            r"\bsince\s+([a-z0-9 ,/-]+)",
            r"\b(\d+)[-\s]*(?:hour|hr|day|week|month)s?\s+(?:history of\s+)?",
        ],
        text_lower,
        start,
        end,
    )


def _extract_severity(text_lower: str, start: int, end: int) -> Optional[str]:
    window = text_lower[max(0, start - 50):min(len(text_lower), end + 50)]
    for severity in ("severe", "moderate", "mild", "worsening", "persistent", "acute"):
        if re.search(rf"\b{severity}\b", window):
            return severity
    return None


def _extract_symptoms(text: str) -> list[dict]:
    """Extract symptoms with negation, severity, and duration metadata."""
    text_lower = text.lower()
    symptoms = {}

    for canonical, aliases in SYMPTOM_LEXICON.items():
        for alias in aliases:
            for match in _word_pattern(alias).finditer(text):
                start, end = match.span()
                negated = _is_negated(text_lower, start)
                current = symptoms.get(canonical, {
                    "symptom": canonical,
                    "matched_text": match.group(0),
                    "negated": negated,
                    "severity": _extract_severity(text_lower, start, end),
                    "duration": _extract_duration(text_lower, start, end),
                })
                # A positive mention should win over a negated one.
                if current["negated"] and not negated:
                    current["negated"] = False
                    current["matched_text"] = match.group(0)
                current["severity"] = current["severity"] or _extract_severity(text_lower, start, end)
                current["duration"] = current["duration"] or _extract_duration(text_lower, start, end)
                symptoms[canonical] = current

    return list(symptoms.values())


def _expand_abbreviations(text: str) -> list[dict]:
    """Return abbreviation expansions found in the note."""
    found = []
    text_lower = text.lower()
    for abbr, expansion in ABBREVIATIONS.items():
        if _word_pattern(abbr).search(text_lower):
            found.append({"abbreviation": abbr, "expansion": expansion})
    return found


def _medical_spell_correction(text: str) -> dict:
    corrected = text
    corrections = []
    for wrong, right in COMMON_MISSPELLINGS.items():
        pattern = _word_pattern(wrong)
        if pattern.search(corrected):
            corrected = pattern.sub(right, corrected)
            corrections.append({"from": wrong, "to": right})
    return {"corrected_text": corrected, "corrections": corrections}


def _extract_sections(text: str) -> dict:
    """Best-effort section parser for notes and discharge summaries."""
    headings = [
        "chief complaint", "history", "assessment", "plan", "medications",
        "allergies", "diagnosis", "investigations", "discharge advice",
    ]
    matches = []
    for heading in headings:
        for match in re.finditer(rf"(^|\n)\s*{re.escape(heading)}\s*[:\-]", text, re.IGNORECASE):
            matches.append((match.start(), match.end(), heading))

    if not matches:
        return {}

    matches.sort()
    sections = {}
    for i, (_, content_start, heading) in enumerate(matches):
        content_end = matches[i + 1][0] if i + 1 < len(matches) else len(text)
        sections[heading] = text[content_start:content_end].strip()
    return sections


def _extract_prescription_details(text: str) -> list[dict]:
    """Extract medication names with simple dose/frequency snippets."""
    medications = []
    for match in DRUG_PATTERN.finditer(text):
        start, end = match.span()
        after = text[end:end + 45]
        dose_match = re.search(
            r"\s*(\d+(?:\.\d+)?\s*(?:mg|mcg|g|units|iu|ml|tablet|tab|puff)s?"
            r"(?:\s*(?:od|bd|tds|qid|daily|twice daily|once daily|nightly))?)",
            after,
            re.IGNORECASE,
        )
        medications.append({
            "name": match.group(0).lower(),
            "dose": dose_match.group(1).strip() if dose_match else None,
        })
    # Preserve order while de-duplicating by name+dose.
    unique = {}
    for med in medications:
        unique[(med["name"], med["dose"])] = med
    return list(unique.values())


def _interpret_labs(lab_values: list[dict]) -> list[dict]:
    """Attach simple high/low/normal interpretation to extracted lab values."""
    interpretations = []
    for lab in lab_values:
        marker = lab["marker"].lower()
        try:
            value = float(lab["value"])
        except (TypeError, ValueError):
            continue

        status = "not_interpreted"
        message = "Reference range not configured."
        if marker in {"glucose"}:
            status = "high" if value >= 200 else "low" if value < 70 else "normal"
            message = "High glucose." if status == "high" else "Low glucose." if status == "low" else "Glucose in common reference range."
        elif marker in {"hba1c"}:
            status = "high" if value >= 6.5 else "normal"
            message = "HbA1c is in diabetic range." if status == "high" else "HbA1c is below diabetic range."
        elif marker in {"creatinine"}:
            status = "high" if value >= 1.5 else "normal"
            message = "Creatinine is elevated." if status == "high" else "Creatinine is not flagged by this rule."
        elif marker in {"wbc", "white blood cell"}:
            status = "high" if value > 12 else "low" if value < 4 else "normal"
            message = "WBC is abnormal." if status != "normal" else "WBC is in common reference range."
        elif marker in {"spo2"}:
            status = "low" if value < 94 else "normal"
            message = "Oxygen saturation is low." if status == "low" else "Oxygen saturation is not flagged."
        elif marker in {"troponin"}:
            status = "high" if value > 0.04 else "normal"
            message = "Troponin elevation may indicate myocardial injury." if status == "high" else "Troponin is not flagged."
        elif marker in {"hemoglobin", "haemoglobin"}:
            status = "low" if value < 12 else "normal"
            message = "Hemoglobin is low." if status == "low" else "Hemoglobin is not flagged."

        interpretations.append({**lab, "status": status, "message": message})
    return interpretations


def _find_emergency_flags(text: str, symptoms: list[dict], lab_values: list[dict]) -> list[dict]:
    flags = []
    text_lower = text.lower()
    for phrase, action in EMERGENCY_FLAGS.items():
        if phrase in text_lower:
            flags.append({"flag": phrase, "action": action})

    for symptom in symptoms:
        if symptom.get("negated"):
            continue
        if symptom["symptom"] in {"chest pain", "breathlessness", "slurred speech", "facial droop"}:
            if symptom.get("severity") in {"severe", "acute", "worsening"}:
                flags.append({
                    "flag": f"{symptom['severity']} {symptom['symptom']}",
                    "action": "Urgent clinician review.",
                })

    for lab in _interpret_labs(lab_values):
        if lab["marker"].lower() == "spo2" and lab["status"] == "low":
            flags.append({"flag": "low spo2", "action": "Check oxygen requirement immediately."})
        if lab["marker"].lower() == "troponin" and lab["status"] == "high":
            flags.append({"flag": "high troponin", "action": "Cardiac pathway review."})

    unique = {}
    for flag in flags:
        unique[flag["flag"]] = flag
    return list(unique.values())


def _route_departments(symptoms: list[dict], icd_codes: list[dict], emergency_flags: list[dict]) -> list[dict]:
    scores = {}
    if emergency_flags:
        scores["Emergency"] = scores.get("Emergency", 0) + 5

    for symptom in symptoms:
        if symptom.get("negated"):
            continue
        dept = SYMPTOM_DEPARTMENT_MAP.get(symptom["symptom"])
        if dept:
            scores[dept] = scores.get(dept, 0) + (2 if symptom.get("severity") in {"severe", "acute"} else 1)

    for code in icd_codes:
        keyword = code.get("keyword", "")
        if keyword in {"heart failure", "myocardial infarction", "chest pain"}:
            scores["Cardiology"] = scores.get("Cardiology", 0) + 2
        elif keyword in {"pneumonia", "copd", "dyspnea", "hypoxia"}:
            scores["Pulmonology"] = scores.get("Pulmonology", 0) + 2
        elif keyword in {"stroke"}:
            scores["Neurology"] = scores.get("Neurology", 0) + 2
        elif keyword in {"diabetes"}:
            scores["Endocrinology"] = scores.get("Endocrinology", 0) + 2
        elif keyword in {"acute kidney injury"}:
            scores["Nephrology"] = scores.get("Nephrology", 0) + 2

    if not scores:
        scores["General Medicine"] = 1

    return [
        {"department": dept, "priority": score}
        for dept, score in sorted(scores.items(), key=lambda item: item[1], reverse=True)
    ][:4]


def _generate_follow_up_questions(symptoms: list[dict], lab_values: list[dict], risk_tier: str) -> list[str]:
    questions = []
    positive_symptoms = [s for s in symptoms if not s.get("negated")]
    for symptom in positive_symptoms[:5]:
        if not symptom.get("duration"):
            questions.append(f"How long has the {symptom['symptom']} been present?")
        if not symptom.get("severity"):
            questions.append(f"How severe is the {symptom['symptom']}?")

    names = {s["symptom"] for s in positive_symptoms}
    if "chest pain" in names:
        questions.append("Does the chest pain radiate to the arm, jaw, back, or come with sweating?")
    if "breathlessness" in names:
        questions.append("Is breathlessness present at rest, on exertion, or while lying down?")
    if "fever" in names:
        questions.append("Any chills, cough, burning urination, wound discharge, or recent infection?")
    if risk_tier in {"High", "Critical"}:
        questions.append("Are symptoms worsening rapidly or associated with confusion, fainting, or low oxygen?")
    if not lab_values:
        questions.append("Are recent vitals or lab values available?")
    return list(dict.fromkeys(questions))[:8]


def _detect_incomplete_description(symptoms: list[dict], lab_values: list[dict], drugs: list[str]) -> list[str]:
    gaps = []
    positive = [s for s in symptoms if not s.get("negated")]
    if not positive:
        gaps.append("No positive symptoms were extracted.")
    if positive and not any(s.get("duration") for s in positive):
        gaps.append("Symptom duration is missing.")
    if positive and not any(s.get("severity") for s in positive):
        gaps.append("Symptom severity is missing.")
    if not lab_values:
        gaps.append("No lab values were extracted.")
    if not drugs:
        gaps.append("No active medications were extracted.")
    return gaps


def _generate_patient_friendly_explanation(risk_tier: str, trajectory: str, symptoms: list[dict], lab_values: list[dict]) -> str:
    symptom_names = [s["symptom"] for s in symptoms if not s.get("negated")]
    symptom_text = ", ".join(symptom_names[:4]) if symptom_names else "the information provided"
    lab_flags = [lab for lab in _interpret_labs(lab_values) if lab["status"] in {"high", "low"}]
    lab_text = ", ".join(f"{lab['marker']} {lab['status']}" for lab in lab_flags[:3]) if lab_flags else "no major lab warning extracted"
    return (
        f"The note suggests {trajectory} condition with {risk_tier} risk. "
        f"Main symptoms/signals: {symptom_text}. Lab check: {lab_text}."
    )


def _generate_referral_note(risk_tier: str, departments: list[dict], symptoms: list[dict], icd_codes: list[dict]) -> str:
    dept = departments[0]["department"] if departments else "General Medicine"
    symptom_text = ", ".join(s["symptom"] for s in symptoms if not s.get("negated")) or "symptoms not clearly documented"
    codes = ", ".join(c["code"] for c in icd_codes[:3]) or "no ICD suggestion"
    return f"Refer to {dept}. Risk: {risk_tier}. Key symptoms: {symptom_text}. Suggested ICD-10: {codes}."


def _generate_care_recommendations(risk_tier: str, emergency_flags: list[dict], departments: list[dict]) -> list[str]:
    recommendations = []
    if emergency_flags:
        recommendations.append("Prioritize urgent clinician review before routine workflow.")
    if risk_tier == "Critical":
        recommendations.append("Immediate assessment, continuous monitoring, and escalation pathway.")
    elif risk_tier == "High":
        recommendations.append("Same-day doctor review and repeat abnormal vitals/labs.")
    elif risk_tier == "Moderate":
        recommendations.append("Follow-up review, medication adherence check, and safety-net advice.")
    else:
        recommendations.append("Routine care with preventive counselling.")
    if departments:
        recommendations.append(f"Route first to {departments[0]['department']}.")
    return recommendations


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

    correction     = _medical_spell_correction(notes)
    corrected_note = correction["corrected_text"]
    risk_keywords  = _extract_risk_keywords(corrected_note)
    trajectory     = _determine_trajectory(corrected_note)
    drugs          = _extract_drugs(corrected_note)
    prescription   = _extract_prescription_details(corrected_note)
    lab_values     = _extract_lab_values(corrected_note)
    lab_interp     = _interpret_labs(lab_values)
    symptoms       = _extract_symptoms(corrected_note)
    entities       = _extract_diagnoses_spacy(corrected_note)
    icd_codes      = _suggest_icd10(corrected_note, entities)
    risk_tier      = _infer_risk_tier(risk_keywords, trajectory)
    emergency      = _find_emergency_flags(corrected_note, symptoms, lab_values)
    departments    = _route_departments(symptoms, icd_codes, emergency)
    followups      = _generate_follow_up_questions(symptoms, lab_values, risk_tier)
    gaps           = _detect_incomplete_description(symptoms, lab_values, drugs)
    sections       = _extract_sections(corrected_note)
    abbreviations  = _expand_abbreviations(corrected_note)
    summary        = _generate_summary(corrected_note, trajectory, risk_tier, drugs, lab_values, icd_codes)

    return {
        "trajectory":       trajectory,
        "risk_tier":        risk_tier,
        "risk_keywords":    risk_keywords,
        "entities":         entities,
        "symptoms":         symptoms,
        "drugs":            drugs,
        "prescription":     prescription,
        "lab_values":       lab_values,
        "lab_interpretation": lab_interp,
        "icd10_suggestions": icd_codes,
        "emergency_flags":   emergency,
        "recommended_departments": departments,
        "follow_up_questions": followups,
        "incomplete_description_flags": gaps,
        "abbreviations":     abbreviations,
        "spell_corrections": correction["corrections"],
        "sections":          sections,
        "structured_record": {
            "symptoms": symptoms,
            "medications": prescription,
            "labs": lab_interp,
            "diagnoses": icd_codes,
            "trajectory": trajectory,
            "risk_tier": risk_tier,
        },
        "summary":          summary,
        "patient_friendly_explanation": _generate_patient_friendly_explanation(
            risk_tier, trajectory, symptoms, lab_values
        ),
        "referral_note": _generate_referral_note(risk_tier, departments, symptoms, icd_codes),
        "care_recommendations": _generate_care_recommendations(risk_tier, emergency, departments),
        "note_length":      len(notes),
        "nlp_backend":      "scispacy" if _get_spacy() else "regex-fallback",
    }
