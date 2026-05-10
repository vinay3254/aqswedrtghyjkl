# Risk Prediction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/predict` page where the user picks a saved cluster result, enters patient vitals, and instantly gets a risk tier prediction via nearest-centroid Euclidean distance.

**Architecture:** Two new backend endpoints (`GET /api/cluster/results` and `POST /api/cluster/predict`) added to `clusterRoutes.js` (must be registered before the existing `GET /:id` catch-all). A new `PredictPage.jsx` two-column form + result panel, wired into `App.jsx` and `Navbar.jsx`.

**Tech Stack:** Node/Express (backend), React + Tailwind (frontend), Mongoose (MongoDB)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `medicluster/backend/routes/clusterRoutes.js` | Modify | Add two new routes before `GET /:id` |
| `medicluster/frontend/src/api/apiClient.js` | Modify | Add `listClusterResults` and `predictRisk` |
| `medicluster/frontend/src/pages/PredictPage.jsx` | Create | Two-column predict form + result panel |
| `medicluster/frontend/src/App.jsx` | Modify | Add `/predict` route |
| `medicluster/frontend/src/components/Navbar.jsx` | Modify | Add "Predict" nav link |

---

### Task 1: Backend — GET /api/cluster/results

**Files:**
- Modify: `medicluster/backend/routes/clusterRoutes.js`

This endpoint lists all saved ClusterResults (id + algorithm + createdAt + riskDistribution) without loading the full patients array. It must be registered **before** the existing `router.get("/:id", ...)` because Express matches routes in order and "results" would otherwise match the `:id` param.

- [ ] **Step 1: Add the route in clusterRoutes.js**

Open `medicluster/backend/routes/clusterRoutes.js`. Insert the following block **immediately before** the line `// ── GET /api/cluster/:id ──`:

```js
// ── GET /api/cluster/results ───────────────────────────────────────────────
router.get("/results", async (req, res, next) => {
  try {
    const results = await ClusterResult.find(
      {},
      { patients: 0, linkageMatrix: 0, clusterProfiles: 0, warnings: 0 }
    )
      .sort({ createdAt: -1 })
      .lean();
    return res.json(results);
  } catch (err) {
    return next(err);
  }
});
```

- [ ] **Step 2: Manually test the endpoint**

Start the backend (`node server.js` from `medicluster/backend/`). In a browser or curl:
```
GET http://localhost:5000/api/cluster/results
```
Expected: JSON array (may be empty `[]` if no clustering runs saved, or list of result objects each with `_id`, `algorithm`, `createdAt`, `riskDistribution`).

- [ ] **Step 3: Commit**

```bash
git add medicluster/backend/routes/clusterRoutes.js
git commit -m "feat: add GET /api/cluster/results endpoint"
```

---

### Task 2: Backend — POST /api/cluster/predict

**Files:**
- Modify: `medicluster/backend/routes/clusterRoutes.js`

This endpoint loads a saved ClusterResult by ID, denormalizes its cluster profiles (converting `centroidFeatures` Map to plain `centroid_features` object), computes Euclidean distance from the submitted vitals to each cluster centroid, and returns the nearest cluster's risk tier plus feature deviations.

Key detail: `centroidFeatures` is stored as a Mongoose Map (camelCase). The existing `denormalizeClusterProfiles` utility converts it to snake_case `centroid_features` plain objects — use it here.

- [ ] **Step 1: Add the predict route in clusterRoutes.js**

Insert this block **immediately before** the `// ── GET /api/cluster/results ──` line you added in Task 1:

```js
// ── POST /api/cluster/predict ──────────────────────────────────────────────
router.post("/predict", async (req, res, next) => {
  const { resultId, vitals } = req.body;

  if (!resultId || !mongoose.isValidObjectId(resultId)) {
    return res.status(400).json({ error: "resultId must be a valid MongoDB ObjectId" });
  }
  if (!vitals || typeof vitals !== "object" || Array.isArray(vitals)) {
    return res.status(400).json({ error: "vitals must be a non-empty object" });
  }

  try {
    const result = await ClusterResult.findById(resultId).lean();
    if (!result) return res.status(404).json({ error: "ClusterResult not found" });

    const profiles = denormalizeClusterProfiles(result.clusterProfiles || []);

    if (profiles.length === 0) {
      return res.status(400).json({ error: "This result has no cluster profiles to compare against" });
    }

    // Compute Euclidean distance for each profile
    const distances = profiles.map((profile) => {
      const centroid = profile.centroid_features || {};
      const sharedFeatures = Object.keys(centroid).filter(
        (f) => vitals[f] !== undefined && vitals[f] !== null && !isNaN(Number(vitals[f]))
      );
      if (sharedFeatures.length === 0) {
        return { cluster_id: profile.cluster_id, risk_tier: profile.risk_tier, distance: Infinity, sharedCount: 0 };
      }
      const sumSq = sharedFeatures.reduce((acc, f) => {
        const diff = Number(vitals[f]) - Number(centroid[f]);
        return acc + diff * diff;
      }, 0);
      return {
        cluster_id: profile.cluster_id,
        risk_tier: profile.risk_tier,
        distance: Math.sqrt(sumSq),
        sharedCount: sharedFeatures.length,
      };
    });

    distances.sort((a, b) => a.distance - b.distance);
    const nearest = distances[0];
    const nearestProfile = profiles.find((p) => p.cluster_id === nearest.cluster_id);
    const centroid = nearestProfile?.centroid_features || {};

    // Top 5 feature deviations (largest absolute difference)
    const deviationFeatures = Object.keys(centroid).filter(
      (f) => vitals[f] !== undefined && !isNaN(Number(vitals[f]))
    );
    const featureDeviations = deviationFeatures
      .map((f) => ({
        feature: f,
        patient_value: Number(vitals[f]),
        centroid_value: Number(centroid[f]),
        deviation: Number(vitals[f]) - Number(centroid[f]),
      }))
      .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
      .slice(0, 5);

    // Confidence: 1 - (nearest_dist / sum_of_finite_dists)
    const finiteDists = distances.filter((d) => isFinite(d.distance));
    const totalDist = finiteDists.reduce((a, d) => a + d.distance, 0);
    const confidence = totalDist > 0 ? 1 - nearest.distance / totalDist : 1;

    return res.json({
      risk_tier: nearest.risk_tier,
      cluster_id: nearest.cluster_id,
      confidence: Math.max(0, Math.min(1, confidence)),
      cluster_profile: {
        size: nearestProfile?.size ?? 0,
        centroid_features: centroid,
      },
      feature_deviations: featureDeviations,
      algorithm: result.algorithm,
      all_distances: distances.map(({ cluster_id, risk_tier, distance }) => ({
        cluster_id,
        risk_tier,
        distance: isFinite(distance) ? Math.round(distance * 100) / 100 : null,
      })),
    });
  } catch (err) {
    return next(err);
  }
});
```

- [ ] **Step 2: Manually test the predict endpoint**

Run a clustering job first on the Dashboard page to create a saved ClusterResult. Then get its `_id` from the `/api/cluster/results` response. Then:

```bash
curl -X POST http://localhost:5000/api/cluster/predict \
  -H "Content-Type: application/json" \
  -d '{"resultId":"<paste_id_here>","vitals":{"age":45,"bmi":28.5,"glucose":110,"hba1c":6.2,"cholesterol":190,"hdl":50,"ldl":120,"triglycerides":140,"heart_rate":75,"spo2":98,"systolic_bp":130,"diastolic_bp":85,"num_medications":2}}'
```

Expected: JSON with `risk_tier`, `cluster_id`, `confidence` (0–1), `feature_deviations` (array of 5), `all_distances` (array).

- [ ] **Step 3: Commit**

```bash
git add medicluster/backend/routes/clusterRoutes.js
git commit -m "feat: add POST /api/cluster/predict endpoint"
```

---

### Task 3: Frontend API client functions

**Files:**
- Modify: `medicluster/frontend/src/api/apiClient.js`

- [ ] **Step 1: Add the two functions to apiClient.js**

Add these two functions to `medicluster/frontend/src/api/apiClient.js` before the `export default api;` line:

```js
/**
 * List all saved ClusterResults (id, algorithm, createdAt, riskDistribution).
 * Used to populate the cluster result selector on the Predict page.
 */
export async function listClusterResults() {
  const res = await api.get("/cluster/results");
  return res.data;
}

/**
 * Predict risk tier for new patient vitals against a saved cluster result.
 * @param {string} resultId  MongoDB ObjectId of the ClusterResult
 * @param {object} vitals    { age, bmi, glucose, ... }
 */
export async function predictRisk(resultId, vitals) {
  const res = await api.post("/cluster/predict", { resultId, vitals });
  return res.data;
}
```

- [ ] **Step 2: Commit**

```bash
git add medicluster/frontend/src/api/apiClient.js
git commit -m "feat: add listClusterResults and predictRisk API client functions"
```

---

### Task 4: Frontend — PredictPage.jsx

**Files:**
- Create: `medicluster/frontend/src/pages/PredictPage.jsx`

Two-column layout: left = form (vitals fields + cluster result selector), right = result panel shown only after prediction runs. Risk tier badge colours match the existing convention: Low=green, Moderate=yellow, High=orange, Critical=red.

- [ ] **Step 1: Create PredictPage.jsx**

Create `medicluster/frontend/src/pages/PredictPage.jsx` with this content:

```jsx
import { useState, useEffect } from "react";
import { listClusterResults, predictRisk } from "../api/apiClient";

const TIER_STYLES = {
  Low:      { badge: "bg-emerald-100 text-emerald-800 border border-emerald-200", bar: "bg-emerald-500" },
  Moderate: { badge: "bg-yellow-100 text-yellow-800 border border-yellow-200",   bar: "bg-yellow-500" },
  High:     { badge: "bg-orange-100 text-orange-800 border border-orange-200",   bar: "bg-orange-500" },
  Critical: { badge: "bg-red-100 text-red-800 border border-red-200",            bar: "bg-red-600"    },
  Noise:    { badge: "bg-slate-100 text-slate-600 border border-slate-200",      bar: "bg-slate-400"  },
};

const VITALS_FIELDS = [
  { key: "age",             label: "Age",               unit: "yrs",    min: 0,   max: 120, step: 1   },
  { key: "bmi",             label: "BMI",               unit: "kg/m²",  min: 10,  max: 60,  step: 0.1 },
  { key: "systolic_bp",     label: "Systolic BP",       unit: "mmHg",   min: 60,  max: 250, step: 1   },
  { key: "diastolic_bp",    label: "Diastolic BP",      unit: "mmHg",   min: 40,  max: 150, step: 1   },
  { key: "glucose",         label: "Glucose",           unit: "mg/dL",  min: 50,  max: 500, step: 1   },
  { key: "hba1c",           label: "HbA1c",             unit: "%",      min: 3,   max: 15,  step: 0.1 },
  { key: "cholesterol",     label: "Cholesterol",       unit: "mg/dL",  min: 100, max: 400, step: 1   },
  { key: "hdl",             label: "HDL",               unit: "mg/dL",  min: 10,  max: 150, step: 1   },
  { key: "ldl",             label: "LDL",               unit: "mg/dL",  min: 30,  max: 300, step: 1   },
  { key: "triglycerides",   label: "Triglycerides",     unit: "mg/dL",  min: 30,  max: 1000,step: 1   },
  { key: "heart_rate",      label: "Heart Rate",        unit: "bpm",    min: 30,  max: 200, step: 1   },
  { key: "spo2",            label: "SpO2",              unit: "%",      min: 50,  max: 100, step: 0.1 },
  { key: "num_medications", label: "Num Medications",   unit: "",       min: 0,   max: 50,  step: 1   },
];

function riskTierStyle(tier) {
  return TIER_STYLES[tier] ?? TIER_STYLES.Noise;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function PredictPage() {
  const [clusterResults, setClusterResults] = useState([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const [selectedResultId, setSelectedResultId] = useState("");
  const [vitals, setVitals] = useState({});
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    listClusterResults()
      .then((data) => {
        setClusterResults(data);
        if (data.length > 0) setSelectedResultId(data[0]._id);
      })
      .catch(() => setClusterResults([]))
      .finally(() => setLoadingResults(false));
  }, []);

  function handleVitalChange(key, value) {
    setVitals((prev) => ({ ...prev, [key]: value === "" ? undefined : Number(value) }));
  }

  async function handlePredict(e) {
    e.preventDefault();
    if (!selectedResultId) { setError("Select a cluster result first."); return; }
    const filled = Object.fromEntries(
      Object.entries(vitals).filter(([, v]) => v !== undefined && !isNaN(v))
    );
    if (Object.keys(filled).length === 0) { setError("Enter at least one vital value."); return; }
    setPredicting(true);
    setError(null);
    setPrediction(null);
    try {
      const result = await predictRisk(selectedResultId, filled);
      setPrediction(result);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Prediction failed");
    } finally {
      setPredicting(false);
    }
  }

  const tierStyle = prediction ? riskTierStyle(prediction.risk_tier) : null;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 p-6">
      <div className="max-w-screen-xl mx-auto">
        <h1 className="text-xl font-bold text-slate-900 mb-1">Risk Prediction</h1>
        <p className="text-sm text-slate-500 mb-6">
          Enter patient vitals to predict their risk tier based on a saved clustering result.
        </p>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700 ml-4">✕</button>
          </div>
        )}

        <div className="flex gap-6">
          {/* ── Left: form ── */}
          <div className="w-80 shrink-0 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Cluster Result</p>
              {loadingResults ? (
                <p className="text-sm text-slate-400">Loading...</p>
              ) : clusterResults.length === 0 ? (
                <p className="text-sm text-slate-400">No saved results — run clustering first on the Dashboard.</p>
              ) : (
                <select
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedResultId}
                  onChange={(e) => setSelectedResultId(e.target.value)}
                >
                  {clusterResults.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.algorithm.toUpperCase()} — {formatDate(r.createdAt)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <form onSubmit={handlePredict} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Patient Vitals</p>
              {VITALS_FIELDS.map(({ key, label, unit, min, max, step }) => (
                <div key={key}>
                  <label className="text-xs text-slate-500 block mb-0.5">
                    {label}{unit ? ` (${unit})` : ""}
                  </label>
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    placeholder="—"
                    value={vitals[key] ?? ""}
                    onChange={(e) => handleVitalChange(key, e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <button
                type="submit"
                disabled={predicting || clusterResults.length === 0}
                className="w-full mt-2 btn-primary text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {predicting ? "Predicting…" : "Predict Risk"}
              </button>
            </form>
          </div>

          {/* ── Right: result panel ── */}
          <div className="flex-1">
            {!prediction ? (
              <div className="bg-white rounded-xl border border-slate-200 h-64 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-sm text-slate-500">Fill in vitals and click Predict Risk</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Risk tier + confidence */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <span className={`text-lg font-bold px-4 py-2 rounded-xl ${tierStyle.badge}`}>
                      {prediction.risk_tier}
                    </span>
                    <div>
                      <p className="text-xs text-slate-400">Algorithm</p>
                      <p className="text-sm font-semibold text-slate-700 uppercase">{prediction.algorithm}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Nearest Cluster</p>
                      <p className="text-sm font-semibold text-slate-700">Cluster {prediction.cluster_id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Cluster Size</p>
                      <p className="text-sm font-semibold text-slate-700">{prediction.cluster_profile?.size ?? "—"} patients</p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Confidence</span>
                      <span>{Math.round(prediction.confidence * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${tierStyle.bar}`}
                        style={{ width: `${prediction.confidence * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Feature deviations */}
                {prediction.feature_deviations?.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                      Top Feature Deviations from Centroid
                    </p>
                    <div className="space-y-2">
                      {prediction.feature_deviations.map(({ feature, patient_value, centroid_value, deviation }) => (
                        <div key={feature} className="text-xs">
                          <div className="flex justify-between mb-0.5">
                            <span className="font-mono text-slate-600">{feature}</span>
                            <span className={deviation > 0 ? "text-red-500" : "text-blue-500"}>
                              {deviation > 0 ? "+" : ""}{deviation.toFixed(1)}
                              <span className="text-slate-400 ml-1">
                                (you: {patient_value.toFixed(1)} | centroid: {centroid_value.toFixed(1)})
                              </span>
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${deviation > 0 ? "bg-red-400" : "bg-blue-400"}`}
                              style={{ width: `${Math.min(100, (Math.abs(deviation) / Math.max(Math.abs(centroid_value), 1)) * 50)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* All distances */}
                {prediction.all_distances?.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                      Distance to All Clusters
                    </p>
                    <div className="space-y-2">
                      {prediction.all_distances.map(({ cluster_id, risk_tier, distance }) => {
                        const maxDist = Math.max(...prediction.all_distances.map((d) => d.distance ?? 0), 1);
                        const isNearest = cluster_id === prediction.cluster_id;
                        return (
                          <div key={cluster_id} className="text-xs">
                            <div className="flex justify-between mb-0.5">
                              <span className="font-mono text-slate-600">
                                Cluster {cluster_id}
                                {isNearest && <span className="ml-1 text-blue-500 font-semibold">★ nearest</span>}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${riskTierStyle(risk_tier).badge}`}>
                                {risk_tier}
                              </span>
                              <span className="text-slate-400 font-mono">{distance !== null ? distance.toFixed(1) : "—"}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1">
                              <div
                                className={`h-1 rounded-full ${isNearest ? "bg-blue-500" : "bg-slate-300"}`}
                                style={{ width: `${distance !== null ? (distance / maxDist) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add medicluster/frontend/src/pages/PredictPage.jsx
git commit -m "feat: add PredictPage with vitals form and risk prediction results"
```

---

### Task 5: Wire PredictPage into App.jsx and Navbar.jsx

**Files:**
- Modify: `medicluster/frontend/src/App.jsx`
- Modify: `medicluster/frontend/src/components/Navbar.jsx`

- [ ] **Step 1: Add route to App.jsx**

In `medicluster/frontend/src/App.jsx`, add the import and route:

```jsx
// Add import after existing page imports:
import PredictPage from "./pages/PredictPage";

// Add route inside <Routes> after the /imaging route:
<Route path="/predict" element={<PredictPage />} />
```

Full updated App.jsx:

```jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import ResultsPage from "./pages/ResultsPage";
import ImagingPage from "./pages/ImagingPage";
import PredictPage from "./pages/PredictPage";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-navy-900">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/imaging" element={<ImagingPage />} />
          <Route path="/results/:id" element={<ResultsPage />} />
          <Route path="/predict" element={<PredictPage />} />
        </Routes>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Add nav link to Navbar.jsx**

In `medicluster/frontend/src/components/Navbar.jsx`, add `{ to: "/predict", label: "Predict" }` to the nav links array:

```jsx
{[
  { to: "/",          label: "Home" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/imaging",   label: "Imaging" },
  { to: "/predict",   label: "Predict" },
].map(({ to, label }) => (
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000/predict`. Confirm:
- "Predict" link appears in navbar and highlights when active
- Form shows 13 vital fields
- Cluster result dropdown shows saved results (or the "run clustering first" message if none)
- Submitting populated vitals shows risk tier badge, confidence bar, feature deviations, distance chart

- [ ] **Step 4: Commit**

```bash
git add medicluster/frontend/src/App.jsx medicluster/frontend/src/components/Navbar.jsx
git commit -m "feat: wire /predict route and Predict navbar link"
```
