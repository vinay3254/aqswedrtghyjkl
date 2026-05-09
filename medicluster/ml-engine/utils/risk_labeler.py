"""utils/risk_labeler.py — Maps cluster IDs to clinical risk tiers."""

import numpy as np
from sklearn.preprocessing import StandardScaler


# Clinical risk weight priorities (higher weight = stronger influence on risk)
RISK_FEATURES = {
    "glucose": 3.0,
    "systolic_bp": 2.5,
    "hba1c": 3.0,
    "bmi": 2.0,
    "cholesterol": 1.5,
    "ldl": 1.5,
    "triglycerides": 1.2,
    "diastolic_bp": 1.5,
    "age": 1.0,
    "heart_rate": 0.8,
    "num_medications": 1.0,
    # Inverse risk (higher is better) — subtract these
    "hdl": -1.5,
    "spo2": -2.0,
}

RISK_TIERS = ["Low", "Moderate", "High", "Critical"]


def _composite_score(centroid: np.ndarray, feature_names: list, scaler: StandardScaler) -> float:
    """
    Compute a scalar composite risk score for a single cluster centroid.
    Centroid is in scaled space; inverse-transform to get original scale.
    """
    # Inverse-transform to original feature values
    original = scaler.inverse_transform(centroid.reshape(1, -1))[0]

    score = 0.0
    for i, fname in enumerate(feature_names):
        key = fname.lower()
        weight = RISK_FEATURES.get(key, 0.5)  # default moderate weight for unknowns
        score += weight * original[i]

    return score


def label_risk_tiers(
    labels: np.ndarray,
    centroids_or_means: np.ndarray,
    feature_names: list,
    scaler: StandardScaler,
) -> dict:
    """
    Map cluster IDs → risk tier strings.

    Algorithm:
    1. Compute composite risk score for each cluster centroid
    2. Sort clusters by ascending risk score
    3. Assign tiers: Low → Moderate → High → Critical
       (buckets into 4 tiers; fewer clusters get every-other tier)

    Parameters
    ----------
    labels            : cluster label array (−1 = noise)
    centroids_or_means: (K, features) array of cluster centres in scaled space
    feature_names     : list of feature column names
    scaler            : fitted StandardScaler for inverse-transform

    Returns
    -------
    dict mapping cluster_id (int) → risk_tier (str)
        Special: −1 (noise) → "Noise"
    """
    unique_clusters = sorted([c for c in np.unique(labels) if c != -1])
    mapping = {}

    if len(unique_clusters) == 0:
        return {-1: "Noise"}

    # Score each cluster
    scores = {}
    for cid in unique_clusters:
        if centroids_or_means is not None and cid < len(centroids_or_means):
            centroid = centroids_or_means[cid]
            scores[cid] = _composite_score(centroid, feature_names, scaler)
        else:
            # Fallback: use mean of samples in cluster
            cluster_mask = labels == cid
            if cluster_mask.sum() == 0:
                scores[cid] = 0.0
            else:
                scores[cid] = float(cid)  # preserve original order as tie-breaker

    # Sort clusters by ascending risk score
    sorted_clusters = sorted(unique_clusters, key=lambda c: scores[c])
    n = len(sorted_clusters)

    # Assign tiers by percentile rank within [0, 4) buckets
    for rank, cid in enumerate(sorted_clusters):
        tier_idx = int(rank * 4 / n)  # maps rank → 0..3
        tier_idx = min(tier_idx, 3)
        mapping[cid] = RISK_TIERS[tier_idx]

    # Noise points
    if -1 in np.unique(labels):
        mapping[-1] = "Noise"

    return mapping
