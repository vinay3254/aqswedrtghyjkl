"""clustering/gmm.py — Gaussian Mixture Model clustering."""

import numpy as np
from sklearn.mixture import GaussianMixture


def run_gmm(
    X: np.ndarray,
    n_components: int = 4,
    covariance_type: str = "full",
) -> dict:
    """
    Run Gaussian Mixture Model (EM algorithm).

    Parameters
    ----------
    X               : scaled feature matrix
    n_components    : number of mixture components
    covariance_type : 'full' | 'tied' | 'diag' | 'spherical'

    Returns
    -------
    dict with keys: labels (hard), probabilities (soft, NxK), centroids, inertia
    """
    n_components = max(2, min(n_components, X.shape[0] - 1))

    model = GaussianMixture(
        n_components=n_components,
        covariance_type=covariance_type,
        max_iter=300,
        n_init=5,
        random_state=42,
    )
    model.fit(X)

    labels = model.predict(X)
    probs = model.predict_proba(X)          # shape (N, K)
    centroids = model.means_               # shape (K, features)

    return {
        "labels": labels,
        "probabilities": probs,
        "centroids": centroids,
        "inertia": float(model.bic(X)),   # BIC (lower = better fit)
        "aic": float(model.aic(X)),
    }
