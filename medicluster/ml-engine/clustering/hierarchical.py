"""clustering/hierarchical.py — Agglomerative (Hierarchical) clustering."""

import numpy as np
from sklearn.cluster import AgglomerativeClustering
from scipy.cluster.hierarchy import linkage as scipy_linkage


def run_hierarchical(
    X: np.ndarray,
    n_clusters: int = 4,
    linkage: str = "ward",
) -> dict:
    """
    Run Agglomerative hierarchical clustering.

    Parameters
    ----------
    X          : scaled feature matrix
    n_clusters : number of clusters
    linkage    : linkage criterion ('ward', 'complete', 'average', 'single')

    Returns
    -------
    dict with keys: labels, centroids (cluster means), linkage_matrix
    """
    n_clusters = max(2, min(n_clusters, X.shape[0] - 1))

    # Sklearn model for cluster labels
    model = AgglomerativeClustering(n_clusters=n_clusters, linkage=linkage)
    labels = model.fit_predict(X)

    # Scipy linkage matrix for dendrogram rendering
    scipy_method = "ward" if linkage == "ward" else linkage
    lm = scipy_linkage(X, method=scipy_method)

    # Compute centroids as cluster means
    centroids = np.array(
        [X[labels == k].mean(axis=0) for k in np.unique(labels) if k != -1]
    )

    return {
        "labels": labels,
        "centroids": centroids,
        "linkage_matrix": lm,
        "inertia": None,
    }
