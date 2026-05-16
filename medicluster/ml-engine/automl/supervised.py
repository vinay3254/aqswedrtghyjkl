"""Supervised AutoML baselines for labelled clinical prediction tasks."""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import (
    GradientBoostingClassifier,
    GradientBoostingRegressor,
    RandomForestClassifier,
    RandomForestRegressor,
)
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


def _infer_task(y: pd.Series) -> str:
    if y.dtype == object or str(y.dtype).startswith("category") or y.dtype == bool:
        return "classification"
    unique = y.dropna().nunique()
    if unique <= max(8, int(len(y) * 0.08)):
        return "classification"
    return "regression"


def _build_preprocessor(X: pd.DataFrame) -> ColumnTransformer:
    numeric_features = list(X.select_dtypes(include=[np.number]).columns)
    categorical_features = [c for c in X.columns if c not in numeric_features]

    numeric_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])
    categorical_pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])

    return ColumnTransformer([
        ("num", numeric_pipeline, numeric_features),
        ("cat", categorical_pipeline, categorical_features),
    ])


def _models(task: str) -> dict:
    if task == "classification":
        return {
            "logistic_regression": LogisticRegression(max_iter=1000, class_weight="balanced"),
            "random_forest": RandomForestClassifier(n_estimators=120, random_state=42, class_weight="balanced"),
            "gradient_boosting": GradientBoostingClassifier(random_state=42),
        }
    return {
        "ridge": Ridge(alpha=1.0),
        "random_forest": RandomForestRegressor(n_estimators=120, random_state=42),
        "gradient_boosting": GradientBoostingRegressor(random_state=42),
    }


def _classification_metrics(model: Pipeline, X_test: pd.DataFrame, y_test: pd.Series) -> dict:
    preds = model.predict(X_test)
    metrics = {
        "accuracy": round(float(accuracy_score(y_test, preds)), 4),
        "precision_weighted": round(float(precision_score(y_test, preds, average="weighted", zero_division=0)), 4),
        "recall_weighted": round(float(recall_score(y_test, preds, average="weighted", zero_division=0)), 4),
        "f1_weighted": round(float(f1_score(y_test, preds, average="weighted", zero_division=0)), 4),
    }

    if hasattr(model, "predict_proba") and y_test.nunique() == 2:
        try:
            proba = model.predict_proba(X_test)[:, 1]
            metrics["roc_auc"] = round(float(roc_auc_score(y_test, proba)), 4)
        except Exception:
            pass
    return metrics


def _regression_metrics(model: Pipeline, X_test: pd.DataFrame, y_test: pd.Series) -> dict:
    preds = model.predict(X_test)
    rmse = mean_squared_error(y_test, preds, squared=False)
    return {
        "mae": round(float(mean_absolute_error(y_test, preds)), 4),
        "rmse": round(float(rmse), 4),
        "r2": round(float(r2_score(y_test, preds)), 4),
    }


def _primary_metric(task: str, metrics: dict) -> float:
    return float(metrics.get("f1_weighted", metrics.get("r2", -999)))


def _feature_names(pipeline: Pipeline, original_columns: list[str]) -> list[str]:
    preprocessor = pipeline.named_steps["preprocessor"]
    try:
        return list(preprocessor.get_feature_names_out(original_columns))
    except Exception:
        return original_columns


def _feature_importance(pipeline: Pipeline, original_columns: list[str]) -> list[dict]:
    model = pipeline.named_steps["model"]
    names = _feature_names(pipeline, original_columns)

    values = None
    if hasattr(model, "feature_importances_"):
        values = model.feature_importances_
    elif hasattr(model, "coef_"):
        coef = np.array(model.coef_)
        values = np.mean(np.abs(coef), axis=0) if coef.ndim > 1 else np.abs(coef)

    if values is None:
        return []

    ranked = sorted(
        [
            {"feature": str(name), "importance": round(float(value), 6)}
            for name, value in zip(names, values)
        ],
        key=lambda item: item["importance"],
        reverse=True,
    )
    return ranked[:15]


def train_predictive_model(rows: list[dict], target: str, task: str = "auto", test_size: float = 0.25) -> dict:
    """
    Train small supervised baselines for labelled patient data.

    Supports:
      - classification: disease/risk/readmission/ICU labels
      - regression: length of stay, cost, numeric risk score
    """
    if not rows:
        return {"error": "No training rows provided."}

    df = pd.DataFrame(rows)
    if target not in df.columns:
        return {"error": f"Target column '{target}' not found."}

    df = df.dropna(subset=[target]).copy()
    if len(df) < 8:
        return {"error": "At least 8 labelled rows are required for a supervised baseline."}

    y = df[target]
    X = df.drop(columns=[target])
    if "patient_id" in X.columns:
        X = X.drop(columns=["patient_id"])

    resolved_task = _infer_task(y) if task == "auto" else task
    if resolved_task not in {"classification", "regression"}:
        return {"error": "task must be auto, classification, or regression."}

    stratify = None
    if resolved_task == "classification":
        counts = y.value_counts()
        if len(counts) > 1 and counts.min() >= 2:
            stratify = y

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=max(0.15, min(0.4, float(test_size))),
        random_state=42,
        stratify=stratify,
    )

    preprocessor = _build_preprocessor(X)
    leaderboard = []
    fitted = {}

    for name, model in _models(resolved_task).items():
        try:
            pipeline = Pipeline([
                ("preprocessor", preprocessor),
                ("model", model),
            ])
            pipeline.fit(X_train, y_train)
            metrics = (
                _classification_metrics(pipeline, X_test, y_test)
                if resolved_task == "classification"
                else _regression_metrics(pipeline, X_test, y_test)
            )
            leaderboard.append({
                "model": name,
                "metrics": metrics,
                "primary_score": round(_primary_metric(resolved_task, metrics), 4),
            })
            fitted[name] = pipeline
        except Exception as exc:
            leaderboard.append({
                "model": name,
                "error": str(exc),
                "primary_score": -999,
            })

    leaderboard = sorted(leaderboard, key=lambda item: item.get("primary_score", -999), reverse=True)
    best_name = leaderboard[0]["model"] if leaderboard and leaderboard[0].get("primary_score", -999) > -999 else None
    best_pipeline = fitted.get(best_name) if best_name else None

    response = {
        "task": resolved_task,
        "target": target,
        "samples": int(len(df)),
        "train_size": int(len(X_train)),
        "test_size": int(len(X_test)),
        "features_used": list(X.columns),
        "leaderboard": leaderboard,
        "best_model": best_name,
        "deployment_note": "Use this as a baseline; persist and validate a model before clinical use.",
    }

    if resolved_task == "classification":
        response["class_distribution"] = {str(k): int(v) for k, v in y.value_counts().to_dict().items()}
    else:
        response["target_summary"] = {
            "mean": round(float(y.mean()), 4),
            "min": round(float(y.min()), 4),
            "max": round(float(y.max()), 4),
        }

    if best_pipeline is not None:
        response["feature_importance"] = _feature_importance(best_pipeline, list(X.columns))
        sample_preds = best_pipeline.predict(X_test.head(5))
        response["sample_predictions"] = [
            {"actual": str(actual), "predicted": str(pred)}
            for actual, pred in zip(y_test.head(5), sample_preds)
        ]

    return response
