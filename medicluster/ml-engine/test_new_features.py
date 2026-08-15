"""Quick functional test for all new ML/NLP modules."""
import numpy as np
import sys

if "pytest" in sys.modules and __name__ != "__main__":
    import pytest
    pytest.skip(
        "Script-style functional test; run with `python test_new_features.py`.",
        allow_module_level=True,
    )

print("=== Functional Tests ===")
passed = 0
failed = 0

def ok(label, detail=""):
    global passed
    passed += 1
    print(f"[PASS] {label}" + (f" — {detail}" if detail else ""))

def fail(label, err):
    global failed
    failed += 1
    print(f"[FAIL] {label}: {err}")

# Test 1: MEWS Score
try:
    from forecasting.vitals_forecaster import calculate_mews
    mews = calculate_mews({"heart_rate": 115, "systolic_bp": 85, "respiratory_rate": 24, "temperature": 38.7})
    ok("MEWS Score", f"score={mews['mews_score']}, level={mews['alert_level']}")
except Exception as e:
    fail("MEWS Score", e)

# Test 2: Isolation Forest
try:
    from anomaly.isolation_forest import detect_anomalies
    X = np.random.randn(50, 4)
    X[0] = [10, 10, 10, 10]
    result = detect_anomalies(X, ["age", "bp", "hr", "temp"])
    ok("Isolation Forest", f"anomalies={result['anomaly_count']}, patient_0_flagged={result['anomaly_flags'][0]}")
except Exception as e:
    fail("Isolation Forest", e)

# Test 3: Optimal-K
try:
    from automl.feature_selector import find_optimal_k
    X2 = np.random.randn(100, 5)
    ok_res = find_optimal_k(X2)
    ok("Optimal-K", f"recommended={ok_res['recommended_k']}, elbow={ok_res['elbow_k']}, sil={ok_res['silhouette_k']}")
except Exception as e:
    fail("Optimal-K", e)

# Test 4: UMAP
try:
    from automl.feature_selector import compute_umap
    X2 = np.random.randn(100, 5)
    umap_res = compute_umap(X2)
    ok("UMAP", f"{len(umap_res['coords'])} points via {umap_res['method']}")
except Exception as e:
    fail("UMAP", e)

# Test 5: Feature Ranking
try:
    from automl.feature_selector import rank_features
    labels = np.array([0]*50 + [1]*50)
    ranked = rank_features(X2, labels, ["a","b","c","d","e"])
    ok("Feature Ranking", f"top={ranked['top_risk_features']}")
except Exception as e:
    fail("Feature Ranking", e)

# Test 6: NLP Notes
try:
    from nlp.notes_analyzer import analyze_clinical_notes
    note = "Patient admitted with acute pneumonia and severe dyspnea. Heart rate 115 bpm. On amoxicillin and furosemide. Condition deteriorating."
    nlp_res = analyze_clinical_notes(note)
    ok("NLP Notes", f"tier={nlp_res['risk_tier']}, trajectory={nlp_res['trajectory']}, drugs={nlp_res['drugs']}")
except Exception as e:
    fail("NLP Notes", e)

# Test 7: Drug Interactions
try:
    from chatbot.rag_assistant import check_drug_interactions
    di = check_drug_interactions(["warfarin", "aspirin", "metformin"])
    ok("Drug Interactions", f"found={len(di['interactions'])}, major={di['has_major_interaction']}")
except Exception as e:
    fail("Drug Interactions", e)

# Test 8: Vital Forecasting (linear)
try:
    from forecasting.vitals_forecaster import forecast_vitals
    fres = forecast_vitals({"heart_rate": [70, 72, 75, 78, 82, 86]}, steps=3, method="linear")
    fc = fres["forecasts"]["heart_rate"]["forecasts"]
    ok("Vital Forecasting", f"HR next 3: {fc}, deterioration={fres['deterioration_risk']}")
except Exception as e:
    fail("Vital Forecasting", e)

# Test 9: RAG Chatbot index + query
try:
    from chatbot.rag_assistant import update_patient_index, answer_query
    patients = [
        {"patient_id": "p1", "cluster_id": 0, "risk_tier": "High", "age": 65, "heart_rate": 110},
        {"patient_id": "p2", "cluster_id": 1, "risk_tier": "Low",  "age": 35, "heart_rate": 72},
        {"patient_id": "p3", "cluster_id": 0, "risk_tier": "High", "age": 72, "heart_rate": 105},
    ]
    update_patient_index(patients)
    ans = answer_query("Which High Risk patients have age over 60?")
    ok("RAG Chatbot", f"matched={ans['matched_count']}, answer='{ans['answer'][:60]}...'")
except Exception as e:
    fail("RAG Chatbot", e)

# Test 10: SHAP
try:
    from explainability.shap_explainer import compute_shap_values
    X3 = np.random.randn(60, 4)
    labels3 = np.array([0]*30 + [1]*30)
    shap_res = compute_shap_values(X3, labels3, ["age","bp","hr","temp"])
    ok("SHAP Explainability", f"top_feature={shap_res['global_importance'][0]['feature']}, shap_ok={shap_res['shap_available']}")
except Exception as e:
    fail("SHAP Explainability", e)

# Test 11: NEWS2 Score
try:
    from forecasting.vitals_forecaster import calculate_news2
    # Alert, respiratory rate 12-20, oxygen saturation Scale 1 >=96, no air or oxygen, systolic 111-219, pulse 51-90, temp 36.1-38.0
    news2_low = calculate_news2({
        "respiratory_rate": 15,
        "spo2": 98,
        "spo2_scale": 1,
        "air_or_oxygen": 0,
        "systolic_bp": 120,
        "heart_rate": 72,
        "consciousness": 0,
        "temperature": 36.5
    })
    # Respiratory rate >=25 (3), SpO2 scale 1 <=91 (3), on oxygen (2), systolic <=90 (3), pulse >=131 (3), temp >=39.1 (3), unconscious (3)
    news2_high = calculate_news2({
        "respiratory_rate": 30,
        "spo2": 88,
        "spo2_scale": 1,
        "air_or_oxygen": 1,
        "systolic_bp": 85,
        "heart_rate": 135,
        "consciousness": 3,
        "temperature": 39.5
    })
    ok("NEWS2 Score", f"low_score={news2_low['news2_score']} ({news2_low['alert_level']}), high_score={news2_high['news2_score']} ({news2_high['alert_level']})")
except Exception as e:
    fail("NEWS2 Score", e)

print()
print(f"=== Results: {passed} passed, {failed} failed ===")
sys.exit(0 if failed == 0 else 1)
