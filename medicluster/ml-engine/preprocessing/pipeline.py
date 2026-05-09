"""
preprocessing/pipeline.py
Preprocessing pipeline: cleans, scales, and PCA-reduces patient data.
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA


def preprocess(df: pd.DataFrame, return_report: bool = False):
    """
    Preprocess a raw patient DataFrame.

    Steps:
      1. Drop non-numeric columns (except patient_id)
      2. Fill missing values with column median
      3. Remove outliers via IQR (1.5x)
      4. StandardScaler on feature columns
      5. PCA to 2 components for scatter-plot coordinates

    Returns
    -------
    cleaned_df   : pd.DataFrame  — cleaned data (with patient_id)
    X_scaled     : np.ndarray    — scaled feature matrix
    pca_coords   : np.ndarray    — (N, 2) PCA coordinates
    feature_names: list[str]     — names of numeric feature columns used
    scaler       : StandardScaler instance (kept for risk labelling)
    """

    rows_before = len(df)
    original_columns = list(df.columns)

    # ── 1. Separate patient_id ────────────────────────────────────────────
    id_col = None
    if "patient_id" in df.columns:
        id_col = df["patient_id"].copy()
        df = df.drop(columns=["patient_id"])

    # ── 2. Keep only numeric columns ─────────────────────────────────────
    numeric_columns = list(df.select_dtypes(include=[np.number]).columns)
    dropped_non_numeric_columns = [
        col for col in original_columns
        if col != "patient_id" and col not in numeric_columns
    ]

    df = df.select_dtypes(include=[np.number])
    feature_names = list(df.columns)

    if len(feature_names) == 0:
        raise ValueError("No numeric feature columns found after preprocessing.")

    # ── 3. Fill missing values with column median ─────────────────────────
    df = df.fillna(df.median(numeric_only=True))

    # ── 4. Outlier removal — IQR 1.5× ────────────────────────────────────
    Q1 = df.quantile(0.25)
    Q3 = df.quantile(0.75)
    IQR = Q3 - Q1
    mask = ~((df < (Q1 - 1.5 * IQR)) | (df > (Q3 + 1.5 * IQR))).any(axis=1)
    df = df[mask].reset_index(drop=True)

    if id_col is not None:
        id_col = id_col[mask.values].reset_index(drop=True)

    if df.empty:
        raise ValueError("All rows were removed as outliers during preprocessing.")

    # ── 5. Standard scaling ───────────────────────────────────────────────
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(df.values)

    # ── 6. PCA → 2 components ─────────────────────────────────────────────
    n_components = min(2, X_scaled.shape[1], X_scaled.shape[0])
    pca = PCA(n_components=n_components, random_state=42)
    pca_coords = pca.fit_transform(X_scaled)

    # Pad to 2 columns if only 1 component was possible
    if pca_coords.shape[1] < 2:
        pca_coords = np.hstack([pca_coords, np.zeros((pca_coords.shape[0], 1))])

    # ── 7. Reassemble cleaned_df ──────────────────────────────────────────
    cleaned_df = df.copy()
    if id_col is not None:
        cleaned_df.insert(0, "patient_id", id_col)

    report = {
        "rows_before": int(rows_before),
        "rows_after": int(len(cleaned_df)),
        "dropped_rows": int(rows_before - len(cleaned_df)),
        "dropped_non_numeric_columns": dropped_non_numeric_columns,
        "feature_names": feature_names,
    }

    if return_report:
        return cleaned_df, X_scaled, pca_coords, feature_names, scaler, report

    return cleaned_df, X_scaled, pca_coords, feature_names, scaler
