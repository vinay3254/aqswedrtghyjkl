"""
automl/feature_selector.py
AutoML utilities:
  - Optimal K selection (Elbow + Silhouette sweep)
  - Feature importance ranking (mutual info + ANOVA F)
  - UMAP / t-SNE dimensionality reduction alternatives
"""

import numpy as np
import logging
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.feature_selection import mutual_info_classif, f_classif

logger = logging.getLogger(__name__)

try:
    import umap
    UMAP_AVAILABLE = True
except ImportError:
    UMAP_AVAILABLE = False

try:
    from sklearn.manifold import TSNE
    TSNE_AVAILABLE = True
except ImportError:
    TSNE_AVAILABLE = False


# ── Optimal K Selection ────────────────────────────────────────────────────────

def find_optimal_k(
    X_scaled: np.ndarray,
    k_range: range = None,
    random_state: int = 42,
) -> dict:
    """
    Sweep K-Means over a range of k values.
    Uses Elbow (inertia) and Silhouette score to recommend optimal k.

    Parameters
    ----------
    X_scaled     : scaled feature matrix (N, F)
    k_range      : range of k values to test (default: 2–10, capped at N-1)
    random_state : reproducibility seed

    Returns
    -------
    {
        "recommended_k": int,
        "sweep": [{ k, inertia, silhouette }],
        "elbow_k": int,
        "silhouette_k": int,
        "rationale": str
    }
    """
    n_samples = X_scaled.shape[0]
    max_k = min(10, n_samples - 1)

    if k_range is None:
        k_range = range(2, max_k + 1)
    else:
        k_range = [k for k in k_range if 2 <= k <= max_k]

    if not k_range:
        return {
            "recommended_k": 2,
            "sweep": [],
            "elbow_k": 2,
            "silhouette_k": 2,
            "rationale": "Too few samples to sweep — defaulting to k=2.",
        }

    sweep = []
    inertias    = []
    silhouettes = []

    for k in k_range:
        km = KMeans(n_clusters=k, n_init=10, random_state=random_state)
        labels = km.fit_predict(X_scaled)
        inertia = float(km.inertia_)
        try:
            sil = float(silhouette_score(X_scaled, labels))
        except Exception:
            sil = 0.0
        sweep.append({"k": k, "inertia": round(inertia, 2), "silhouette": round(sil, 4)})
        inertias.append(inertia)
        silhouettes.append(sil)

    # Elbow method: point of maximum second derivative of inertia
    k_list = list(k_range)
    if len(inertias) >= 3:
        diffs  = np.diff(inertias)
        diffs2 = np.diff(diffs)
        elbow_idx = int(np.argmax(np.abs(diffs2))) + 1  # +1 offset for diff
        elbow_k = k_list[min(elbow_idx, len(k_list) - 1)]
    else:
        elbow_k = k_list[0]

    # Silhouette method: highest silhouette score
    sil_k = k_list[int(np.argmax(silhouettes))]

    # Recommendation: weighted combination (silhouette takes priority)
    recommended_k = sil_k if silhouettes[k_list.index(sil_k)] > 0.3 else elbow_k

    rationale = (
        f"Elbow method suggests k={elbow_k}. "
        f"Silhouette method suggests k={sil_k} (score={max(silhouettes):.3f}). "
        f"Recommended: k={recommended_k}."
    )

    return {
        "recommended_k": recommended_k,
        "sweep":         sweep,
        "elbow_k":       elbow_k,
        "silhouette_k":  sil_k,
        "rationale":     rationale,
    }


# ── Feature Importance ────────────────────────────────────────────────────────

def rank_features(
    X_scaled: np.ndarray,
    labels: np.ndarray,
    feature_names: list[str],
) -> dict:
    """
    Rank features by their discriminative power across clusters.

    Uses two methods:
    - Mutual Information (non-linear, captures complex relationships)
    - ANOVA F-score (linear, robust with many features)

    Parameters
    ----------
    X_scaled     : scaled feature matrix (N, F)
    labels       : cluster labels per patient
    feature_names: list of F feature names

    Returns
    -------
    {
        "ranked_features": [{ feature, mi_score, f_score, composite_rank }],
        "top_risk_features": [str, ...] (top 5 by composite)
    }
    """
    valid_mask = labels != -1
    X_valid = X_scaled[valid_mask]
    y_valid = labels[valid_mask]

    if len(np.unique(y_valid)) < 2 or len(X_valid) < 10:
        return {
            "ranked_features": [{"feature": f, "mi_score": 0.0, "f_score": 0.0, "composite_rank": i}
                                 for i, f in enumerate(feature_names)],
            "top_risk_features": feature_names[:5],
        }

    try:
        mi_scores = mutual_info_classif(X_valid, y_valid, random_state=42)
    except Exception:
        mi_scores = np.zeros(len(feature_names))

    try:
        f_scores, _ = f_classif(X_valid, y_valid)
        f_scores = np.nan_to_num(f_scores, nan=0.0)
    except Exception:
        f_scores = np.zeros(len(feature_names))

    # Normalize both to [0,1]
    mi_norm = mi_scores / (mi_scores.max() + 1e-9)
    f_norm  = f_scores  / (f_scores.max()  + 1e-9)
    composite = 0.6 * mi_norm + 0.4 * f_norm

    ranked = sorted(
        [
            {
                "feature":        feature_names[i],
                "mi_score":       round(float(mi_scores[i]), 6),
                "f_score":        round(float(f_scores[i]), 3),
                "composite_rank": round(float(composite[i]), 4),
            }
            for i in range(len(feature_names))
        ],
        key=lambda x: x["composite_rank"],
        reverse=True,
    )

    return {
        "ranked_features":   ranked,
        "top_risk_features": [r["feature"] for r in ranked[:5]],
    }


# ── Dimensionality Reduction Alternatives ─────────────────────────────────────

def compute_umap(
    X_scaled: np.ndarray,
    n_neighbors: int = 15,
    min_dist: float = 0.1,
    random_state: int = 42,
) -> dict:
    """
    Compute UMAP 2D embedding.
    Falls back to PCA if umap-learn is not installed.
    """
    if UMAP_AVAILABLE:
        try:
            effective_neighbors = max(2, min(n_neighbors, len(X_scaled) - 1))
            reducer = umap.UMAP(
                n_components=2,
                n_neighbors=effective_neighbors,
                min_dist=min_dist,
                random_state=random_state,
                low_memory=False,
            )
            coords = reducer.fit_transform(X_scaled)
            return {
                "method": "umap",
                "coords": [[round(float(r[0]), 4), round(float(r[1]), 4)] for r in coords],
            }
        except Exception as e:
            logger.warning(f"UMAP failed: {e}, falling back to PCA")

    # PCA fallback
    from sklearn.decomposition import PCA
    pca = PCA(n_components=2, random_state=random_state)
    coords = pca.fit_transform(X_scaled)
    return {
        "method": "pca_fallback",
        "coords": [[round(float(r[0]), 4), round(float(r[1]), 4)] for r in coords],
    }


def compute_tsne(
    X_scaled: np.ndarray,
    perplexity: float = 30.0,
    random_state: int = 42,
) -> dict:
    """
    Compute t-SNE 2D embedding.
    Falls back to PCA for small datasets.
    """
    n = len(X_scaled)
    perp = min(perplexity, max(5.0, (n - 1) / 3.0))

    if n < 10:
        from sklearn.decomposition import PCA
        pca = PCA(n_components=2, random_state=random_state)
        coords = pca.fit_transform(X_scaled)
        return {
            "method": "pca_fallback",
            "coords": [[round(float(r[0]), 4), round(float(r[1]), 4)] for r in coords],
        }

    try:
        tsne = TSNE(
            n_components=2,
            perplexity=perp,
            random_state=random_state,
            max_iter=1000,
        )
        coords = tsne.fit_transform(X_scaled)
        return {
            "method": "tsne",
            "coords": [[round(float(r[0]), 4), round(float(r[1]), 4)] for r in coords],
        }
    except Exception as e:
        logger.warning(f"t-SNE failed: {e}, falling back to PCA")
        from sklearn.decomposition import PCA
        pca = PCA(n_components=2, random_state=random_state)
        coords = pca.fit_transform(X_scaled)
        return {
            "method": "pca_fallback",
            "coords": [[round(float(r[0]), 4), round(float(r[1]), 4)] for r in coords],
        }
