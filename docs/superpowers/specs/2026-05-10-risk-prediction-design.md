# Risk Prediction for New Patients — Design

**Date:** 2026-05-10
**Feature:** Enter new patient vitals → instantly get predicted risk tier from a saved cluster result

---

## Overview

A new `/predict` page with a vitals form. User picks a saved cluster result, enters patient vitals, and the backend finds the nearest cluster centroid (Euclidean distance on raw feature values) and returns the risk tier. No ML re-run needed — works entirely from saved `ClusterResult` data.

---

## Architecture

```
User fills vitals form + selects cluster result
        │
        ▼
POST /api/cluster/predict
  → load ClusterResult from MongoDB
  → for each clusterProfile, compute Euclidean distance between
    input vitals and centroid_features (common features only)
  → assign to nearest cluster
  → return { risk_tier, cluster_id, distances, cluster_profile, feature_names }
        │
        ▼
Frontend shows risk tier badge + feature comparison bars
```

---

## Backend — New Endpoint

**`POST /api/cluster/predict`** added to `backend/routes/clusterRoutes.js`

Request body:
```json
{
  "resultId": "<ClusterResult _id>",
  "vitals": { "age": 45, "bmi": 28.5, "glucose": 110, ... }
}
```

Logic:
1. Load `ClusterResult` by `resultId`
2. Get `clusterProfiles` (already has `centroid_features` + `risk_tier` + `size`)
3. For each profile, compute: `distance = sqrt(sum((vitals[f] - centroid[f])^2))` over shared features
4. Return nearest cluster's `risk_tier`, `cluster_id`, top 5 feature deviations (how far patient is from centroid per feature), and full cluster profile

Response:
```json
{
  "risk_tier": "High",
  "cluster_id": 2,
  "confidence": 0.78,
  "cluster_profile": { "size": 22, "centroid_features": {...} },
  "feature_deviations": [
    { "feature": "glucose", "patient_value": 110, "centroid_value": 145, "deviation": -35 }
  ],
  "algorithm": "kmeans",
  "all_distances": [{ "cluster_id": 0, "risk_tier": "Low", "distance": 120.4 }, ...]
}
```

Confidence = 1 - (nearest_distance / sum_of_all_distances) — gives a 0–1 score.

**`GET /api/cluster/results`** — list all saved ClusterResults (id + algorithm + createdAt + riskDistribution), no patients array. Added to `clusterRoutes.js`.

---

## Frontend — New Page

**`frontend/src/pages/PredictPage.jsx`**

Layout: two-column
- Left: form with all common vitals fields (age, bmi, systolic_bp, diastolic_bp, glucose, hba1c, cholesterol, hdl, ldl, triglycerides, heart_rate, spo2, num_medications) + cluster result selector dropdown
- Right: result panel (hidden until prediction runs)

Result panel shows:
- Large risk tier badge (colour-coded: Low=green, Moderate=yellow, High=orange, Critical=red)
- Confidence bar
- "Nearest cluster" profile summary (size, algorithm)
- Feature deviation bars: top 5 features where patient differs most from centroid (red = above centroid, blue = below)
- "Other clusters" distance comparison (small bar chart)

**`frontend/src/api/apiClient.js`** — add:
- `listClusterResults()` → GET /api/cluster/results
- `predictRisk(resultId, vitals)` → POST /api/cluster/predict

**`frontend/src/App.jsx`** — add route `/predict`

**`frontend/src/components/Navbar.jsx`** — add "Predict" nav link

---

## Error States

| Scenario | Behaviour |
|---|---|
| No saved cluster results | Dropdown shows "Run clustering first" disabled option |
| Missing vitals fields | Backend uses only available features for distance calc (partial match OK) |
| Result not found | 404 returned, frontend shows error |

---

## Out of Scope
- Saving prediction history
- Batch prediction (multiple patients at once)
- Re-running the ML model for prediction
