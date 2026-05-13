"""
anomaly/isolation_forest.py
Isolation Forest-based anomaly detection for patient data.
"""

import numpy as np
import logging
from sklearn.ensemble import IsolationForest

logger = logging.getLogger(__name__)


def detect_anomalies(
    X_scaled: np.ndarray,
    feature_names: list[str],
    contamination: float = 0.05,
    random_state: int = 42,
) -> dict:
    """
    Detect statistically unusual patients using Isolation Forest.

    Parameters
    ----------
    X_scaled      : scaled feature matrix (N, F)
    feature_names : list of feature names
    contamination : expected fraction of anomalies (default 5%)
    random_state  : reproducibility seed

    Returns
    -------
    {
        "anomaly_flags"  : [bool, ...]  — True = anomaly
        "anomaly_scores" : [float, ...] — lower = more anomalous (-1 to 0)
        "anomaly_count"  : int
        "anomaly_indices": [int, ...]   — indices of anomalous patients
        "feature_contributions": [{feature, deviation}, ...] per anomaly
    }
    """
    try:
        clf = IsolationForest(
            contamination=contamination,
            random_state=random_state,
            n_estimators=200,
        )
        raw_scores = clf.fit_predict(X_scaled)          # 1 = normal, -1 = anomaly
        decision_scores = clf.decision_function(X_scaled)  # higher = more normal

        anomaly_flags = (raw_scores == -1).tolist()
        anomaly_scores = [round(float(s), 4) for s in decision_scores]
        anomaly_indices = [i for i, flag in enumerate(anomaly_flags) if flag]

        # Feature contributions for each anomaly: how far each feature deviates from mean
        feature_contribs = []
        col_means = X_scaled.mean(axis=0)
        col_stds  = X_scaled.std(axis=0) + 1e-9

        for idx in anomaly_indices:
            deviations = [
                {
                    "feature": feature_names[fi],
                    "z_score": round(float((X_scaled[idx, fi] - col_means[fi]) / col_stds[fi]), 3),
                }
                for fi in range(len(feature_names))
            ]
            # Sort by absolute z-score descending
            deviations.sort(key=lambda d: abs(d["z_score"]), reverse=True)
            feature_contribs.append({
                "patient_index": idx,
                "anomaly_score": anomaly_scores[idx],
                "top_deviations": deviations[:5],
            })

        return {
            "anomaly_flags":          anomaly_flags,
            "anomaly_scores":         anomaly_scores,
            "anomaly_count":          len(anomaly_indices),
            "anomaly_indices":        anomaly_indices,
            "feature_contributions":  feature_contribs,
            "contamination_used":     contamination,
        }

    except Exception as e:
        logger.error(f"Isolation Forest failed: {e}")
        return {
            "anomaly_flags":         [False] * len(X_scaled),
            "anomaly_scores":        [0.0] * len(X_scaled),
            "anomaly_count":         0,
            "anomaly_indices":       [],
            "feature_contributions": [],
            "error":                 str(e),
        }
