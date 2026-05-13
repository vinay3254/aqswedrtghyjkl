"""
explainability/shap_explainer.py
SHAP-based feature importance and per-patient explanations.
"""

import numpy as np
import logging

logger = logging.getLogger(__name__)

# Lazy import — shap is optional; graceful degradation if not installed
try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False
    logger.warning("shap not installed — explainability endpoints will return stub data.")


def compute_shap_values(
    X_scaled: np.ndarray,
    labels: np.ndarray,
    feature_names: list[str],
    max_samples: int = 200,
) -> dict:
    """
    Compute SHAP values using KernelExplainer on the cluster-label output.

    Parameters
    ----------
    X_scaled     : scaled feature matrix (N, F)
    labels       : cluster assignment per patient (N,)
    feature_names: list of F feature names
    max_samples  : subsample limit for speed

    Returns
    -------
    {
        "global_importance": [{ "feature": str, "mean_abs_shap": float }, ...],
        "per_patient"      : [{ "patient_index": int, "top_features": [...] }, ...]
    }
    """
    if not SHAP_AVAILABLE:
        return _stub_shap(feature_names, len(X_scaled))

    try:
        # Subsample for speed
        n = min(max_samples, len(X_scaled))
        idx = np.random.choice(len(X_scaled), n, replace=False)
        X_sub = X_scaled[idx]
        y_sub = labels[idx].astype(float)

        # Use a simple linear proxy model for SHAP (fast, sufficient for explainability)
        from sklearn.linear_model import Ridge
        proxy = Ridge(alpha=1.0)
        proxy.fit(X_sub, y_sub)

        explainer = shap.LinearExplainer(proxy, X_sub, feature_perturbation="interventional")
        shap_values = explainer(X_sub)  # (N, F)

        vals = shap_values.values  # np array (N, F)

        # Global: mean absolute SHAP per feature
        mean_abs = np.mean(np.abs(vals), axis=0)
        global_importance = sorted(
            [{"feature": feature_names[i], "mean_abs_shap": round(float(mean_abs[i]), 6)}
             for i in range(len(feature_names))],
            key=lambda x: x["mean_abs_shap"],
            reverse=True,
        )

        # Per-patient: top-3 driving features
        per_patient = []
        for pi in range(len(X_sub)):
            patient_shap = vals[pi]
            top_indices = np.argsort(np.abs(patient_shap))[::-1][:3]
            per_patient.append({
                "patient_index": int(idx[pi]),
                "top_features": [
                    {
                        "feature": feature_names[fi],
                        "shap_value": round(float(patient_shap[fi]), 6),
                        "direction": "increases_risk" if patient_shap[fi] > 0 else "decreases_risk",
                    }
                    for fi in top_indices
                ],
            })

        return {
            "global_importance": global_importance,
            "per_patient": per_patient,
            "shap_available": True,
        }

    except Exception as e:
        logger.error(f"SHAP computation failed: {e}")
        return _stub_shap(feature_names, len(X_scaled))


def _stub_shap(feature_names: list[str], n_patients: int) -> dict:
    """Return a stub response when SHAP is unavailable."""
    return {
        "global_importance": [
            {"feature": f, "mean_abs_shap": 0.0} for f in feature_names
        ],
        "per_patient": [],
        "shap_available": False,
        "message": "Install shap>=0.45.0 to enable explainability.",
    }
