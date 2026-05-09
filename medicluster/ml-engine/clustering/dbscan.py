"""clustering/dbscan.py — DBSCAN clustering."""

import numpy as np
from sklearn.cluster import DBSCAN


def run_dbscan(X: np.ndarray, eps: float = 0.5, min_samples: int = 5) -> dict:
    """
    Run DBSCAN density-based clustering.

    Parameters
    ----------
    X           : scaled feature matrix
    eps         : neighbourhood radius
    min_samples : minimum points to form a core point

    Returns
    -------
    dict with keys: labels  (−1 = noise / outlier)
    """
    model = DBSCAN(eps=eps, min_samples=min_samples, n_jobs=-1)
    labels = model.fit_predict(X)

    return {
        "labels": labels,
        "centroids": None,   # DBSCAN has no explicit centroids
        "inertia": None,
    }
