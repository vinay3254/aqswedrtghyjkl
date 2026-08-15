from automl.supervised import train_predictive_model
from nlp.notes_analyzer import analyze_clinical_notes
from risk.advanced_risk import (
    compare_patient_visits,
    compute_patient_risk_profile,
    population_risk_intelligence,
)


def test_nlp_extracts_symptoms_negation_and_triage_fields():
    note = (
        "Chief complaint: severe SOB for 2 days. Denies chest pain. "
        "SpO2 88%. Patient has pnuemonia and is worsening. "
        "Medication: aspirin 75mg daily."
    )

    result = analyze_clinical_notes(note)

    symptoms = {item["symptom"]: item for item in result["symptoms"]}
    assert "breathlessness" in symptoms
    assert symptoms["breathlessness"]["severity"] == "severe"
    assert symptoms["breathlessness"]["duration"] is not None
    assert symptoms["chest pain"]["negated"] is True
    assert result["spell_corrections"][0]["to"] == "pneumonia"
    assert result["emergency_flags"]
    assert result["recommended_departments"][0]["department"] in {"Emergency", "Pulmonology"}
    assert result["structured_record"]["risk_tier"] in {"High", "Critical"}


def test_advanced_risk_profile_and_population_dashboard():
    patient = {
        "patient_id": "p1",
        "age": 72,
        "systolic_bp": 86,
        "heart_rate": 132,
        "respiratory_rate": 30,
        "spo2": 88,
        "glucose": 260,
        "notes": "Severe breathlessness and fever with suspected pneumonia.",
    }

    profile = compute_patient_risk_profile(patient)
    assert profile["risk_tier"] == "Critical"
    assert profile["triage_priority"].startswith("P1")
    assert profile["probabilities"]["icu_admission"] > 0.5
    assert profile["recommended_next_tests"]

    population = population_risk_intelligence([
        patient,
        {"patient_id": "p2", "age": 28, "heart_rate": 72, "systolic_bp": 118, "spo2": 98},
    ])
    assert population["critical_alerts"]
    assert population["hospital_workload_forecast"]["expected_high_risk_cases"] >= 1
    assert "fairness_checks" in population


def test_visit_comparison_detects_worsening():
    previous = {"patient_id": "p1", "age": 70, "heart_rate": 82, "systolic_bp": 122, "spo2": 97}
    current = {"patient_id": "p1", "age": 70, "heart_rate": 128, "systolic_bp": 92, "spo2": 89}

    result = compare_patient_visits(previous, current)

    assert result["trend"] == "worsening"
    assert result["risk_delta"] > 0


def test_supervised_automl_classification_baseline():
    rows = []
    for i in range(16):
        high = i >= 8
        rows.append({
            "patient_id": f"p{i}",
            "age": 70 + i if high else 25 + i,
            "heart_rate": 112 + i if high else 68 + i,
            "spo2": 90 if high else 98,
            "risk_label": "High" if high else "Low",
        })

    result = train_predictive_model(rows, target="risk_label")

    assert result["task"] == "classification"
    assert result["best_model"]
    assert result["leaderboard"]
    assert result["feature_importance"] is not None


def test_news2_score_calculation():
    from forecasting.vitals_forecaster import calculate_news2
    # Alert, respiratory rate 12-20, oxygen saturation Scale 1 >=96, no air or oxygen, systolic 111-219, pulse 51-90, temp 36.1-38.0
    res_low = calculate_news2({
        "respiratory_rate": 15,
        "spo2": 98,
        "spo2_scale": 1,
        "air_or_oxygen": 0,
        "systolic_bp": 120,
        "heart_rate": 72,
        "consciousness": 0,
        "temperature": 36.5
    })
    assert res_low["news2_score"] == 0
    assert res_low["alert_level"] == "low"

    # All extreme values (3 points each + 2 for oxygen therapy = 20 points total)
    res_high = calculate_news2({
        "respiratory_rate": 30,       # 3
        "spo2": 88,                   # 3 (Scale 1 <=91)
        "spo2_scale": 1,
        "air_or_oxygen": 1,           # 2
        "systolic_bp": 85,            # 3 (<=90)
        "heart_rate": 135,            # 3 (>=131)
        "consciousness": 3,           # 3
        "temperature": 39.5           # 3
    })
    assert res_high["news2_score"] == 20
    assert res_high["alert_level"] == "high"

