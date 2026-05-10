# Patient Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/patient/:patientId` page that aggregates everything MediCluster knows about one patient: imaging history (from PatientMedia via the existing media endpoints) and cluster membership history (from ClusterResults via a new backend endpoint).

**Architecture:** One new backend endpoint `GET /api/cluster/patient/:patientId` added to `clusterRoutes.js` (must be registered before `GET /:id`). A new `PatientPage.jsx` with three sections: patient header, imaging grid, and clustering history table. Routes `/patient` and `/patient/:patientId` added to `App.jsx`. "Patients" nav link added to Navbar.

**Tech Stack:** Node/Express + Mongoose (backend), React + Tailwind (frontend)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `medicluster/backend/routes/clusterRoutes.js` | Modify | Add GET /api/cluster/patient/:patientId before /:id |
| `medicluster/frontend/src/api/apiClient.js` | Modify | Add getPatientClusterHistory |
| `medicluster/frontend/src/pages/PatientPage.jsx` | Create | Patient summary page |
| `medicluster/frontend/src/App.jsx` | Modify | Add /patient and /patient/:patientId routes |
| `medicluster/frontend/src/components/Navbar.jsx` | Modify | Add "Patients" nav link |

---

### Task 1: Backend — GET /api/cluster/patient/:patientId

**Files:**
- Modify: `medicluster/backend/routes/clusterRoutes.js`

This endpoint searches all ClusterResults for any that contain the given patientId in their `patients` array, and returns up to 5 most recent matches with summary info. It must be registered **before** `router.get("/:id", ...)` because Express matches in order and "patient" would otherwise be matched as an `:id` param.

Note: `patients` in MongoDB are stored as normalized rows with flat fields. The patient's `patient_id` field matches the URL parameter.

- [ ] **Step 1: Add the route in clusterRoutes.js**

Open `medicluster/backend/routes/clusterRoutes.js`. Insert the following block **immediately before** the line `// ── GET /api/cluster/results ──` (which is before `// ── GET /api/cluster/:id ──`):

```js
// ── GET /api/cluster/patient/:patientId ──────────────────────────────────
router.get("/patient/:patientId", async (req, res, next) => {
  const { patientId } = req.params;
  if (!patientId || patientId.trim() === "") {
    return res.status(400).json({ error: "patientId is required" });
  }

  try {
    // Find results that contain this patient; use $elemMatch and projection
    const results = await ClusterResult.find(
      { "patients.patient_id": patientId },
      {
        algorithm: 1,
        createdAt: 1,
        "patients.$": 1,   // $elemMatch projection — returns only the matching patient element
      }
    )
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const history = results.map((r) => {
      const p = (r.patients || [])[0];
      return {
        resultId: r._id,
        algorithm: r.algorithm,
        createdAt: r.createdAt,
        cluster_id: p?.cluster_id ?? null,
        risk_tier: p?.risk_tier ?? null,
        pca_x: p?.pca_x ?? null,
        pca_y: p?.pca_y ?? null,
      };
    });

    return res.json(history);
  } catch (err) {
    return next(err);
  }
});
```

- [ ] **Step 2: Test the endpoint**

Start the backend. Open the Dashboard, run a clustering job on a dataset that has named patient IDs. Then:

```bash
curl http://localhost:5000/api/cluster/patient/P001
```

Expected: JSON array of up to 5 objects, each with `resultId`, `algorithm`, `createdAt`, `cluster_id`, `risk_tier`. Empty array `[]` if patient not found in any result.

- [ ] **Step 3: Commit**

```bash
git add medicluster/backend/routes/clusterRoutes.js
git commit -m "feat: add GET /api/cluster/patient/:patientId endpoint"
```

---

### Task 2: Frontend API client function

**Files:**
- Modify: `medicluster/frontend/src/api/apiClient.js`

- [ ] **Step 1: Add getPatientClusterHistory to apiClient.js**

Add this function before the `export default api;` line:

```js
/**
 * Get clustering history for a specific patient (up to 5 most recent results).
 * Returns [{ resultId, algorithm, createdAt, cluster_id, risk_tier, pca_x, pca_y }]
 */
export async function getPatientClusterHistory(patientId) {
  const res = await api.get(`/cluster/patient/${encodeURIComponent(patientId)}`);
  return res.data;
}
```

- [ ] **Step 2: Commit**

```bash
git add medicluster/frontend/src/api/apiClient.js
git commit -m "feat: add getPatientClusterHistory API client function"
```

---

### Task 3: Frontend — PatientPage.jsx

**Files:**
- Create: `medicluster/frontend/src/pages/PatientPage.jsx`

Three sections:
1. **Header**: patient ID (large monospace), overall risk tier badge from most recent cluster result, last updated timestamp, plus a search input to navigate to a different patient.
2. **Imaging section**: grid of uploaded media using `listPatientMedia` + `getMediaFileUrl`. Each card shows image thumbnail + top finding + severity badge from `analyzePatientMedia` — but imaging analysis is **not** re-run here; images are shown as thumbnails only (analysis is on the Imaging page). Show filenames and upload date.
3. **Clustering history section**: table with Algorithm | Risk Tier | Cluster ID | Date columns, colour-coded risk badges.

- [ ] **Step 1: Create PatientPage.jsx**

Create `medicluster/frontend/src/pages/PatientPage.jsx`:

```jsx
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { listPatientMedia, getMediaFileUrl, getPatientClusterHistory } from "../api/apiClient";

const TIER_BADGE = {
  Low:      "bg-emerald-100 text-emerald-800 border border-emerald-200",
  Moderate: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  High:     "bg-orange-100 text-orange-800 border border-orange-200",
  Critical: "bg-red-100 text-red-800 border border-red-200",
  Noise:    "bg-slate-100 text-slate-600 border border-slate-200",
};

function tierBadgeClass(tier) {
  return TIER_BADGE[tier] ?? TIER_BADGE.Noise;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function PatientSearch({ initialValue, onSearch }) {
  const [value, setValue] = useState(initialValue || "");
  function handleSubmit(e) {
    e.preventDefault();
    const id = value.trim();
    if (id) onSearch(id);
  }
  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter patient ID…"
        className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
      />
      <button type="submit" className="btn-primary text-sm py-1.5 px-4">
        View Patient
      </button>
    </form>
  );
}

function MediaCard({ file }) {
  const isImage = file.contentType?.startsWith("image/");
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {isImage ? (
        <img
          src={getMediaFileUrl(file.fileId)}
          alt={file.filename}
          className="w-full h-32 object-cover bg-slate-100"
          onError={(e) => { e.target.style.display = "none"; }}
        />
      ) : (
        <div className="w-full h-32 bg-slate-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      )}
      <div className="p-2">
        <p className="text-xs font-mono text-slate-600 truncate">{file.filename}</p>
        <p className="text-xs text-slate-400">{formatDate(file.uploadedAt)}</p>
        <a
          href={getMediaFileUrl(file.fileId)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline"
        >
          View
        </a>
      </div>
    </div>
  );
}

function ClusterHistoryTable({ history }) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        Not found in any clustering run.
      </div>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-100">
          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Algorithm</th>
          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Risk Tier</th>
          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cluster ID</th>
          <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
        </tr>
      </thead>
      <tbody>
        {history.map((row, i) => (
          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
            <td className="py-2 px-3 font-mono text-slate-700 uppercase text-xs">{row.algorithm}</td>
            <td className="py-2 px-3">
              {row.risk_tier ? (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tierBadgeClass(row.risk_tier)}`}>
                  {row.risk_tier}
                </span>
              ) : <span className="text-slate-300">—</span>}
            </td>
            <td className="py-2 px-3 font-mono text-slate-600">
              {row.cluster_id !== null ? `Cluster ${row.cluster_id}` : "—"}
            </td>
            <td className="py-2 px-3 text-slate-400 text-xs">{formatDate(row.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function PatientPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();

  const [media, setMedia] = useState([]);
  const [clusterHistory, setClusterHistory] = useState([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [loadingCluster, setLoadingCluster] = useState(false);

  const loadPatient = useCallback((id) => {
    if (!id) return;
    setLoadingMedia(true);
    setLoadingCluster(true);
    setMedia([]);
    setClusterHistory([]);

    listPatientMedia(id)
      .then(setMedia)
      .catch(() => setMedia([]))
      .finally(() => setLoadingMedia(false));

    getPatientClusterHistory(id)
      .then(setClusterHistory)
      .catch(() => setClusterHistory([]))
      .finally(() => setLoadingCluster(false));
  }, []);

  useEffect(() => {
    if (patientId) loadPatient(patientId);
  }, [patientId, loadPatient]);

  function handleSearch(id) {
    navigate(`/patient/${id}`);
  }

  const mostRecentCluster = clusterHistory[0];
  const overallRisk = mostRecentCluster?.risk_tier ?? null;

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-50 p-6">
      <div className="max-w-screen-xl mx-auto space-y-6">

        {/* Search bar */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Patient Overview</h1>
          <PatientSearch initialValue={patientId} onSearch={handleSearch} />
        </div>

        {!patientId ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">Enter a patient ID above to view their profile.</p>
          </div>
        ) : (
          <>
            {/* Patient header */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 flex items-center gap-6">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-mono text-2xl font-bold text-slate-900">{patientId}</p>
                <div className="flex items-center gap-3 mt-1">
                  {overallRisk ? (
                    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${tierBadgeClass(overallRisk)}`}>
                      {overallRisk} Risk
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">Unanalyzed</span>
                  )}
                  {mostRecentCluster && (
                    <span className="text-xs text-slate-400">
                      Last clustered {formatDate(mostRecentCluster.createdAt)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">{media.length} image{media.length !== 1 ? "s" : ""} uploaded</p>
                <p className="text-xs text-slate-400">{clusterHistory.length} clustering run{clusterHistory.length !== 1 ? "s" : ""}</p>
              </div>
            </div>

            {/* Imaging section */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-4">Uploaded Images & Documents</p>
              {loadingMedia ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : media.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  No images uploaded for this patient.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {media.map((file) => (
                    <MediaCard key={file.fileId} file={file} />
                  ))}
                </div>
              )}
            </div>

            {/* Clustering history section */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-700 mb-4">Clustering History</p>
              {loadingCluster ? (
                <p className="text-sm text-slate-400">Loading…</p>
              ) : (
                <ClusterHistoryTable history={clusterHistory} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add medicluster/frontend/src/pages/PatientPage.jsx
git commit -m "feat: add PatientPage with imaging and cluster history sections"
```

---

### Task 4: Wire PatientPage into App.jsx and Navbar.jsx

**Files:**
- Modify: `medicluster/frontend/src/App.jsx`
- Modify: `medicluster/frontend/src/components/Navbar.jsx`

- [ ] **Step 1: Add routes to App.jsx**

In `medicluster/frontend/src/App.jsx`, add the import and two routes:

```jsx
import PatientPage from "./pages/PatientPage";

// Inside <Routes>:
<Route path="/patient" element={<PatientPage />} />
<Route path="/patient/:patientId" element={<PatientPage />} />
```

Full updated App.jsx (cumulative with PredictPage from Feature C):

```jsx
import React from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import ResultsPage from "./pages/ResultsPage";
import ImagingPage from "./pages/ImagingPage";
import PredictPage from "./pages/PredictPage";
import PatientPage from "./pages/PatientPage";

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
          <Route path="/patient" element={<PatientPage />} />
          <Route path="/patient/:patientId" element={<PatientPage />} />
        </Routes>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Add nav link to Navbar.jsx**

In `medicluster/frontend/src/components/Navbar.jsx`, add `{ to: "/patient", label: "Patients" }` to the nav links array:

```jsx
{[
  { to: "/",          label: "Home" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/imaging",   label: "Imaging" },
  { to: "/predict",   label: "Predict" },
  { to: "/patient",   label: "Patients" },
].map(({ to, label }) => (
```

Note: the active link highlight uses `pathname === to`. For `/patient/:patientId` the highlight won't fire (pathname would be `/patient/P001`). This is acceptable — the "Patients" link highlights when on `/patient` exactly. This is fine for the scope.

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3000/patient`. Confirm:
- "Patients" nav link present, highlights on `/patient`
- Blank search state shows the search bar and empty state card
- Entering a patient ID and clicking "View Patient" navigates to `/patient/P001`
- If the patient has media, a grid of thumbnails appears
- If the patient was in cluster runs, a table of history appears

- [ ] **Step 4: Commit**

```bash
git add medicluster/frontend/src/App.jsx medicluster/frontend/src/components/Navbar.jsx
git commit -m "feat: wire /patient routes and Patients navbar link"
```
