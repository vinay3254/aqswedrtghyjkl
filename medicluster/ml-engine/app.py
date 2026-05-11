"""
ml-engine/app.py
Flask API server for the MediCluster ML engine.

Endpoints:
  POST /cluster             — Run clustering on patient data
  GET  /health              — Health check
  POST /preprocess-preview  — Return preprocessing stats preview
"""

import traceback
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify
from flask_cors import CORS

from preprocessing.pipeline import preprocess
from clustering.kmeans import run_kmeans
from clustering.dbscan import run_dbscan
from clustering.hierarchical import run_hierarchical
from clustering.gmm import run_gmm
from evaluation.metrics import compute_metrics
from utils.risk_labeler import label_risk_tiers

app = Flask(__name__)
CORS(app)  # Allow requests from Node backend and frontend


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
# Routes
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
        params: { k, eps, min_samples, n_clusters, linkage, n_components, covariance_type }
    }
    """
    body = request.get_json(force=True)
    data = body.get("data", [])
    algorithm = body.get("algorithm", "kmeans")
    params = body.get("params", {})

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
        # Run all 4 algorithms and return combined response
        algos = ["kmeans", "dbscan", "hierarchical", "gmm"]
        results = {}
        for algo in algos:
            try:
                raw = _run_algorithm(X_scaled, algo, params)
                results[algo] = _build_response(
                    raw,
                    cleaned_df,
                    X_scaled,
                    pca_coords,
                    feature_names,
                    scaler,
                    params,
                    report,
                )
            except Exception as e:
                results[algo] = {"error": str(e)}

        return jsonify({
            "all": results,
            "algorithm": "all",
            "feature_names": feature_names,
            "preprocessing": report,
            "warnings": _preprocessing_warnings(report),
        })

    else:
        try:
            raw = _run_algorithm(X_scaled, algorithm, params)
            response = _build_response(
                raw,
                cleaned_df,
                X_scaled,
                pca_coords,
                feature_names,
                scaler,
                params,
                report,
            )
            return jsonify(response)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            traceback.print_exc()
            return jsonify({"error": f"Clustering failed: {e}"}), 500


# ─────────────────────────────────────────────────────────────────────────────
# Image analysis route
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
    Returns: { findings: [{label, confidence}], model, model_label }
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


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
