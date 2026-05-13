"""
forecasting/vitals_forecaster.py
Vital signs time-series forecasting using LSTM or Prophet.

Supports:
  - LSTM / GRU (PyTorch) for short-horizon rolling predictions
  - Prophet for trend decomposition and anomaly detection
  - MEWS (Modified Early Warning Score) calculator
"""

import numpy as np
import logging
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import torch
    import torch.nn as nn
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    from prophet import Prophet
    import pandas as pd
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False

# ── MEWS Score Calculator ─────────────────────────────────────────────────────

MEWS_THRESHOLDS = {
    "systolic_bp": [
        (70,  3), (80, 2), (100, 1), (200, 0), (float("inf"), 2)
    ],
    "heart_rate": [
        (40,  2), (50, 1), (100, 0), (110, 1), (130, 2), (float("inf"), 3)
    ],
    "respiratory_rate": [
        (9,  2), (14, 1), (20, 0), (29, 1), (float("inf"), 2)
    ],
    "temperature": [
        (35.0, 2), (36.0, 1), (38.0, 0), (38.5, 1), (float("inf"), 2)
    ],
    "consciousness": {
        # Encode AVPU: 0=Alert, 1=Voice, 2=Pain, 3=Unresponsive
        0: 0, 1: 1, 2: 2, 3: 3
    },
    "urine_output": [
        (0.5, 3), (1.0, 2), (float("inf"), 0)
    ],
}


def _score_threshold(value: float, thresholds: list) -> int:
    """Score a continuous vital sign against threshold ranges."""
    for threshold, score in thresholds:
        if value < threshold:
            return score
    return thresholds[-1][1]


def calculate_mews(vitals: dict) -> dict:
    """
    Calculate the Modified Early Warning Score.

    Parameters
    ----------
    vitals : dict with optional keys:
        systolic_bp, heart_rate, respiratory_rate,
        temperature, consciousness (0-3), urine_output (ml/kg/hr)

    Returns
    -------
    {
        "mews_score"  : int,
        "alert_level" : "low" | "moderate" | "high" | "critical",
        "component_scores": { vital: score },
        "recommendation": str
    }
    """
    scores = {}

    for vital, thresholds in MEWS_THRESHOLDS.items():
        if vital not in vitals:
            continue
        val = vitals[vital]
        if isinstance(thresholds, dict):
            scores[vital] = thresholds.get(int(val), 0)
        else:
            scores[vital] = _score_threshold(float(val), thresholds)

    total = sum(scores.values())

    if total <= 1:
        alert_level = "low"
        recommendation = "Routine monitoring. Review in 12 hours."
    elif total <= 3:
        alert_level = "moderate"
        recommendation = "Increased monitoring every 4 hours. Notify charge nurse."
    elif total <= 5:
        alert_level = "high"
        recommendation = "Urgent medical review required within 30 minutes."
    else:
        alert_level = "critical"
        recommendation = "IMMEDIATE medical emergency response required."

    return {
        "mews_score":       total,
        "alert_level":      alert_level,
        "component_scores": scores,
        "recommendation":   recommendation,
    }


# ── Simple LSTM forecaster ─────────────────────────────────────────────────────

class _LSTMForecaster(nn.Module if TORCH_AVAILABLE else object):
    """Single-layer LSTM for univariate time-series forecasting."""

    def __init__(self, input_size=1, hidden_size=32, num_layers=2, output_size=1):
        if not TORCH_AVAILABLE:
            return
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc   = nn.Linear(hidden_size, output_size)

    def forward(self, x):
        out, _ = self.lstm(x)
        return self.fc(out[:, -1, :])


def _forecast_lstm(series: list[float], steps: int = 3) -> dict:
    """
    Quick-train a small LSTM on the given series and forecast `steps` ahead.
    Uses a sliding window of size min(10, len(series)//2).
    """
    if not TORCH_AVAILABLE or len(series) < 4:
        return _linear_extrapolate(series, steps)

    import torch

    n = len(series)
    seq_len = min(10, n // 2)
    arr = np.array(series, dtype=np.float32)

    # Normalize
    mean_val = arr.mean()
    std_val  = arr.std() + 1e-8
    arr_norm = (arr - mean_val) / std_val

    # Build supervised dataset
    X_list, y_list = [], []
    for i in range(len(arr_norm) - seq_len):
        X_list.append(arr_norm[i:i + seq_len])
        y_list.append(arr_norm[i + seq_len])

    if not X_list:
        return _linear_extrapolate(series, steps)

    X_t = torch.tensor(np.array(X_list), dtype=torch.float32).unsqueeze(-1)
    y_t = torch.tensor(np.array(y_list), dtype=torch.float32).unsqueeze(-1)

    model = _LSTMForecaster(input_size=1, hidden_size=32, num_layers=2, output_size=1)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.01)
    loss_fn   = nn.MSELoss()

    model.train()
    for _ in range(60):
        optimizer.zero_grad()
        pred = model(X_t)
        loss = loss_fn(pred, y_t)
        loss.backward()
        optimizer.step()

    # Forecast iteratively
    model.eval()
    window = arr_norm[-seq_len:].tolist()
    forecasts = []
    with torch.no_grad():
        for _ in range(steps):
            inp = torch.tensor([[window[-seq_len:]]], dtype=torch.float32).squeeze(0).unsqueeze(-1).unsqueeze(0)
            out = model(inp).item()
            forecasts.append(out)
            window.append(out)

    # De-normalize
    forecasts_orig = [round(float(v * std_val + mean_val), 3) for v in forecasts]
    confidence_band = float(std_val * 0.5)

    return {
        "method":       "lstm",
        "forecasts":    forecasts_orig,
        "confidence_band": confidence_band,
        "lower_bound":  [round(v - confidence_band, 3) for v in forecasts_orig],
        "upper_bound":  [round(v + confidence_band, 3) for v in forecasts_orig],
    }


def _linear_extrapolate(series: list[float], steps: int) -> dict:
    """Simple linear regression extrapolation as fallback."""
    n = len(series)
    x = np.arange(n, dtype=float)
    y = np.array(series, dtype=float)
    if n >= 2:
        coeffs = np.polyfit(x, y, 1)
        future_x = np.arange(n, n + steps, dtype=float)
        forecasts = [round(float(np.polyval(coeffs, xi)), 3) for xi in future_x]
    else:
        forecasts = [round(series[-1], 3)] * steps

    std = float(np.std(y)) if n > 1 else 1.0
    return {
        "method":       "linear_extrapolation",
        "forecasts":    forecasts,
        "confidence_band": round(std * 0.5, 3),
        "lower_bound":  [round(v - std * 0.5, 3) for v in forecasts],
        "upper_bound":  [round(v + std * 0.5, 3) for v in forecasts],
    }


def _forecast_prophet(series: list[float], steps: int = 3) -> dict:
    """Use Prophet for trend + seasonality decomposition and forecasting."""
    if not PROPHET_AVAILABLE or len(series) < 6:
        return _linear_extrapolate(series, steps)

    import pandas as pd
    from prophet import Prophet

    df = pd.DataFrame({
        "ds": pd.date_range("2024-01-01", periods=len(series), freq="H"),
        "y":  series,
    })

    m = Prophet(daily_seasonality=False, weekly_seasonality=False, yearly_seasonality=False)
    m.fit(df)

    future = m.make_future_dataframe(periods=steps, freq="H")
    forecast = m.predict(future)

    fc_rows = forecast.tail(steps)
    forecasts   = [round(float(v), 3) for v in fc_rows["yhat"].values]
    lower_bound = [round(float(v), 3) for v in fc_rows["yhat_lower"].values]
    upper_bound = [round(float(v), 3) for v in fc_rows["yhat_upper"].values]

    return {
        "method":        "prophet",
        "forecasts":     forecasts,
        "lower_bound":   lower_bound,
        "upper_bound":   upper_bound,
        "confidence_band": round(float(np.mean(np.array(upper_bound) - np.array(lower_bound))), 3),
    }


# ── Public API ─────────────────────────────────────────────────────────────────

def forecast_vitals(
    vitals_history: dict[str, list[float]],
    steps: int = 3,
    method: str = "auto",
) -> dict:
    """
    Forecast vital signs from historical sequences.

    Parameters
    ----------
    vitals_history : { "heart_rate": [72, 75, 78, ...], "bp_systolic": [...], ... }
    steps          : number of future readings to predict
    method         : "lstm" | "prophet" | "linear" | "auto"

    Returns
    -------
    {
        "forecasts": {
            "heart_rate": { method, forecasts, lower_bound, upper_bound },
            ...
        },
        "mews_latest": mews result using last known vitals,
        "deterioration_risk": "low" | "moderate" | "high" | "critical"
    }
    """
    forecasts = {}
    last_vitals = {}

    for vital, series in vitals_history.items():
        if not series or len(series) < 2:
            continue

        last_vitals[vital] = series[-1]

        if method == "prophet" or (method == "auto" and len(series) >= 10 and PROPHET_AVAILABLE):
            result = _forecast_prophet(series, steps)
        elif method == "lstm" or (method == "auto" and TORCH_AVAILABLE):
            result = _forecast_lstm(series, steps)
        else:
            result = _linear_extrapolate(series, steps)

        forecasts[vital] = result

    # MEWS score from last known readings
    mews = calculate_mews(last_vitals)

    # Deterioration risk from trend analysis
    deterioration_signals = 0
    for vital, fc in forecasts.items():
        if len(fc.get("forecasts", [])) > 0:
            last_val = vitals_history[vital][-1]
            next_val = fc["forecasts"][0]
            # Heart rate / RR increasing, BP dropping = deterioration signal
            if vital in ("heart_rate", "respiratory_rate") and next_val > last_val * 1.1:
                deterioration_signals += 1
            elif vital == "systolic_bp" and next_val < last_val * 0.9:
                deterioration_signals += 1

    deterioration_risk = (
        "critical" if mews["mews_score"] >= 6 or deterioration_signals >= 3 else
        "high"     if mews["mews_score"] >= 4 or deterioration_signals >= 2 else
        "moderate" if mews["mews_score"] >= 2 or deterioration_signals >= 1 else
        "low"
    )

    return {
        "forecasts":          forecasts,
        "mews_latest":        mews,
        "deterioration_risk": deterioration_risk,
        "steps_ahead":        steps,
    }
