"""evaluation/metrics.py — Clustering evaluation metrics."""

import numpy as np
from sklearn.metrics import (
    silhouette_score,
    davies_bouldin_score,
    calinski_harabasz_score,
)


def compute_metrics(X: np.ndarray, labels: np.ndarray) -> dict:
    """
    Compute standard clustering quality metrics.

    Handles edge cases:
    - Single cluster → all metrics return None
    - Noise-only DBSCAN output → all metrics return None
    - Fewer than 2 valid clusters → graceful fallback

    Parameters
    ----------
    X      : scaled feature matrix
    labels : cluster label array (−1 = noise)

    Returns
    -------
    dict with keys: silhouette, davies_bouldin, calinski_harabasz
    """
    result = {
        "silhouette": None,
        "davies_bouldin": None,
        "calinski_harabasz": None,
    }

    # Filter out noise points for metric computation
    valid_mask = labels != -1
    X_valid = X[valid_mask]
    labels_valid = labels[valid_mask]

    unique_labels = np.unique(labels_valid)
    n_clusters = len(unique_labels)

    # Need at least 2 clusters and 2 samples per cluster for meaningful metrics
    if n_clusters < 2 or X_valid.shape[0] < n_clusters + 1:
        return result

    try:
        result["silhouette"] = float(silhouette_score(X_valid, labels_valid))
    except Exception:
        pass

    try:
        result["davies_bouldin"] = float(davies_bouldin_score(X_valid, labels_valid))
    except Exception:
        pass

    try:
        result["calinski_harabasz"] = float(
            calinski_harabasz_score(X_valid, labels_valid)
        )
    except Exception:
        pass

    return result
