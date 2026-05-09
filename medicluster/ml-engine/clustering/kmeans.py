"""clustering/kmeans.py — K-Means clustering."""

import numpy as np
from sklearn.cluster import KMeans


def run_kmeans(X: np.ndarray, k: int = 4, init: str = "k-means++") -> dict:
    """
    Run K-Means clustering.

    Parameters
    ----------
    X    : scaled feature matrix
    k    : number of clusters (default 4)
    init : initialisation strategy ('k-means++' or 'random')

    Returns
    -------
    dict with keys: labels, centroids, inertia
    """
    k = max(2, min(k, X.shape[0] - 1))  # guard against edge cases

    model = KMeans(
        n_clusters=k,
        init=init,
        max_iter=300,
        n_init=10,
        random_state=42,
    )
    model.fit(X)

    return {
        "labels": model.labels_,
        "centroids": model.cluster_centers_,
        "inertia": float(model.inertia_),
    }
