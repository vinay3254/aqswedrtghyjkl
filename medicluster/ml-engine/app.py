"""
ml-engine/app.py
Flask API server for the MediCluster ML engine.
Dashboard: GET / → api_tester.html

Core Endpoints:
  POST /cluster             — Run clustering on patient data
  GET  /health              — Health check
  POST /preprocess-preview  — Return preprocessing stats preview

ML / AutoML Endpoints:
  POST /optimal-k           — Auto-select best cluster count (Elbow + Silhouette sweep)
  POST /feature-importance  — Rank features by discriminative power (MI + ANOVA)
  POST /reduce-dimensions   — UMAP / t-SNE dimensionality reduction alternatives
  POST /detect-anomalies    — Isolation Forest anomaly detection
  POST /explain             — SHAP feature importance and per-patient explanations

NLP Endpoints:
  POST /analyze-notes       — Clinical notes NLP: NER, ICD-10, trajectory, summary
  POST /drug-interactions   — Check drug interaction safety

Forecasting Endpoints:
  POST /forecast-vitals     — LSTM / Prophet vital signs forecasting + MEWS score

Imaging Endpoints:
  GET  /models              — List available X-ray analysis models
  POST /analyze-image       — Chest X-ray pathology detection
  POST /gradcam             — Grad-CAM heatmap visualization

Chatbot Endpoints:
  POST /ask                 — Natural-language patient Q&A (RAG)
"""

import os
import traceback
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from preprocessing.pipeline import preprocess
from clustering.kmeans import run_kmeans
from clustering.dbscan import run_dbscan
from clustering.hierarchical import run_hierarchical
from clustering.gmm import run_gmm
from evaluation.metrics import compute_metrics
from utils.risk_labeler import label_risk_tiers

# New ML/NLP modules
from explainability.shap_explainer import compute_shap_values
from anomaly.isolation_forest import detect_anomalies
from automl.feature_selector import find_optimal_k, rank_features, compute_umap, compute_tsne
from nlp.notes_analyzer import analyze_clinical_notes
from forecasting.vitals_forecaster import forecast_vitals, calculate_mews
from chatbot.rag_assistant import answer_query, check_drug_interactions, update_patient_index

app = Flask(__name__)
CORS(app)  # Allow requests from Node backend and frontend

_HERE = os.path.dirname(os.path.abspath(__file__))

@app.route("/", methods=["GET"])
def dashboard():
    """Serve the interactive API tester dashboard."""
    return send_from_directory(_HERE, "api_tester.html")


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _safe_list(arr):
    """Convert numpy arrays / None to JSON-serialisable Python types."""
    if arr is None:
        return None
    if isinstance(arr, np.ndarray):
        return arr.tolist()
    return arr


def _preprocessing_warnings(report: dict) -> list[str]:
    """Turn preprocessing stats into user-facing warnings."""
    warnings = []
    dropped_rows = report.get("dropped_rows", 0)
    dropped_columns = report.get("dropped_non_numeric_columns", [])

    if dropped_rows:
        warnings.append(
            f"Preprocessing removed {dropped_rows} row(s) as outliers."
        )

    if dropped_columns:
        names = ", ".join(dropped_columns)
        warnings.append(
            f"Preprocessing ignored non-numeric column(s): {names}."
        )

    return warnings


def _run_algorithm(X, algorithm: str, params: dict) -> dict:
    """Dispatch to the requested clustering algorithm and return raw result."""
    algo = algorithm.lower()
    if algo == "kmeans":
        k = int(params.get("k", 4))
        init = params.get("init", "k-means++")
        return {**run_kmeans(X, k=k, init=init), "algorithm": "kmeans"}

    elif algo == "dbscan":
        eps = float(params.get("eps", 0.5))
        min_samples = int(params.get("min_samples", 5))
        return {**run_dbscan(X, eps=eps, min_samples=min_samples), "algorithm": "dbscan"}

    elif algo == "hierarchical":
        n_clusters = int(params.get("n_clusters", 4))
        lnk = params.get("linkage", "ward")
        return {**run_hierarchical(X, n_clusters=n_clusters, linkage=lnk), "algorithm": "hierarchical"}

    elif algo == "gmm":
        n_components = int(params.get("n_components", 4))
        cov_type = params.get("covariance_type", "full")
        return {**run_gmm(X, n_components=n_components, covariance_type=cov_type), "algorithm": "gmm"}

    else:
        raise ValueError(f"Unknown algorithm: {algorithm}")


def _build_response(
    result,
    cleaned_df,
    X_scaled,
    pca_coords,
    feature_names,
    scaler,
    params,
    preprocessing_report,
):
    """Build the standard JSON response for a single algorithm result."""
    labels = np.array(result["labels"])
    centroids = result.get("centroids")
    probabilities = result.get("probabilities")  # GMM only
    linkage_matrix = result.get("linkage_matrix")
    algorithm = result.get("algorithm", "unknown")

    # Compute evaluation metrics
    metrics = compute_metrics(X_scaled, labels)

    # Determine cluster centroids / means for risk labelling
    if centroids is None:
        # DBSCAN: compute cluster means from data
        unique_labels = [l for l in np.unique(labels) if l != -1]
        centroids_for_risk = np.array(
            [X_scaled[labels == cid].mean(axis=0) for cid in unique_labels]
        ) if unique_labels else np.zeros((0, X_scaled.shape[1]))
    else:
        centroids_for_risk = np.array(centroids)

    # Label risk tiers per cluster
    risk_map = label_risk_tiers(
        labels,
        centroids_for_risk,
        feature_names,
        scaler,
        risk_feature_weights=params.get("risk_feature_weights"),
    )

    # Build per-patient output
    patients_out = []
    id_col = cleaned_df.get("patient_id", pd.Series(range(len(cleaned_df))))

    for i in range(len(labels)):
        cid = int(labels[i])
        risk_tier = risk_map.get(cid, "Unknown")

        record = {
            "patient_id": str(id_col.iloc[i]) if hasattr(id_col, "iloc") else str(i),
            "cluster_id": cid,
            "risk_tier": risk_tier,
            "pca_x": float(pca_coords[i, 0]),
            "pca_y": float(pca_coords[i, 1]),
        }

        # GMM soft probabilities
        if probabilities is not None:
            record["gmm_probabilities"] = [float(p) for p in probabilities[i]]

        # Include raw feature values for tooltip / table
        for feat in feature_names:
            if feat in cleaned_df.columns:
                record[feat] = float(cleaned_df[feat].iloc[i])

        patients_out.append(record)

    # Risk distribution summary
    risk_dist = {}
    for tier in ["Low", "Moderate", "High", "Critical", "Noise"]:
        count = sum(1 for p in patients_out if p["risk_tier"] == tier)
        if count:
            risk_dist[tier] = count

    # Cluster profiles
    unique_clusters = sorted([c for c in np.unique(labels) if c != -1])
    cluster_profiles = []
    for cid in unique_clusters:
        cluster_mask = labels == cid
        cluster_df = cleaned_df[cluster_mask]
        centroid_features = {}
        for feat in feature_names:
            if feat in cluster_df.columns:
                centroid_features[feat] = round(float(cluster_df[feat].mean()), 3)

        cluster_profiles.append({
            "cluster_id": int(cid),
            "risk_tier": risk_map.get(cid, "Unknown"),
            "size": int(cluster_mask.sum()),
            "centroid_features": centroid_features,
        })

    response = {
        "patients": patients_out,
        "metrics": metrics,
        "risk_distribution": risk_dist,
        "cluster_profiles": cluster_profiles,
        "algorithm": algorithm,
        "feature_names": feature_names,
        "preprocessing": preprocessing_report,
        "warnings": _preprocessing_warnings(preprocessing_report),
    }

    if linkage_matrix is not None:
        response["linkage_matrix"] = _safe_list(linkage_matrix)

    return response


# ─────────────────────────────────────────────────────────────────────────────
# Core Routes (unchanged)
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "service": "medicluster-ml-engine"})


@app.route("/preprocess-preview", methods=["POST"])
def preprocess_preview():
    """
    Accept JSON: { data: [...patient rows...] }
    Returns basic stats: row count, feature names, per-column stats.
    """
    body = request.get_json(force=True)
    data = body.get("data", [])

    if not data:
        return jsonify({"error": "No data provided"}), 400

    df = pd.DataFrame(data)
    try:
        cleaned_df, X_scaled, pca_coords, feature_names, scaler, report = preprocess(
            df,
            return_report=True,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 422

    stats = {}
    for feat in feature_names:
        col = cleaned_df[feat]
        stats[feat] = {
            "mean": round(float(col.mean()), 3),
            "std": round(float(col.std()), 3),
            "min": round(float(col.min()), 3),
            "max": round(float(col.max()), 3),
        }

    return jsonify({
        "row_count": len(cleaned_df),
        "feature_names": feature_names,
        "feature_stats": stats,
        "preprocessing": report,
        "warnings": _preprocessing_warnings(report),
    })


@app.route("/cluster", methods=["POST"])
def cluster():
    """
    Main clustering endpoint.

    Body: {
        data: [...patient rows...],
        algorithm: "kmeans" | "dbscan" | "hierarchical" | "gmm" | "all",
        params: { k, eps, min_samples, n_clusters, linkage, n_components, covariance_type },
        include_shap: bool (optional, adds SHAP explanations),
        include_anomalies: bool (optional, adds anomaly flags),
    }
    """
    body = request.get_json(force=True)
    data = body.get("data", [])
    algorithm = body.get("algorithm", "kmeans")
    params = body.get("params", {})
    include_shap = bool(body.get("include_shap", False))
    include_anomalies = bool(body.get("include_anomalies", False))

    if not data:
        return jsonify({"error": "No patient data provided"}), 400

    df = pd.DataFrame(data)

    try:
        cleaned_df, X_scaled, pca_coords, feature_names, scaler, report = preprocess(
            df,
            return_report=True,
        )
    except Exception as e:
        return jsonify({"error": f"Preprocessing failed: {e}"}), 422

    if algorithm.lower() == "all":
        algos = ["kmeans", "dbscan", "hierarchical", "gmm"]
        results = {}
        for algo in algos:
            try:
                raw = _run_algorithm(X_scaled, algo, params)
                results[algo] = _build_response(
                    raw, cleaned_df, X_scaled, pca_coords,
                    feature_names, scaler, params, report,
                )
            except Exception as e:
                results[algo] = {"error": str(e)}

        response = {
            "all": results,
            "algorithm": "all",
            "feature_names": feature_names,
            "preprocessing": report,
            "warnings": _preprocessing_warnings(report),
        }

    else:
        try:
            raw = _run_algorithm(X_scaled, algorithm, params)
            response = _build_response(
                raw, cleaned_df, X_scaled, pca_coords,
                feature_names, scaler, params, report,
            )
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": f"Clustering failed: {e}"}), 500

    # Optional: SHAP explanations
    if include_shap and "patients" in response:
        try:
            labels = np.array([p["cluster_id"] for p in response["patients"]])
            response["shap"] = compute_shap_values(X_scaled, labels, feature_names)
        except Exception as e:
            response["shap"] = {"error": str(e)}

    # Optional: Anomaly detection
    if include_anomalies:
        try:
            response["anomalies"] = detect_anomalies(X_scaled, feature_names)
        except Exception as e:
            response["anomalies"] = {"error": str(e)}

    # Auto-update patient index for chatbot
    if "patients" in response:
        try:
            update_patient_index(response["patients"])
        except Exception:
            pass

    return jsonify(response)


# ─────────────────────────────────────────────────────────────────────────────
# AutoML Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/optimal-k", methods=["POST"])
def optimal_k():
    """
    Auto-select the best number of clusters using Elbow + Silhouette sweep.

    Body: { data: [...], k_min: int (default 2), k_max: int (default 10) }
    Returns: { recommended_k, sweep, elbow_k, silhouette_k, rationale }
    """
    body = request.get_json(force=True)
    data = body.get("data", [])
    k_min = int(body.get("k_min", 2))
    k_max = int(body.get("k_max", 10))

    if not data:
        return jsonify({"error": "No data provided"}), 400

    df = pd.DataFrame(data)
    try:
        _, X_scaled, _, _, _, _ = preprocess(df, return_report=True)
    except Exception as e:
        return jsonify({"error": f"Preprocessing failed: {e}"}), 422

    try:
        result = find_optimal_k(X_scaled, k_range=range(k_min, k_max + 1))
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/feature-importance", methods=["POST"])
def feature_importance():
    """
    Rank features by discriminative power across clusters.

    Body: { data: [...], algorithm: str, params: {} }
    Returns: { ranked_features, top_risk_features }
    """
    body = request.get_json(force=True)
    data = body.get("data", [])
    algorithm = body.get("algorithm", "kmeans")
    params = body.get("params", {})

    if not data:
        return jsonify({"error": "No data provided"}), 400

    df = pd.DataFrame(data)
    try:
        cleaned_df, X_scaled, pca_coords, feature_names, scaler, report = preprocess(df, return_report=True)
    except Exception as e:
        return jsonify({"error": f"Preprocessing failed: {e}"}), 422

    try:
        raw = _run_algorithm(X_scaled, algorithm, params)
        labels = np.array(raw["labels"])
        result = rank_features(X_scaled, labels, feature_names)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/reduce-dimensions", methods=["POST"])
def reduce_dimensions():
    """
    Compute UMAP or t-SNE 2D coordinates for patient scatter plot.

    Body: {
        data: [...],
        method: "umap" | "tsne" | "pca",
        params: { n_neighbors, min_dist, perplexity }
    }
    Returns: { method, coords: [[x, y], ...] }
    """
    body = request.get_json(force=True)
    data = body.get("data", [])
    method = body.get("method", "umap").lower()
    params = body.get("params", {})

    if not data:
        return jsonify({"error": "No data provided"}), 400

    df = pd.DataFrame(data)
    try:
        _, X_scaled, pca_coords, _, _, _ = preprocess(df, return_report=True)
    except Exception as e:
        return jsonify({"error": f"Preprocessing failed: {e}"}), 422

    try:
        if method == "umap":
            result = compute_umap(
                X_scaled,
                n_neighbors=int(params.get("n_neighbors", 15)),
                min_dist=float(params.get("min_dist", 0.1)),
            )
        elif method == "tsne":
            result = compute_tsne(
                X_scaled,
                perplexity=float(params.get("perplexity", 30.0)),
            )
        else:
            result = {
                "method": "pca",
                "coords": [[round(float(r[0]), 4), round(float(r[1]), 4)] for r in pca_coords],
            }
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/detect-anomalies", methods=["POST"])
def anomaly_detection():
    """
    Detect statistically unusual patients using Isolation Forest.

    Body: { data: [...], contamination: float (default 0.05) }
    Returns: { anomaly_flags, anomaly_scores, anomaly_count, feature_contributions }
    """
    body = request.get_json(force=True)
    data = body.get("data", [])
    contamination = float(body.get("contamination", 0.05))

    if not data:
        return jsonify({"error": "No data provided"}), 400

    df = pd.DataFrame(data)
    try:
        _, X_scaled, _, feature_names, _, _ = preprocess(df, return_report=True)
    except Exception as e:
        return jsonify({"error": f"Preprocessing failed: {e}"}), 422

    try:
        result = detect_anomalies(X_scaled, feature_names, contamination=contamination)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/explain", methods=["POST"])
def explain():
    """
    SHAP feature explanations — global importance + per-patient top drivers.

    Body: { data: [...], algorithm: str, params: {} }
    Returns: { global_importance, per_patient, shap_available }
    """
    body = request.get_json(force=True)
    data = body.get("data", [])
    algorithm = body.get("algorithm", "kmeans")
    params = body.get("params", {})

    if not data:
        return jsonify({"error": "No data provided"}), 400

    df = pd.DataFrame(data)
    try:
        _, X_scaled, _, feature_names, _, _ = preprocess(df, return_report=True)
    except Exception as e:
        return jsonify({"error": f"Preprocessing failed: {e}"}), 422

    try:
        raw = _run_algorithm(X_scaled, algorithm, params)
        labels = np.array(raw["labels"])
        result = compute_shap_values(X_scaled, labels, feature_names)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# NLP Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/analyze-notes", methods=["POST"])
def analyze_notes():
    """
    Analyze free-text clinical notes with NLP.

    Body: { notes: str } or { notes: [str, ...] } (batch)
    Returns: { trajectory, risk_tier, risk_keywords, entities,
               drugs, lab_values, icd10_suggestions, summary }
    """
    body = request.get_json(force=True)
    notes_input = body.get("notes", "")

    if isinstance(notes_input, list):
        # Batch mode
        results = []
        for note in notes_input:
            results.append(analyze_clinical_notes(str(note)))
        return jsonify({"results": results, "count": len(results)})

    notes = str(notes_input).strip()
    if not notes:
        return jsonify({"error": "No notes provided"}), 400

    try:
        result = analyze_clinical_notes(notes)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/drug-interactions", methods=["POST"])
def drug_interactions():
    """
    Check a medication list for dangerous drug-drug interactions.

    Body: { medications: [str, ...] }
    Returns: { interactions, has_major_interaction, summary }
    """
    body = request.get_json(force=True)
    medications = body.get("medications", [])

    if not medications:
        return jsonify({"error": "No medications provided"}), 400

    try:
        result = check_drug_interactions(medications)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Forecasting Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/forecast-vitals", methods=["POST"])
def forecast_vitals_endpoint():
    """
    Forecast vital signs from sequential historical readings.

    Body: {
        vitals_history: {
            "heart_rate":      [72, 75, 78, ...],
            "systolic_bp":     [120, 118, ...],
            "respiratory_rate":[16, 17, ...],
            "temperature":     [36.8, 37.1, ...],
            "spo2":            [98, 97, ...]
        },
        steps: int (default 3),
        method: "auto" | "lstm" | "prophet" | "linear"
    }
    Returns: { forecasts, mews_latest, deterioration_risk }
    """
    body = request.get_json(force=True)
    vitals_history = body.get("vitals_history", {})
    steps  = int(body.get("steps", 3))
    method = str(body.get("method", "auto"))

    if not vitals_history:
        return jsonify({"error": "No vitals_history provided"}), 400

    try:
        result = forecast_vitals(vitals_history, steps=steps, method=method)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/mews", methods=["POST"])
def mews_score():
    """
    Calculate the Modified Early Warning Score for a single patient.

    Body: {
        systolic_bp: float,
        heart_rate: float,
        respiratory_rate: float,
        temperature: float,
        consciousness: int (0=Alert, 1=Voice, 2=Pain, 3=Unresponsive),
        urine_output: float (ml/kg/hr, optional)
    }
    Returns: { mews_score, alert_level, component_scores, recommendation }
    """
    body = request.get_json(force=True)
    try:
        result = calculate_mews(body)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Image analysis routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/models", methods=["GET"])
def list_models():
    from imaging.analyzer import list_models as _list, DEFAULT_MODEL
    return jsonify({"models": _list(), "default": DEFAULT_MODEL})


@app.route("/analyze-image", methods=["POST"])
def analyze_image():
    """
    Analyze a chest X-ray / CT scan image for pathology findings.

    Body: { image_b64: str, model_name?: str, filename?: str }
    Returns: { findings: [{label, confidence, cause, medications, ...}], model, model_label }
    """
    import base64
    from imaging.analyzer import analyze_image as _analyze, DEFAULT_MODEL

    body = request.get_json(force=True)
    image_b64 = body.get("image_b64")
    model_name = body.get("model_name", DEFAULT_MODEL)
    filename = body.get("filename", "")

    if not image_b64:
        return jsonify({"error": "image_b64 is required"}), 400

    try:
        image_bytes = base64.b64decode(image_b64)
        result = _analyze(image_bytes, model_name=model_name, filename=filename)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Image analysis failed: {e}"}), 500


@app.route("/gradcam", methods=["POST"])
def gradcam():
    """
    Generate Grad-CAM heatmap for a specific pathology on a chest X-ray.

    Body: {
        image_b64: str,
        model_name?: str,
        target_label: str  (e.g. "Pneumonia"),
        filename?: str
    }
    Returns: { heatmap_b64, target_label, confidence, gradcam_available }
    """
    import base64
    from imaging.gradcam import generate_gradcam
    from imaging.analyzer import DEFAULT_MODEL

    body = request.get_json(force=True)
    image_b64    = body.get("image_b64")
    model_name   = body.get("model_name", DEFAULT_MODEL)
    target_label = body.get("target_label", "Pneumonia")
    filename     = body.get("filename", "")

    if not image_b64:
        return jsonify({"error": "image_b64 is required"}), 400

    try:
        image_bytes = base64.b64decode(image_b64)
        result = generate_gradcam(image_bytes, model_name, target_label, filename)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Grad-CAM failed: {e}"}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Chatbot / RAG Routes
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/ask", methods=["POST"])
def ask():
    """
    Natural-language patient Q&A powered by the RAG assistant.

    Body: {
        query: str,          e.g. "Which High Risk patients have age over 60?"
        patients?: [...]     optional patient list to (re-)index
    }
    Returns: { answer, matched_patients, matched_count, filters_applied, query }
    """
    body = request.get_json(force=True)
    query    = str(body.get("query", "")).strip()
    patients = body.get("patients")

    if not query:
        return jsonify({"error": "query is required"}), 400

    try:
        result = answer_query(query, all_patients=patients)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
