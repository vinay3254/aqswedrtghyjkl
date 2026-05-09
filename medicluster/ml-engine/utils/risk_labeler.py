"""utils/risk_labeler.py - Maps cluster IDs to configurable risk tiers."""

import numpy as np
from sklearn.preprocessing import StandardScaler


RISK_TIERS = ["Low", "Moderate", "High", "Critical"]


def _normalize_weights(risk_feature_weights: dict | None) -> dict:
    """Normalize optional feature weights from API params."""
    if not isinstance(risk_feature_weights, dict):
        return {}

    weights = {}
    for feature, weight in risk_feature_weights.items():
        try:
            weights[str(feature).lower()] = float(weight)
        except (TypeError, ValueError):
            continue
    return weights


def _composite_score(
    centroid: np.ndarray,
    feature_names: list,
    scaler: StandardScaler,
    risk_feature_weights: dict | None,
) -> float:
    """
    Compute a scalar composite risk score for a single cluster centroid.
    Centroid is already in scaled space, so the default score is data-relative
    rather than tied to hardcoded clinical feature names. API callers can pass
    params.risk_feature_weights to emphasize, de-emphasize, or invert features.
    """
    _ = scaler  # Retained for backward-compatible function shape.
    weights = _normalize_weights(risk_feature_weights)
    score = 0.0

    for i, fname in enumerate(feature_names):
        weight = weights.get(str(fname).lower(), 1.0)
        score += weight * float(centroid[i])

    return score


def label_risk_tiers(
    labels: np.ndarray,
    centroids_or_means: np.ndarray,
    feature_names: list,
    scaler: StandardScaler,
    risk_feature_weights: dict | None = None,
) -> dict:
    """
    Map cluster IDs to risk tier strings.

    Algorithm:
    1. Compute composite risk score for each cluster centroid from scaled data
       and optional params.risk_feature_weights.
    2. Sort clusters by ascending risk score.
    3. Assign tiers: Low, Moderate, High, Critical.

    Parameters
    ----------
    labels            : cluster label array (-1 = noise)
    centroids_or_means: (K, features) array of cluster centers in scaled space
    feature_names     : list of feature column names
    scaler            : fitted StandardScaler, retained for API compatibility
    risk_feature_weights: optional dict of feature name to numeric weight

    Returns
    -------
    dict mapping cluster_id (int) to risk_tier (str)
        Special: -1 (noise) maps to "Noise"
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
            scores[cid] = _composite_score(
                centroid,
                feature_names,
                scaler,
                risk_feature_weights,
            )
        else:
            # Fallback: preserve original order as tie-breaker
            scores[cid] = float(cid)

    # Sort clusters by ascending risk score
    sorted_clusters = sorted(unique_clusters, key=lambda c: scores[c])
    n = len(sorted_clusters)

    # Assign tiers by percentile rank within [0, 4) buckets
    for rank, cid in enumerate(sorted_clusters):
        tier_idx = int(rank * 4 / n)
        tier_idx = min(tier_idx, 3)
        mapping[cid] = RISK_TIERS[tier_idx]

    # Noise points
    if -1 in np.unique(labels):
        mapping[-1] = "Noise"

    return mapping
