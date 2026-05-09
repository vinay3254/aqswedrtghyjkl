# Patient Health Risk Segregation — Full Build Prompt

Paste this entire prompt into Claude Code / Cursor to generate the complete project.

---

You are a senior full-stack ML engineer. Build me a complete, production-ready **Patient Health Risk Segregation** web application from scratch. This is a hackathon project.

**Project Name:** MediCluster  
**Tagline:** AI-powered patient risk stratification using unsupervised clustering

---

## Tech Stack

- **Frontend:** React.js (Vite), Tailwind CSS, Recharts, D3.js
- **Backend API:** Node.js + Express.js
- **ML Engine:** Python 3.10 + Flask
- **Database:** MongoDB (Mongoose)
- **Communication:** REST API (Axios)
- **Auth:** JWT (basic, for demo)

---

## Project Structure

```
medicluster/
├── frontend/                  # React Vite app
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── UploadPanel.jsx
│   │   │   ├── AlgorithmSelector.jsx
│   │   │   ├── ClusterScatterPlot.jsx
│   │   │   ├── RiskDonutChart.jsx
│   │   │   ├── PatientTable.jsx
│   │   │   ├── MetricsPanel.jsx
│   │   │   ├── DendrogramView.jsx
│   │   │   └── ComparisonPanel.jsx
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── DashboardPage.jsx
│   │   │   └── ResultsPage.jsx
│   │   ├── api/
│   │   │   └── apiClient.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── backend/                   # Node.js Express API gateway
│   ├── routes/
│   │   ├── dataRoutes.js
│   │   └── clusterRoutes.js
│   ├── models/
│   │   ├── Dataset.js
│   │   └── ClusterResult.js
│   ├── controllers/
│   │   ├── dataController.js
│   │   └── clusterController.js
│   ├── middleware/
│   │   └── auth.js
│   ├── server.js
│   └── package.json
│
├── ml-engine/                 # Python Flask ML service
│   ├── app.py
│   ├── clustering/
│   │   ├── kmeans.py
│   │   ├── dbscan.py
│   │   ├── hierarchical.py
│   │   └── gmm.py
│   ├── preprocessing/
│   │   └── pipeline.py
│   ├── evaluation/
│   │   └── metrics.py
│   ├── utils/
│   │   └── risk_labeler.py
│   └── requirements.txt
│
├── docker-compose.yml
└── README.md
```

---

## Build Instructions

Build in phases. Implement each phase fully before moving on.

---

### PHASE 1 — Python ML Engine (Flask)

**File: `ml-engine/app.py`**

Create a Flask app with CORS enabled. Expose these endpoints:

- `POST /cluster` — Main clustering endpoint
- `GET /health` — Health check
- `POST /preprocess-preview` — Returns preview stats of uploaded data

**File: `ml-engine/preprocessing/pipeline.py`**

Build a `preprocess(df)` function that:
1. Drops non-numeric columns except `patient_id`
2. Fills missing values with column median
3. Removes outliers using IQR method (1.5x IQR)
4. Applies `StandardScaler` to all feature columns
5. Runs PCA to 2 components for visualization coordinates
6. Returns: cleaned df, scaled array, PCA coordinates, feature names

**File: `ml-engine/clustering/kmeans.py`**

```python
def run_kmeans(X, k=4):
    # KMeans with k-means++ init, 300 max_iter, 10 n_init
    # Returns: labels array, centroids, inertia
```

**File: `ml-engine/clustering/dbscan.py`**

```python
def run_dbscan(X, eps=0.5, min_samples=5):
    # DBSCAN clustering
    # Returns: labels array (-1 = noise/outlier)
```

**File: `ml-engine/clustering/hierarchical.py`**

```python
def run_hierarchical(X, n_clusters=4, linkage='ward'):
    # AgglomerativeClustering
    # Also compute linkage matrix for dendrogram using scipy
    # Returns: labels array, linkage_matrix (for dendrogram)
```

**File: `ml-engine/clustering/gmm.py`**

```python
def run_gmm(X, n_components=4, covariance_type='full'):
    # GaussianMixture with EM
    # Returns: labels (hard), probabilities (soft, shape NxK)
```

**File: `ml-engine/evaluation/metrics.py`**

```python
def compute_metrics(X, labels):
    # Returns dict with:
    # silhouette_score, davies_bouldin_score, calinski_harabasz_score
    # Handle edge cases: noise-only labels, single cluster
```

**File: `ml-engine/utils/risk_labeler.py`**

```python
def label_risk_tiers(labels, centroids_or_means, feature_names, scaler):
    # Map cluster IDs to risk tiers: Low / Moderate / High / Critical
    # Use composite score of: blood_pressure, glucose, bmi, age, cholesterol
    # Sort clusters by composite risk score, assign tiers accordingly
    # Returns: dict mapping cluster_id -> risk_tier string
```

**`POST /cluster` endpoint must:**
1. Accept JSON: `{ data: [...patient rows...], algorithm: "kmeans"|"dbscan"|"hierarchical"|"gmm"|"all", params: {...} }`
2. Run preprocessing pipeline
3. Run specified algorithm(s)
4. Compute metrics
5. Label risk tiers
6. Return JSON:
```json
{
  "patients": [
    {
      "patient_id": "...",
      "cluster_id": 0,
      "risk_tier": "High",
      "pca_x": 1.23,
      "pca_y": -0.45,
      "gmm_probabilities": [0.05, 0.10, 0.70, 0.15]
    }
  ],
  "metrics": {
    "silhouette": 0.48,
    "davies_bouldin": 0.92,
    "calinski_harabasz": 312.4
  },
  "risk_distribution": {
    "Low": 120, "Moderate": 85, "High": 47, "Critical": 16
  },
  "cluster_profiles": [
    { "cluster_id": 0, "risk_tier": "Low", "size": 120, "centroid_features": {...} }
  ],
  "linkage_matrix": [...],
  "algorithm": "kmeans"
}
```

**`ml-engine/requirements.txt`:**
```
flask
flask-cors
pandas
numpy
scikit-learn
scipy
```

---

### PHASE 2 — Node.js Backend (Express + MongoDB)

**File: `backend/server.js`**

Express server on port 5000. Connect to MongoDB. Enable CORS for `http://localhost:3000`.

**File: `backend/models/Dataset.js`**

Mongoose schema:
```
name, uploadedAt, rowCount, featureNames[], rawData (array of objects), createdAt
```

**File: `backend/models/ClusterResult.js`**

Mongoose schema:
```
datasetId (ref Dataset), algorithm, params, patients[], metrics{}, riskDistribution{}, clusterProfiles[], createdAt
```

**File: `backend/routes/dataRoutes.js`**

- `POST /api/data/upload` — Accept CSV via `multer`, parse with `csv-parse`, save to MongoDB, return `{ datasetId, preview, featureNames, rowCount }`
- `GET /api/data/:id` — Return dataset by ID
- `GET /api/data` — List all datasets

**File: `backend/routes/clusterRoutes.js`**

- `POST /api/cluster` — Receive `{ datasetId, algorithm, params }`, fetch dataset from MongoDB, forward to Python ML engine at `http://localhost:8000/cluster`, save result to MongoDB, return result to frontend
- `GET /api/cluster/:id` — Get cluster result by ID
- `GET /api/cluster/history/:datasetId` — Get all cluster runs for a dataset

**Dependencies:** `express`, `mongoose`, `multer`, `csv-parse`, `axios`, `cors`, `dotenv`

---

### PHASE 3 — React Frontend (Vite + Tailwind)

**Design Aesthetic:**  
Dark clinical dashboard. Deep navy/slate background (`#0A0F1E`). Electric teal accents (`#00D4AA`). Risk tiers in red/orange/yellow/green. Monospace font for data. Clean sans-serif for UI. No gradients — flat dark panels with subtle borders. Medical precision meets hacker terminal.

**File: `frontend/src/pages/DashboardPage.jsx`**

Main layout with:
- Left sidebar: `UploadPanel` + `AlgorithmSelector`
- Center: `ClusterScatterPlot` (main visualization)
- Right panel: `RiskDonutChart` + `MetricsPanel`
- Bottom: `PatientTable`
- Tab to switch to `ComparisonPanel` and `DendrogramView`

**File: `frontend/src/components/UploadPanel.jsx`**

- Drag-and-drop CSV upload zone
- Shows upload progress bar
- On success: show dataset name, row count, feature list as tags
- "Use Sample Dataset" button that loads the Pima Diabetes dataset from a bundled JSON

Include a bundled sample dataset at `frontend/src/data/sample_patients.json` — generate 100 synthetic patient records with these fields:
```
patient_id, age, gender, bmi, systolic_bp, diastolic_bp, glucose, hba1c, cholesterol, hdl, ldl, triglycerides, heart_rate, spo2, num_medications
```
Make values realistic and varied enough to produce 4 distinct clusters.

**File: `frontend/src/components/AlgorithmSelector.jsx`**

- Tab or button group to select: K-Means | DBSCAN | Hierarchical | GMM | All
- Dynamic parameter controls per algorithm:
  - K-Means: K slider (2–8), init method dropdown
  - DBSCAN: eps slider (0.1–2.0), minPts slider (2–20)
  - Hierarchical: n_clusters slider, linkage dropdown (ward/complete/average)
  - GMM: n_components slider, covariance_type dropdown
- "Run Clustering" button — triggers API call
- Show loading spinner while processing

**File: `frontend/src/components/ClusterScatterPlot.jsx`**

- Recharts ScatterChart with PCA coordinates
- Color each point by risk tier: green=Low, yellow=Moderate, orange=High, red=Critical
- Hover tooltip showing: patient_id, risk_tier, top 3 feature values
- Zoom and pan support
- Toggle to switch between PCA and raw feature axes (dropdown for x-axis, y-axis feature)
- Noise points (DBSCAN) shown as grey X markers

**File: `frontend/src/components/RiskDonutChart.jsx`**

- Recharts PieChart (donut style) showing count per risk tier
- 4 segments: green, yellow, orange, red
- Center label showing total patients
- Legend with count and % for each tier

**File: `frontend/src/components/MetricsPanel.jsx`**

Show 3 metric cards:
- Silhouette Score (gauge from -1 to 1, color coded)
- Davies-Bouldin Index (lower bar, green = good)
- Calinski-Harabasz Score (higher bar, green = good)
Each card shows value, label, and a brief plain-English interpretation.

**File: `frontend/src/components/PatientTable.jsx`**

- Sortable, filterable table
- Columns: Patient ID, Age, BMI, BP, Glucose, Risk Tier (colored badge), Cluster ID
- Search bar to filter by patient ID
- Filter dropdown by risk tier
- "Export CSV" button
- Pagination (20 rows per page)

**File: `frontend/src/components/ComparisonPanel.jsx`**

Side-by-side comparison of all 4 algorithms:
- Run all algorithms simultaneously (use `algorithm: "all"` endpoint)
- Show metrics table comparing all 4
- Show 4 mini scatter plots in a 2x2 grid
- Highlight best algorithm per metric

**File: `frontend/src/components/DendrogramView.jsx`**

- Use D3.js to render the dendrogram from `linkage_matrix`
- Show cluster labels at leaves
- Horizontal cut-line slider to control number of clusters
- Color branches by resulting risk tier assignment

**File: `frontend/src/api/apiClient.js`**

```javascript
// Axios instance with base URL http://localhost:5000
// uploadDataset(file) — POST /api/data/upload
// runClustering(datasetId, algorithm, params) — POST /api/cluster
// getClusterResult(id) — GET /api/cluster/:id
// getHistory(datasetId) — GET /api/cluster/history/:datasetId
```

**File: `frontend/src/pages/HomePage.jsx`**

Landing page with:
- Hero: "MediCluster" title, tagline, "Get Started" CTA
- 4 feature cards: each algorithm with icon + 1-line description
- How it works: 3-step visual (Upload → Cluster → Analyze)
- Dark clinical aesthetic throughout

---

### PHASE 4 — Docker Compose

**File: `docker-compose.yml`**

```yaml
version: '3.8'
services:
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on: [backend]

  backend:
    build: ./backend
    ports: ["5000:5000"]
    environment:
      MONGO_URI: mongodb://mongo:27017/medicluster
      ML_ENGINE_URL: http://ml-engine:8000
    depends_on: [mongo, ml-engine]

  ml-engine:
    build: ./ml-engine
    ports: ["8000:8000"]

  mongo:
    image: mongo:6
    ports: ["27017:27017"]
    volumes: [mongo_data:/data/db]

volumes:
  mongo_data:
```

Add Dockerfiles for each service. Frontend Dockerfile uses `node:20-alpine` with `npm run build` served via `serve`. Backend uses `node:20-alpine`. ML engine uses `python:3.10-slim`.

---

### PHASE 5 — README

Write a `README.md` with:
- Project overview and demo screenshot placeholder
- Architecture diagram (ASCII)
- Setup instructions (Docker Compose and manual)
- API endpoint documentation
- Sample dataset description
- Algorithm explanations (2–3 lines each)
- Team: CtrlAltElite | M S Engineering College

---

## Constraints

- All API responses must be JSON
- Frontend must handle loading, error, and empty states gracefully
- The system must work end-to-end with the bundled sample dataset without any external API keys
- Risk tier color coding must be consistent across all components (green/yellow/orange/red)
- The ML engine must handle edge cases: all same cluster, noise-only DBSCAN output, single patient
- Code must be clean, commented, and production-ready

---

## Start

Begin with **Phase 1** (Python ML Engine). Build all files completely. Then confirm before proceeding to Phase 2.
