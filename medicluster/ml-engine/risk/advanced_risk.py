"""
Advanced clinical risk intelligence.

This module is intentionally dependency-light. It gives the API practical
feature baselines for triage, disease-specific risk, readmission/ICU estimates,
fairness summaries, care plans, and longitudinal comparisons even before a
hospital has enough labelled data to train supervised models.
"""

from __future__ import annotations

import math
import re
from collections import Counter, defaultdict
from datetime import datetime
from typing import Any


FIELD_ALIASES = {
    "age": ["age", "patient_age", "years"],
    "gender": ["gender", "sex"],
    "systolic_bp": ["systolic_bp", "sbp", "bp_systolic", "systolic", "blood_pressure_systolic"],
    "diastolic_bp": ["diastolic_bp", "dbp", "bp_diastolic", "diastolic", "blood_pressure_diastolic"],
    "heart_rate": ["heart_rate", "hr", "pulse", "pulse_rate"],
    "respiratory_rate": ["respiratory_rate", "rr", "resp_rate", "breathing_rate"],
    "temperature": ["temperature", "temp", "body_temperature"],
    "spo2": ["spo2", "oxygen_saturation", "o2_saturation", "oxygen", "oxygen_level"],
    "glucose": ["glucose", "blood_glucose", "sugar", "blood_sugar", "rbs", "fbs"],
    "hba1c": ["hba1c", "a1c"],
    "bmi": ["bmi", "body_mass_index"],
    "creatinine": ["creatinine", "serum_creatinine"],
    "egfr": ["egfr", "e_gfr", "estimated_gfr"],
    "bun": ["bun", "blood_urea_nitrogen", "urea"],
    "wbc": ["wbc", "white_blood_cells", "white_blood_cell_count"],
    "platelets": ["platelets", "platelet_count"],
    "hemoglobin": ["hemoglobin", "haemoglobin", "hb"],
    "troponin": ["troponin", "troponin_i", "troponin_t"],
    "lactate": ["lactate", "serum_lactate"],
    "cholesterol": ["cholesterol", "total_cholesterol"],
    "ldl": ["ldl", "ldl_cholesterol"],
    "prior_admissions": ["prior_admissions", "previous_admissions", "admissions_last_year"],
    "length_of_stay": ["length_of_stay", "los", "hospital_days"],
    "consciousness": ["consciousness", "avpu", "mental_status"],
    "smoker": ["smoker", "smoking", "tobacco_use"],
    "diabetes": ["diabetes", "diabetic"],
    "hypertension": ["hypertension", "htn", "high_bp"],
    "copd": ["copd", "asthma", "chronic_lung_disease"],
    "heart_disease": ["heart_disease", "cad", "chf", "heart_failure"],
    "kidney_disease": ["kidney_disease", "ckd", "renal_disease"],
    "notes": ["notes", "clinical_notes", "symptoms", "complaint", "chief_complaint", "text"],
}

KEY_CLINICAL_FIELDS = [
    "age", "systolic_bp", "heart_rate", "respiratory_rate", "temperature",
    "spo2", "glucose", "creatinine", "wbc",
]

DISEASE_SYMPTOMS = {
    "diabetes": ["polyuria", "polydipsia", "blurred vision", "weight loss", "fatigue"],
    "cardiac": ["chest pain", "palpitations", "shortness of breath", "sweating", "syncope"],
    "kidney": ["reduced urine", "swelling", "edema", "foamy urine", "flank pain"],
    "respiratory": ["dyspnea", "shortness of breath", "cough", "wheeze", "cyanosis"],
    "stroke": ["facial droop", "slurred speech", "weakness", "numbness", "confusion"],
    "sepsis": ["fever", "chills", "confusion", "infection", "pneumonia", "sepsis"],
}

DEPARTMENT_RULES = {
    "Emergency": ["cardiac arrest", "respiratory failure", "unconscious", "seizure", "stroke", "sepsis"],
    "Cardiology": ["chest pain", "troponin", "heart failure", "palpitations", "cardiac"],
    "Neurology": ["stroke", "slurred speech", "facial droop", "seizure", "confusion"],
    "Pulmonology": ["dyspnea", "pneumonia", "copd", "wheeze", "spo2", "respiratory"],
    "Nephrology": ["creatinine", "egfr", "kidney", "renal", "reduced urine"],
    "Endocrinology": ["diabetes", "hba1c", "glucose", "hyperglycemia"],
    "General Medicine": ["fever", "infection", "hypertension", "weakness"],
}

NEXT_TEST_RULES = {
    "cardiac": ["ECG", "Troponin repeat", "Chest X-ray", "Electrolytes"],
    "respiratory": ["Chest X-ray", "ABG/VBG", "CBC", "Sputum culture if infection suspected"],
    "sepsis": ["Blood culture", "Serum lactate", "CBC", "Renal function", "Urine routine"],
    "kidney": ["Renal function test", "Urine routine", "Electrolytes", "Renal ultrasound if indicated"],
    "diabetes": ["HbA1c", "Fasting glucose", "Urine ketones if very high glucose"],
    "stroke": ["Non-contrast CT brain", "ECG", "Glucose", "Coagulation profile"],
}


def _canonical_record(record: dict[str, Any]) -> dict[str, Any]:
    lookup = {str(k).lower().strip(): v for k, v in record.items()}
    canonical = {}
    for canonical_name, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            if alias in lookup:
                canonical[canonical_name] = lookup[alias]
                break
    return canonical


def _to_number(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        match = re.search(r"-?\d+(?:\.\d+)?", str(value))
        return float(match.group(0)) if match else None


def _truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return value > 0
    text = str(value).strip().lower()
    return text in {"1", "true", "yes", "y", "present", "positive", "current", "active"}


def _text_blob(record: dict[str, Any], canonical: dict[str, Any]) -> str:
    values = []
    for key in ("notes", "symptoms", "complaint", "chief_complaint", "clinical_notes"):
        if key in record:
            values.append(str(record[key]))
    if "notes" in canonical:
        values.append(str(canonical["notes"]))
    return " ".join(values).lower()


def _add_component(components: list[dict], name: str, score: float, severity: str, message: str) -> None:
    components.append({
        "name": name,
        "score": round(float(score), 2),
        "severity": severity,
        "message": message,
    })


def _score_to_tier(score: float) -> str:
    if score >= 75:
        return "Critical"
    if score >= 50:
        return "High"
    if score >= 25:
        return "Moderate"
    return "Low"


def _probability(score: float, center: float, scale: float = 12.0) -> float:
    return round(float(1 / (1 + math.exp(-(score - center) / scale))), 3)


def _cap_score(score: float) -> float:
    return round(max(0.0, min(100.0, float(score))), 2)


def _present_fields(canonical: dict[str, Any]) -> list[str]:
    return [field for field in KEY_CLINICAL_FIELDS if canonical.get(field) is not None]


def _missing_fields(canonical: dict[str, Any]) -> list[str]:
    return [field for field in KEY_CLINICAL_FIELDS if canonical.get(field) is None]


def _symptom_hits(text: str, symptom_group: str) -> list[str]:
    return [symptom for symptom in DISEASE_SYMPTOMS[symptom_group] if symptom in text]


def _numeric(canonical: dict[str, Any], field: str) -> float | None:
    return _to_number(canonical.get(field))


def _base_components(canonical: dict[str, Any], text: str) -> list[dict]:
    components: list[dict] = []

    age = _numeric(canonical, "age")
    if age is not None:
        if age >= 80:
            _add_component(components, "age", 10, "high", "Age >= 80 increases frailty and complication risk.")
        elif age >= 65:
            _add_component(components, "age", 6, "moderate", "Age >= 65 increases baseline risk.")

    sbp = _numeric(canonical, "systolic_bp")
    if sbp is not None:
        if sbp < 90:
            _add_component(components, "systolic_bp", 18, "critical", "Systolic BP below 90 suggests shock risk.")
        elif sbp < 100:
            _add_component(components, "systolic_bp", 9, "high", "Low systolic BP needs close monitoring.")
        elif sbp >= 180:
            _add_component(components, "systolic_bp", 12, "high", "Very high systolic BP suggests hypertensive crisis risk.")

    hr = _numeric(canonical, "heart_rate")
    if hr is not None:
        if hr >= 130:
            _add_component(components, "heart_rate", 12, "critical", "Heart rate >= 130 is a major deterioration signal.")
        elif hr >= 110:
            _add_component(components, "heart_rate", 7, "high", "Tachycardia is present.")
        elif hr < 45:
            _add_component(components, "heart_rate", 8, "high", "Marked bradycardia is present.")

    rr = _numeric(canonical, "respiratory_rate")
    if rr is not None:
        if rr >= 30:
            _add_component(components, "respiratory_rate", 15, "critical", "Respiratory rate >= 30 suggests respiratory distress.")
        elif rr >= 24:
            _add_component(components, "respiratory_rate", 9, "high", "Elevated respiratory rate is present.")
        elif rr < 10:
            _add_component(components, "respiratory_rate", 8, "high", "Low respiratory rate requires urgent assessment.")

    temp = _numeric(canonical, "temperature")
    if temp is not None:
        if temp >= 39.0:
            _add_component(components, "temperature", 8, "high", "High fever is present.")
        elif temp >= 38.0:
            _add_component(components, "temperature", 4, "moderate", "Fever is present.")
        elif temp < 35.0:
            _add_component(components, "temperature", 10, "high", "Hypothermia may indicate severe illness.")

    spo2 = _numeric(canonical, "spo2")
    if spo2 is not None:
        if spo2 < 90:
            _add_component(components, "spo2", 18, "critical", "SpO2 below 90 indicates severe hypoxia.")
        elif spo2 < 94:
            _add_component(components, "spo2", 9, "high", "SpO2 below 94 suggests hypoxia.")

    glucose = _numeric(canonical, "glucose")
    if glucose is not None:
        if glucose > 300:
            _add_component(components, "glucose", 10, "high", "Very high glucose may need urgent correction.")
        elif glucose > 200:
            _add_component(components, "glucose", 6, "moderate", "Hyperglycemia is present.")
        elif glucose < 70:
            _add_component(components, "glucose", 9, "high", "Hypoglycemia is present.")

    hba1c = _numeric(canonical, "hba1c")
    if hba1c is not None:
        if hba1c >= 9:
            _add_component(components, "hba1c", 8, "high", "HbA1c suggests poorly controlled diabetes.")
        elif hba1c >= 6.5:
            _add_component(components, "hba1c", 4, "moderate", "HbA1c is in the diabetic range.")

    creatinine = _numeric(canonical, "creatinine")
    if creatinine is not None:
        if creatinine >= 2.0:
            _add_component(components, "creatinine", 10, "high", "Creatinine is markedly elevated.")
        elif creatinine >= 1.5:
            _add_component(components, "creatinine", 6, "moderate", "Creatinine is elevated.")

    egfr = _numeric(canonical, "egfr")
    if egfr is not None:
        if egfr < 30:
            _add_component(components, "egfr", 14, "high", "eGFR below 30 suggests advanced kidney impairment.")
        elif egfr < 60:
            _add_component(components, "egfr", 7, "moderate", "eGFR below 60 suggests kidney impairment.")

    wbc = _numeric(canonical, "wbc")
    if wbc is not None:
        if wbc >= 17 or wbc < 3:
            _add_component(components, "wbc", 9, "high", "WBC is severely abnormal.")
        elif wbc > 12 or wbc < 4:
            _add_component(components, "wbc", 5, "moderate", "WBC is abnormal.")

    troponin = _numeric(canonical, "troponin")
    if troponin is not None and troponin > 0.04:
        _add_component(components, "troponin", 18, "critical", "Troponin elevation suggests myocardial injury.")

    lactate = _numeric(canonical, "lactate")
    if lactate is not None:
        if lactate >= 4:
            _add_component(components, "lactate", 16, "critical", "Lactate >= 4 suggests shock or severe sepsis risk.")
        elif lactate >= 2:
            _add_component(components, "lactate", 8, "high", "Lactate elevation is present.")

    for field, label in [
        ("diabetes", "Diabetes documented."),
        ("hypertension", "Hypertension documented."),
        ("copd", "Chronic respiratory disease documented."),
        ("heart_disease", "Heart disease documented."),
        ("kidney_disease", "Kidney disease documented."),
    ]:
        if _truthy(canonical.get(field)):
            _add_component(components, field, 4, "moderate", label)

    critical_text = [
        "cardiac arrest", "respiratory failure", "unconscious", "seizure",
        "septic shock", "stroke", "blue lips", "crushing chest pain",
    ]
    for phrase in critical_text:
        if phrase in text:
            _add_component(components, "critical_keyword", 15, "critical", f"Critical text signal detected: {phrase}.")

    return components


def _disease_risk_scores(canonical: dict[str, Any], text: str) -> dict[str, dict]:
    risks: dict[str, dict] = {}

    def risk(name: str, score: float, drivers: list[str]) -> None:
        risks[name] = {
            "score": _cap_score(score),
            "tier": _score_to_tier(score),
            "drivers": drivers[:8],
        }

    age = _numeric(canonical, "age") or 0
    bmi = _numeric(canonical, "bmi") or 0
    glucose = _numeric(canonical, "glucose")
    hba1c = _numeric(canonical, "hba1c")
    sbp = _numeric(canonical, "systolic_bp")
    spo2 = _numeric(canonical, "spo2")
    rr = _numeric(canonical, "respiratory_rate")
    creatinine = _numeric(canonical, "creatinine")
    egfr = _numeric(canonical, "egfr")
    wbc = _numeric(canonical, "wbc")
    lactate = _numeric(canonical, "lactate")
    troponin = _numeric(canonical, "troponin")

    diabetes_drivers = []
    diabetes_score = 10
    if _truthy(canonical.get("diabetes")):
        diabetes_score += 30
        diabetes_drivers.append("known diabetes")
    if hba1c is not None and hba1c >= 6.5:
        diabetes_score += 30 if hba1c >= 9 else 18
        diabetes_drivers.append("elevated HbA1c")
    if glucose is not None and glucose >= 200:
        diabetes_score += 20 if glucose >= 300 else 12
        diabetes_drivers.append("high glucose")
    if bmi >= 30:
        diabetes_score += 8
        diabetes_drivers.append("BMI >= 30")
    diabetes_drivers.extend(_symptom_hits(text, "diabetes"))
    diabetes_score += 5 * len(_symptom_hits(text, "diabetes"))
    risk("diabetes", diabetes_score, diabetes_drivers)

    cardiac_drivers = []
    cardiac_score = 8 + (10 if age >= 65 else 0)
    if "chest pain" in text or "palpitations" in text:
        cardiac_score += 20
        cardiac_drivers.append("cardiac symptom text")
    if troponin is not None and troponin > 0.04:
        cardiac_score += 35
        cardiac_drivers.append("elevated troponin")
    if sbp is not None and (sbp >= 180 or sbp < 90):
        cardiac_score += 15
        cardiac_drivers.append("high-risk blood pressure")
    if _truthy(canonical.get("heart_disease")):
        cardiac_score += 18
        cardiac_drivers.append("known heart disease")
    if _truthy(canonical.get("smoker")):
        cardiac_score += 6
        cardiac_drivers.append("smoking")
    risk("cardiac", cardiac_score, cardiac_drivers)

    kidney_drivers = []
    kidney_score = 8
    if creatinine is not None and creatinine >= 1.5:
        kidney_score += 24 if creatinine >= 2 else 14
        kidney_drivers.append("elevated creatinine")
    if egfr is not None and egfr < 60:
        kidney_score += 30 if egfr < 30 else 16
        kidney_drivers.append("low eGFR")
    if _truthy(canonical.get("kidney_disease")):
        kidney_score += 22
        kidney_drivers.append("known kidney disease")
    if _truthy(canonical.get("diabetes")) or _truthy(canonical.get("hypertension")):
        kidney_score += 8
        kidney_drivers.append("diabetes/hypertension kidney risk")
    kidney_drivers.extend(_symptom_hits(text, "kidney"))
    kidney_score += 4 * len(_symptom_hits(text, "kidney"))
    risk("kidney", kidney_score, kidney_drivers)

    respiratory_drivers = []
    respiratory_score = 8
    if spo2 is not None and spo2 < 94:
        respiratory_score += 35 if spo2 < 90 else 20
        respiratory_drivers.append("low SpO2")
    if rr is not None and rr >= 24:
        respiratory_score += 18
        respiratory_drivers.append("high respiratory rate")
    if _truthy(canonical.get("copd")):
        respiratory_score += 18
        respiratory_drivers.append("known respiratory disease")
    respiratory_hits = _symptom_hits(text, "respiratory")
    respiratory_drivers.extend(respiratory_hits)
    respiratory_score += 7 * len(respiratory_hits)
    risk("respiratory", respiratory_score, respiratory_drivers)

    stroke_drivers = []
    stroke_score = 5 + (8 if age >= 65 else 0)
    stroke_hits = _symptom_hits(text, "stroke")
    stroke_score += 18 * len(stroke_hits)
    stroke_drivers.extend(stroke_hits)
    if _truthy(canonical.get("hypertension")):
        stroke_score += 8
        stroke_drivers.append("hypertension")
    if "atrial fibrillation" in text or "afib" in text:
        stroke_score += 16
        stroke_drivers.append("atrial fibrillation")
    risk("stroke", stroke_score, stroke_drivers)

    sepsis_drivers = []
    sepsis_score = 5
    if (wbc is not None and (wbc > 12 or wbc < 4)):
        sepsis_score += 16
        sepsis_drivers.append("abnormal WBC")
    if lactate is not None and lactate >= 2:
        sepsis_score += 28 if lactate >= 4 else 16
        sepsis_drivers.append("elevated lactate")
    if sbp is not None and sbp < 100:
        sepsis_score += 14
        sepsis_drivers.append("low systolic BP")
    if rr is not None and rr >= 22:
        sepsis_score += 10
        sepsis_drivers.append("high respiratory rate")
    sepsis_hits = _symptom_hits(text, "sepsis")
    sepsis_score += 8 * len(sepsis_hits)
    sepsis_drivers.extend(sepsis_hits)
    risk("sepsis", sepsis_score, sepsis_drivers)

    return risks


def _rank_departments(text: str, disease_risks: dict[str, dict], components: list[dict]) -> list[dict]:
    scores = Counter()
    for department, keywords in DEPARTMENT_RULES.items():
        for keyword in keywords:
            if keyword in text:
                scores[department] += 2

    disease_to_dept = {
        "cardiac": "Cardiology",
        "respiratory": "Pulmonology",
        "kidney": "Nephrology",
        "diabetes": "Endocrinology",
        "stroke": "Neurology",
        "sepsis": "Emergency",
    }
    for disease, info in disease_risks.items():
        if info["score"] >= 50:
            scores[disease_to_dept[disease]] += 3
        elif info["score"] >= 25:
            scores[disease_to_dept[disease]] += 1

    if any(c["severity"] == "critical" for c in components):
        scores["Emergency"] += 4
    if not scores:
        scores["General Medicine"] = 1

    return [
        {"department": dept, "priority": int(score)}
        for dept, score in scores.most_common(4)
    ]


def _next_tests(disease_risks: dict[str, dict], components: list[dict]) -> list[str]:
    tests = []
    for disease, info in sorted(disease_risks.items(), key=lambda item: item[1]["score"], reverse=True):
        if info["score"] >= 35:
            tests.extend(NEXT_TEST_RULES.get(disease, []))
    if any(c["name"] == "spo2" for c in components):
        tests.append("Continuous pulse oximetry")
    if any(c["name"] == "systolic_bp" for c in components):
        tests.append("Repeat BP and orthostatic vitals")
    return list(dict.fromkeys(tests))[:10]


def _care_plan(tier: str, disease_risks: dict[str, dict], departments: list[dict]) -> list[str]:
    plan = []
    if tier == "Critical":
        plan.append("Immediate clinician review and emergency response activation.")
    elif tier == "High":
        plan.append("Urgent doctor review with increased monitoring.")
    elif tier == "Moderate":
        plan.append("Schedule follow-up review and repeat abnormal vitals/labs.")
    else:
        plan.append("Routine monitoring and preventive counselling.")

    top_diseases = [name for name, info in disease_risks.items() if info["score"] >= 50]
    if "diabetes" in top_diseases:
        plan.append("Review glucose control, diet, medication adherence, and HbA1c follow-up.")
    if "cardiac" in top_diseases:
        plan.append("Evaluate cardiac symptoms urgently and consider ECG/troponin pathway.")
    if "respiratory" in top_diseases:
        plan.append("Assess oxygen requirement and respiratory infection/exacerbation risk.")
    if "kidney" in top_diseases:
        plan.append("Review nephrotoxic medications, hydration status, renal function, and electrolytes.")
    if "stroke" in top_diseases:
        plan.append("Use stroke protocol if focal neurological symptoms are current or recent.")
    if "sepsis" in top_diseases:
        plan.append("Screen for infection source and consider sepsis bundle workflow.")

    if departments:
        plan.append(f"Suggested first referral: {departments[0]['department']}.")
    return plan


def compute_patient_risk_profile(patient: dict[str, Any]) -> dict:
    """
    Build a broad patient risk profile from structured values and free text.

    The output is suitable for dashboards: tier, score, disease risks,
    triage priority, estimated ICU/readmission/mortality probabilities,
    next tests, departments, recommendations, and missing-data warnings.
    """
    canonical = _canonical_record(patient)
    text = _text_blob(patient, canonical)
    components = _base_components(canonical, text)
    base_score = sum(c["score"] for c in components)
    disease_risks = _disease_risk_scores(canonical, text)

    disease_bonus = max((info["score"] for info in disease_risks.values()), default=0) * 0.25
    score = _cap_score(base_score + disease_bonus)
    tier = _score_to_tier(score)

    departments = _rank_departments(text, disease_risks, components)
    missing = _missing_fields(canonical)
    present = _present_fields(canonical)
    confidence = round(max(0.35, min(0.95, 0.35 + 0.06 * len(present) + (0.08 if text else 0))), 2)

    icu_probability = _probability(score + 8 * sum(1 for c in components if c["severity"] == "critical"), center=62)
    readmission_probability = _probability(score + 4 * (_numeric(canonical, "prior_admissions") or 0), center=55)
    mortality_probability = _probability(score + 5 * (1 if (_numeric(canonical, "age") or 0) >= 75 else 0), center=78)
    los_days = round(max(1.0, 1.2 + score / 18 + 5 * icu_probability + 0.6 * (_numeric(canonical, "prior_admissions") or 0)), 1)

    priority = (
        "P1 - immediate" if tier == "Critical" or icu_probability >= 0.65 else
        "P2 - urgent" if tier == "High" else
        "P3 - soon" if tier == "Moderate" else
        "P4 - routine"
    )

    uncertainty_reasons = []
    if confidence < 0.65:
        uncertainty_reasons.append("limited clinical fields available")
    for threshold in (25, 50, 75):
        if abs(score - threshold) <= 4:
            uncertainty_reasons.append("risk score is close to a tier boundary")
            break

    alerts = [
        {"severity": c["severity"], "message": c["message"], "source": c["name"]}
        for c in components
        if c["severity"] in {"high", "critical"}
    ]

    top_drivers = sorted(components, key=lambda c: c["score"], reverse=True)[:6]
    tests = _next_tests(disease_risks, components)
    care_plan = _care_plan(tier, disease_risks, departments)

    patient_id = patient.get("patient_id") or patient.get("id") or patient.get("_id")
    return {
        "patient_id": str(patient_id) if patient_id is not None else None,
        "overall_risk_score": score,
        "risk_tier": tier,
        "triage_priority": priority,
        "confidence": confidence,
        "top_risk_drivers": top_drivers,
        "disease_specific_risks": disease_risks,
        "probabilities": {
            "icu_admission": icu_probability,
            "readmission": readmission_probability,
            "mortality": mortality_probability,
        },
        "estimated_length_of_stay_days": los_days,
        "recommended_departments": departments,
        "recommended_next_tests": tests,
        "care_plan": care_plan,
        "alerts": alerts[:10],
        "doctor_review": {
            "required": tier in {"High", "Critical"} or bool(uncertainty_reasons),
            "reasons": uncertainty_reasons or [f"{tier} risk tier"],
        },
        "data_quality": {
            "present_fields": present,
            "missing_fields": missing,
            "completeness": round(len(present) / len(KEY_CLINICAL_FIELDS), 2),
        },
        "patient_friendly_summary": _patient_summary(tier, score, top_drivers, departments),
    }


def _patient_summary(tier: str, score: float, drivers: list[dict], departments: list[dict]) -> str:
    driver_text = ", ".join(d["name"] for d in drivers[:3]) if drivers else "available clinical information"
    dept = departments[0]["department"] if departments else "General Medicine"
    return (
        f"Current risk is {tier} with score {score}. Main signals: {driver_text}. "
        f"Suggested review route: {dept}."
    )


def population_risk_intelligence(patients: list[dict[str, Any]]) -> dict:
    """Analyze a cohort for dashboard, review queue, fairness, and workload views."""
    profiles = [compute_patient_risk_profile(p) for p in patients]
    tier_counts = Counter(p["risk_tier"] for p in profiles)

    critical_alerts = [
        {
            "patient_id": p["patient_id"],
            "risk_tier": p["risk_tier"],
            "triage_priority": p["triage_priority"],
            "alerts": p["alerts"][:3],
        }
        for p in profiles
        if p["risk_tier"] == "Critical" or p["triage_priority"].startswith("P1")
    ]

    department_counts = Counter()
    for profile in profiles:
        if profile["recommended_departments"]:
            department_counts[profile["recommended_departments"][0]["department"]] += 1

    review_queue = sorted(
        [
            {
                "patient_id": p["patient_id"],
                "risk_tier": p["risk_tier"],
                "score": p["overall_risk_score"],
                "priority": p["triage_priority"],
                "reason": p["top_risk_drivers"][0]["message"] if p["top_risk_drivers"] else "review suggested",
            }
            for p in profiles
            if p["doctor_review"]["required"]
        ],
        key=lambda item: item["score"],
        reverse=True,
    )

    return {
        "count": len(profiles),
        "patients": profiles,
        "risk_distribution": dict(tier_counts),
        "critical_alerts": critical_alerts,
        "doctor_review_queue": review_queue,
        "department_workload": dict(department_counts),
        "hospital_workload_forecast": {
            "expected_icu_cases": sum(1 for p in profiles if p["probabilities"]["icu_admission"] >= 0.5),
            "expected_high_risk_cases": sum(1 for p in profiles if p["risk_tier"] in {"High", "Critical"}),
            "average_estimated_los_days": round(
                sum(p["estimated_length_of_stay_days"] for p in profiles) / max(len(profiles), 1),
                2,
            ),
        },
        "fairness_checks": _fairness_checks(patients, profiles),
        "data_quality": _cohort_data_quality(profiles),
    }


def _age_group(age: float | None) -> str:
    if age is None:
        return "unknown"
    if age < 18:
        return "0-17"
    if age < 40:
        return "18-39"
    if age < 65:
        return "40-64"
    return "65+"


def _fairness_checks(raw_patients: list[dict[str, Any]], profiles: list[dict]) -> dict:
    groups: dict[str, list[float]] = defaultdict(list)
    gender_groups: dict[str, list[float]] = defaultdict(list)

    for raw, profile in zip(raw_patients, profiles):
        canonical = _canonical_record(raw)
        groups[_age_group(_numeric(canonical, "age"))].append(profile["overall_risk_score"])
        gender = str(canonical.get("gender", "unknown")).strip().lower() or "unknown"
        gender_groups[gender].append(profile["overall_risk_score"])

    return {
        "age_groups": _group_summary(groups),
        "gender_groups": _group_summary(gender_groups),
        "note": "Compare score distributions for review; this is a monitoring signal, not proof of fairness or bias.",
    }


def _group_summary(groups: dict[str, list[float]]) -> dict:
    summary = {}
    for group, scores in groups.items():
        summary[group] = {
            "count": len(scores),
            "average_score": round(sum(scores) / len(scores), 2) if scores else 0,
            "high_or_critical_rate": round(sum(1 for s in scores if s >= 50) / len(scores), 3) if scores else 0,
        }
    return summary


def _cohort_data_quality(profiles: list[dict]) -> dict:
    if not profiles:
        return {"average_completeness": 0, "commonly_missing_fields": []}
    missing_counts = Counter()
    for profile in profiles:
        missing_counts.update(profile["data_quality"]["missing_fields"])
    return {
        "average_completeness": round(
            sum(p["data_quality"]["completeness"] for p in profiles) / len(profiles),
            2,
        ),
        "commonly_missing_fields": [
            {"field": field, "missing_count": count}
            for field, count in missing_counts.most_common(8)
        ],
    }


def compare_patient_visits(previous: dict[str, Any], current: dict[str, Any]) -> dict:
    """Compare two visits for risk trend and escalation/de-escalation signals."""
    prev_profile = compute_patient_risk_profile(previous)
    curr_profile = compute_patient_risk_profile(current)
    delta = round(curr_profile["overall_risk_score"] - prev_profile["overall_risk_score"], 2)
    trend = "worsening" if delta >= 5 else "improving" if delta <= -5 else "stable"
    return {
        "previous": prev_profile,
        "current": curr_profile,
        "risk_delta": delta,
        "trend": trend,
        "summary": (
            f"Risk is {trend}: {prev_profile['risk_tier']} ({prev_profile['overall_risk_score']}) "
            f"to {curr_profile['risk_tier']} ({curr_profile['overall_risk_score']})."
        ),
    }


def build_patient_timeline(events: list[dict[str, Any]]) -> dict:
    """Create a risk timeline from dated visits, notes, or vital snapshots."""
    def parse_date(event: dict[str, Any]) -> datetime:
        raw = event.get("date") or event.get("timestamp") or event.get("time") or ""
        for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y"):
            try:
                return datetime.strptime(str(raw)[:19], fmt)
            except ValueError:
                continue
        return datetime.min

    ordered = sorted(events, key=parse_date)
    timeline = []
    for event in ordered:
        profile = compute_patient_risk_profile(event)
        timeline.append({
            "date": str(event.get("date") or event.get("timestamp") or event.get("time") or ""),
            "risk_score": profile["overall_risk_score"],
            "risk_tier": profile["risk_tier"],
            "top_driver": profile["top_risk_drivers"][0]["name"] if profile["top_risk_drivers"] else None,
            "summary": profile["patient_friendly_summary"],
        })

    trend = "insufficient_data"
    if len(timeline) >= 2:
        delta = timeline[-1]["risk_score"] - timeline[0]["risk_score"]
        trend = "worsening" if delta >= 5 else "improving" if delta <= -5 else "stable"

    return {
        "timeline": timeline,
        "trend": trend,
        "events": len(timeline),
    }


def find_similar_patients(patient: dict[str, Any], candidates: list[dict[str, Any]], top_k: int = 5) -> dict:
    """Find clinically similar patients using normalized shared numeric fields."""
    target = _canonical_record(patient)
    target_vals = {field: _numeric(target, field) for field in KEY_CLINICAL_FIELDS}
    target_vals = {field: val for field, val in target_vals.items() if val is not None}

    scored = []
    for candidate in candidates:
        cand = _canonical_record(candidate)
        distances = []
        for field, val in target_vals.items():
            other = _numeric(cand, field)
            if other is None:
                continue
            scale = max(abs(val), abs(other), 1.0)
            distances.append(abs(val - other) / scale)
        if not distances:
            continue
        distance = sum(distances) / len(distances)
        profile = compute_patient_risk_profile(candidate)
        scored.append({
            "patient_id": profile["patient_id"],
            "similarity": round(max(0.0, 1.0 - distance), 3),
            "risk_tier": profile["risk_tier"],
            "shared_fields": len(distances),
            "patient": candidate,
        })

    return {
        "matches": sorted(scored, key=lambda item: item["similarity"], reverse=True)[:top_k],
        "top_k": top_k,
    }
