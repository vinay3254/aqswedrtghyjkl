# MediCluster: Patient Health Risk Segregation Platform - Comprehensive Technical Report

**Version:** 1.0  **Date:** May 2026  **Classification:** Technical Documentation

---

## TABLE OF CONTENTS

1. Executive Summary
2. Platform Overview & Vision
3. System Architecture
4. Technology Stack
5. ML Engine - Core Components
6. Preprocessing Pipeline
7. Clustering Algorithms (K-Means, DBSCAN, Hierarchical, GMM)
8. Risk Scoring System
9. SHAP Explainability
10. Anomaly Detection
11. AutoML & Feature Selection
12. Supervised Learning Module
13. NLP Clinical Notes Analyzer
14. Vital Signs Forecasting (LSTM + Prophet + MEWS)
15. Medical Imaging AI (Chest X-Ray Analysis)
16. RAG Chatbot (Clinical Q&A)
17. Drug Interaction Checker
18. Backend API Gateway
19. Frontend - All Pages & Features
20. Dashboard Page
21. Clinical AI Page
22. Imaging Page
23. ML Tools Page
24. Patient Management
25. Dispatch & Triage System
26. Nearby Hospitals Map
27. Reminders System
28. MCI Board
29. Ambulance Dispatch System
30. Data Flow & Workflow Diagrams
31. API Reference
32. Deployment & Docker
33. Security & Compliance
34. Performance & Scalability
35. Testing Strategy
36. Conclusion

---

## 1. EXECUTIVE SUMMARY

MediCluster is a full-stack, production-ready clinical decision support platform designed to automate patient health risk segregation using a combination of unsupervised machine learning, natural language processing, deep learning-based medical imaging, and real-time vital sign forecasting. Built for hospitals, clinics, and emergency departments, MediCluster enables clinicians to identify high-risk patients faster, prioritize care, and reduce preventable deteriorations.

### Key Capabilities at a Glance

| Capability | Technology | Outcome |
|---|---|---|
| Patient Clustering | K-Means, DBSCAN, Hierarchical, GMM | Groups patients by clinical similarity |
| Risk Scoring | Rule-based + ML scoring engine | 4-tier risk classification (Low/Moderate/High/Critical) |
| NLP Notes Analysis | SpaCy, BioBERT, Regex NER | ICD-10 coding, symptom extraction, trajectory |
| Vital Forecasting | LSTM (PyTorch), Prophet, MEWS | Predicts deterioration 3+ readings ahead |
| Imaging AI | DenseNet121, ResNet50 (TorchXRayVision) | Chest X-ray pathology detection (15+ conditions) |
| Explainability | SHAP, Feature Importance | Per-patient risk driver explanation |
| Clinical Chatbot | FAISS + TF-IDF RAG | Natural language patient data queries |
| Drug Safety | Rule-based interaction database | Flags major/moderate drug interactions |
| Anomaly Detection | Isolation Forest | Identifies statistically unusual patients |
| Ambulance Dispatch | WebSocket + Leaflet + OSRM | Real-time GPS-based ambulance routing |

### Platform Architecture Summary

MediCluster follows a modern three-tier microservices architecture:

- **Frontend**: React 18 + Vite + TailwindCSS (port 5173)
- **Backend**: Node.js + Express + MongoDB (port 5000)
- **ML Engine**: Python 3.11 + Flask (port 5001)

All three services communicate via REST APIs and are fully containerized with Docker.

---

## 2. PLATFORM OVERVIEW AND VISION

### 2.1 Problem Statement

In modern healthcare, patient overload is a critical challenge. Emergency departments worldwide face:

- **Triage bottlenecks**: Manual assessment of hundreds of patients daily
- **Missed deterioration signals**: Vital signs not continuously monitored
- **Unstructured clinical data**: Doctor notes, discharge summaries, and prescriptions locked in free text
- **Imaging backlogs**: Radiologists overwhelmed with X-ray and CT scan queues
- **Medication errors**: Drug interactions missed during prescription

MediCluster addresses all these challenges with a unified AI-powered platform.

### 2.2 Design Goals

1. **Zero labelled data required** - Core clustering works on raw patient data without pre-labelled risk classes
2. **Graceful degradation** - Every ML component falls back to rule-based logic if ML libraries are unavailable
3. **Clinical interpretability** - Every prediction includes plain-language explanations for clinicians
4. **Real-time operation** - Live vital monitoring, instant NLP analysis, and real-time dispatch
5. **Full observability** - SHAP explainability, MEWS scores, data quality flags, and confidence intervals on every output

### 2.3 Target Users

- **Emergency Physicians**: Real-time triage support and critical alert monitoring
- **Ward Nurses**: Continuous vital monitoring with MEWS-based early warning
- **Radiologists**: AI-assisted chest X-ray preliminary reading
- **Hospital Administrators**: Population-level risk dashboard and workload forecasting
- **Ambulance Dispatchers**: GPS-integrated real-time ambulance coordination

---

## 3. SYSTEM ARCHITECTURE

### 3.1 High-Level Architecture

`
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT TIER (Browser)                         │
│          React 18 + Vite SPA (Port 5173)                        │
│  Dashboard | Clinical AI | Imaging | Dispatch | Patient Mgmt    │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTP REST (CORS)
┌────────────────────▼────────────────────────────────────────────┐
│               BACKEND TIER (Node.js + Express)                   │
│                      Port 5000                                   │
│  /api/data  /api/cluster  /api/ai  /api/dispatch  /api/triage   │
│  /api/media  /api/reminders  /api/ml                            │
│                    MongoDB (Mongoose ODM)                         │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTP Proxy
┌────────────────────▼────────────────────────────────────────────┐
│              ML ENGINE TIER (Python + Flask)                     │
│                      Port 5001                                   │
│  /cluster  /risk-profile  /analyze-notes  /forecast-vitals      │
│  /analyze-image  /ask  /explain  /detect-anomalies              │
│  /optimal-k  /train-predictive-model  /drug-interactions        │
└─────────────────────────────────────────────────────────────────┘
`

### 3.2 Module Dependency Graph

`
app.py (Flask)
├── preprocessing/pipeline.py       ← StandardScaler + IQR + PCA
├── clustering/
│   ├── kmeans.py                   ← scikit-learn KMeans
│   ├── dbscan.py                   ← scikit-learn DBSCAN
│   ├── hierarchical.py             ← scipy linkage
│   └── gmm.py                      ← scikit-learn GaussianMixture
├── risk/advanced_risk.py           ← Scoring engine + triage
├── explainability/shap_explainer.py← SHAP + Ridge proxy
├── anomaly/isolation_forest.py     ← scikit-learn IsolationForest
├── automl/
│   ├── feature_selector.py         ← UMAP + t-SNE + MI + ANOVA
│   └── supervised.py               ← RF + GBM + LR/Ridge AutoML
├── nlp/notes_analyzer.py           ← SpaCy + Transformers + Regex
├── forecasting/vitals_forecaster.py← LSTM + Prophet + MEWS
├── imaging/
│   ├── analyzer.py                 ← TorchXRayVision DenseNet/ResNet
│   └── gradcam.py                  ← Grad-CAM heatmaps
├── chatbot/rag_assistant.py        ← FAISS + TF-IDF RAG
└── evaluation/metrics.py           ← Silhouette + Davies-Bouldin + CH
`

### 3.3 Data Storage Architecture

`
MongoDB Collections:
├── datasets        ← Uploaded patient CSV data
├── clusterresults  ← Clustering output + risk assignments
├── patients        ← Individual patient records
├── reminders       ← Clinical reminder tasks
├── dispatches      ← Ambulance dispatch records
├── triages         ← Emergency triage assessments
└── media           ← Uploaded imaging files (GridFS)
`

---

## 4. TECHNOLOGY STACK

### 4.1 ML Engine (Python)

| Library | Version | Purpose |
|---|---|---|
| Flask | 3.0.3 | REST API server |
| Flask-CORS | 4.0.1 | Cross-origin request handling |
| Pandas | 2.2.1 | Data manipulation |
| NumPy | 1.26.4 | Numerical computation |
| scikit-learn | 1.4.1 | ML algorithms + preprocessing |
| SciPy | 1.12.0 | Hierarchical clustering |
| PyTorch | 2.2.1 | LSTM forecasting |
| TorchXRayVision | 1.0.1 | Chest X-ray analysis models |
| Transformers | 4.40.0+ | BioBERT, summarization, sentiment |
| SpaCy | 3.7.0+ | NLP tokenization + NER |
| scispaCy | 0.5.5+ | Biomedical NER models |
| Prophet | 1.1.5+ | Time-series trend forecasting |
| SHAP | 0.45.0+ | Model explainability |
| UMAP-learn | 0.5.6+ | Dimensionality reduction |
| faiss-cpu | 1.8.0+ | Vector similarity search |
| pydicom | latest | DICOM medical image support |
| OpenCV (cv2) | latest | CLAHE image preprocessing |
| Pillow | 10.2.0 | Image loading and conversion |

### 4.2 Backend (Node.js)

| Library | Purpose |
|---|---|
| Express.js | REST API framework |
| Mongoose | MongoDB ODM |
| dotenv | Environment configuration |
| cors | Cross-origin handling |
| multer | File upload handling |
| axios | HTTP proxy to ML engine |
| jsonwebtoken | Authentication tokens |

### 4.3 Frontend (React)

| Library | Purpose |
|---|---|
| React 18 | UI framework |
| Vite | Build tool + dev server |
| TailwindCSS | Utility-first CSS |
| Recharts | Charts and data visualization |
| Leaflet.js | Interactive maps |
| D3.js | Dendrogram visualization |
| Axios | API communication |
| jsPDF | PDF export |

---

## 5. ML ENGINE — CORE COMPONENTS

### 5.1 Flask Application Entry Point (app.py)

The ML engine is a Flask application serving 25+ REST endpoints organized into logical groups:

**Core Endpoints:**
- POST /cluster — Main clustering endpoint supporting 4 algorithms
- GET /health — Service health check
- POST /preprocess-preview — Data statistics preview

**AutoML Endpoints:**
- POST /optimal-k — Elbow + Silhouette sweep to recommend best K
- POST /feature-importance — Mutual Information + ANOVA F-score ranking
- POST /reduce-dimensions — UMAP / t-SNE / PCA coordinate generation
- POST /detect-anomalies — Isolation Forest outlier detection
- POST /explain — SHAP feature importance
- POST /train-predictive-model — Supervised AutoML baseline training

**Risk Intelligence Endpoints:**
- POST /risk-profile — Single patient or batch risk profiling
- POST /population-risk — Cohort-level clinical analytics
- POST /compare-visits — Cross-visit risk delta analysis
- POST /patient-timeline — Longitudinal risk timeline
- POST /similar-patients — Clinical similarity search

**NLP Endpoints:**
- POST /analyze-notes — Full clinical note NLP pipeline
- POST /extract-symptoms — Symptom extraction convenience endpoint
- POST /drug-interactions — Drug-drug interaction checker

**Forecasting Endpoints:**
- POST /forecast-vitals — LSTM / Prophet vital forecasting + MEWS

**Imaging Endpoints:**
- GET /models — List available X-ray analysis models
- POST /analyze-image — Chest X-ray pathology detection
- POST /gradcam — Grad-CAM heatmap visualization

**Chatbot Endpoints:**
- POST /ask — Natural-language patient Q&A (RAG)

### 5.2 How the Main Clustering Endpoint Works

When POST /cluster is called:

1. Raw patient JSON data is received
2. preprocess() pipeline runs (cleaning, scaling, PCA)
3. Algorithm is dispatched (kmeans, dbscan, hierarchical, gmm, or ll)
4. label_risk_tiers() assigns Low/Moderate/High/Critical to each cluster
5. Per-patient records are built with cluster ID, risk tier, PCA coordinates, and feature values
6. Optionally: SHAP explanations are computed
7. Optionally: Isolation Forest anomaly flags are appended
8. Patient index is updated in the RAG chatbot vector store
9. Full response is returned as JSON

---

## 6. PREPROCESSING PIPELINE

### 6.1 Overview

File: ml-engine/preprocessing/pipeline.py

The preprocessing pipeline is the entry point for all patient data before any ML model is applied. It performs data cleaning, normalization, outlier removal, and dimensionality reduction in a reproducible, deterministic manner.

### 6.2 Pipeline Steps (In Order)

**Step 1 — Patient ID Extraction**
The patient_id column is separated from feature columns before numeric processing. Sequential ID columns (id, ow_id, ow_num, index) are also dropped to prevent them from influencing clustering.

**Step 2 — Numeric Column Selection**
Only numeric columns are retained for ML processing. Non-numeric columns (strings, categories) are recorded in dropped_non_numeric_columns and surfaced as warnings to the user.

**Step 3 — Missing Value Imputation**
Missing values are filled with the column median (not mean), making imputation robust to outliers. This ensures that extreme values in one record don't distort the fill value for others.

**Step 4 — IQR-Based Outlier Removal**
Rows with any feature value outside [Q1 - 1.5*IQR, Q3 + 1.5*IQR] are removed. The count of dropped rows is reported in the preprocessing report and surfaced as a warning to the frontend user.

**Step 5 — Standard Scaling (Z-Score Normalization)**
sklearn.preprocessing.StandardScaler is applied: each feature is transformed to zero mean and unit standard deviation. The scaler instance is returned (not just the transformed data) so it can be reused for risk tier labelling.

**Step 6 — PCA Dimensionality Reduction**
sklearn.decomposition.PCA reduces to 2 components for scatter plot visualization. If only 1 PCA component is possible (e.g., single-feature data), a zero column is appended to maintain shape consistency.

**Step 7 — Report Generation**
A preprocessing report dict is returned containing:
- ows_before / ows_after / dropped_rows
- dropped_non_numeric_columns
- eature_names (list of columns used)

### 6.3 Return Values

`python
return cleaned_df, X_scaled, pca_coords, feature_names, scaler, report
`

### 6.4 Preprocessing Warnings

The function _preprocessing_warnings() in pp.py converts the preprocessing report into human-readable warning strings that are included in the API response and displayed in the frontend banner.

### 6.5 Why These Choices Were Made

- **Median imputation over mean**: Median is robust to extreme values common in clinical data (e.g., a single erroneous glucose reading of 9999)
- **IQR outlier removal**: Standard statistical method for detecting clinical data entry errors
- **StandardScaler over MinMaxScaler**: StandardScaler is preferred for clustering because distance-based algorithms (K-Means, DBSCAN) are sensitive to scale but not to absolute range
- **PCA for visualization only**: PCA coordinates are used only for the scatter plot — clustering itself uses the full high-dimensional scaled feature space

---

## 7. CLUSTERING ALGORITHMS

### 7.1 K-Means Clustering

**File:** ml-engine/clustering/kmeans.py

K-Means is the default and most commonly used clustering algorithm in MediCluster. It partitions patients into K non-overlapping clusters by minimizing within-cluster sum of squared distances to centroids.

**Algorithm:**
1. Initialize K centroids using k-means++ (smart initialization to avoid poor convergence)
2. Assign each patient to the nearest centroid (Euclidean distance in scaled feature space)
3. Recompute centroids as the mean of all assigned patients
4. Repeat steps 2-3 until convergence (centroid positions stabilize)

**Parameters exposed via API:**
- k (default: 4) — Number of clusters
- init (default: k-means++) — Centroid initialization strategy

**Output:** labels, centroids, inertia

**When to use:** Large datasets with roughly spherical, similarly-sized clusters. Ideal for routine population segmentation.

**Limitations:** Assumes spherical clusters; sensitive to K selection (use /optimal-k endpoint first)

### 7.2 DBSCAN Clustering

**File:** ml-engine/clustering/dbscan.py

DBSCAN (Density-Based Spatial Clustering of Applications with Noise) discovers clusters of arbitrary shape and automatically identifies noise points (outliers), which it labels as cluster -1.

**Algorithm:**
1. For each point, find all neighbors within radius eps
2. Points with at least min_samples neighbors are core points
3. Core points within eps of each other form a cluster
4. Border points (fewer than min_samples neighbors but reachable from a core point) join the nearest cluster
5. All other points are labeled noise (-1)

**Parameters exposed via API:**
- eps (default: 0.5) — Neighborhood radius
- min_samples (default: 5) — Minimum points to form a dense region

**Output:** labels (including -1 for noise)

**Risk Tier for Noise:** Noise patients receive isk_tier = "Noise" — a dedicated tier indicating they are statistical outliers requiring individual clinical review.

**When to use:** When cluster shapes are irregular, dataset contains clinical outliers, or K is unknown.

### 7.3 Hierarchical (Agglomerative) Clustering

**File:** ml-engine/clustering/hierarchical.py

Hierarchical clustering builds a tree (dendrogram) of patient groupings by progressively merging the most similar patients/clusters bottom-up.

**Algorithm:**
1. Start with each patient as its own cluster
2. Compute pairwise distances between all clusters
3. Merge the two closest clusters
4. Repeat until the desired number of clusters remains
5. The linkage matrix records the merge history (used to render the dendrogram)

**Parameters exposed via API:**
- 
_clusters (default: 4) — Final number of clusters
- linkage (default: ward) — Merge criterion: ward, complete, verage, single

**Output:** labels, linkage_matrix (for dendrogram visualization)

**Ward Linkage:** Ward minimizes the total within-cluster variance at each merge step — generally producing the most compact, equal-sized clusters.

**Dendrogram Rendering:** The linkage_matrix is sent to the frontend's DendrogramView component which renders it using D3.js, showing the full merge hierarchy.

### 7.4 Gaussian Mixture Model (GMM)

**File:** ml-engine/clustering/gmm.py

GMM is a probabilistic clustering algorithm that models patient data as a mixture of Gaussian distributions. Unlike K-Means, GMM supports soft assignments — each patient receives a probability of belonging to each cluster.

**Algorithm:**
1. Initialize K Gaussian distributions with means, covariances, and weights
2. **E-step:** Compute posterior probability of each patient belonging to each Gaussian
3. **M-step:** Update Gaussian parameters to maximize the likelihood
4. Repeat E-M steps until convergence (log-likelihood stabilizes)

**Parameters exposed via API:**
- 
_components (default: 4) — Number of Gaussians
- covariance_type (default: ull) — Covariance matrix shape: ull, 	ied, diag, spherical

**Output:** labels (hard assignment from argmax), probabilities (soft N×K probability matrix)

**GMM Soft Probabilities:** The frontend displays GMM soft probabilities per patient, allowing clinicians to see uncertainty. A patient with 55% probability in "High Risk" cluster and 45% in "Critical" cluster requires careful review.

### 7.5 Algorithm Comparison Mode (lgorithm: "all")

When lgorithm: "all" is specified, all four algorithms run in parallel (with independent error handling), and results are returned as a dictionary keyed by algorithm name. The frontend's **Comparison Panel** renders these side-by-side using radar charts showing Silhouette Score, Davies-Bouldin Index, and Calinski-Harabasz Index.

---

## 8. RISK SCORING SYSTEM

### 8.1 Overview

**File:** ml-engine/risk/advanced_risk.py

The Advanced Risk module is the clinical intelligence core of MediCluster. It transforms raw patient data into actionable clinical risk assessments without requiring pre-trained supervised models or labelled data.

The system is **intentionally dependency-light** — designed to deliver practical risk baselines even before a hospital has enough labelled data to train supervised models.

### 8.2 Risk Tier Classification

Patients are classified into four tiers based on their computed risk score:

| Risk Score | Tier | Triage Priority | Action |
|---|---|---|---|
| 0–24 | **Low** | P4 - Routine | Standard monitoring |
| 25–49 | **Moderate** | P3 - Soon | Follow-up review |
| 50–74 | **High** | P2 - Urgent | Same-day doctor review |
| 75–100 | **Critical** | P1 - Immediate | Emergency response |

### 8.3 Field Alias Resolution

A key innovation is the FIELD_ALIASES dictionary that maps dozens of real-world column name variants to canonical field names:

`python
"systolic_bp": ["systolic_bp", "sbp", "bp_systolic", "systolic", "blood_pressure_systolic"]
"heart_rate":  ["heart_rate", "hr", "pulse", "pulse_rate"]
"spo2":        ["spo2", "oxygen_saturation", "o2_saturation", "oxygen"]
`

This allows the system to work with data from any hospital's EHR system without requiring column name standardization.

### 8.4 Vital Sign Risk Components

The _base_components() function evaluates each available vital sign and produces a score contribution:

**Blood Pressure (Systolic):**
- BP < 90 → +18 points (Critical: shock risk)
- BP < 100 → +9 points (High: hypotension)
- BP ≥ 180 → +12 points (High: hypertensive crisis)

**Heart Rate:**
- HR ≥ 130 → +12 points (Critical: severe tachycardia)
- HR ≥ 110 → +7 points (High: tachycardia)
- HR < 45 → +8 points (High: marked bradycardia)

**Oxygen Saturation (SpO2):**
- SpO2 < 90 → +18 points (Critical: severe hypoxia)
- SpO2 < 94 → +9 points (High: hypoxia)

**Respiratory Rate:**
- RR ≥ 30 → +15 points (Critical: respiratory distress)
- RR ≥ 24 → +9 points (High: elevated)
- RR < 10 → +8 points (High: bradypnea)

**Temperature:**
- Temp ≥ 39°C → +8 points (High: high fever)
- Temp < 35°C → +10 points (High: hypothermia)

**Troponin:**
- Troponin > 0.04 → +18 points (Critical: myocardial injury)

**Lactate:**
- Lactate ≥ 4 → +16 points (Critical: shock / severe sepsis)
- Lactate ≥ 2 → +8 points (High: elevated)

**Creatinine / eGFR:**
- Creatinine ≥ 2.0 → +10 points (High: marked elevation)
- eGFR < 30 → +14 points (High: advanced kidney impairment)

### 8.5 Disease-Specific Risk Scores

Six disease-specific risk scores are computed simultaneously:

1. **Diabetes Risk** — HbA1c ≥ 6.5 (+18–30), glucose > 200 (+12–20), BMI ≥ 30 (+8), symptom text hits
2. **Cardiac Risk** — Troponin > 0.04 (+35), chest pain text (+20), hypertensive/hypotensive BP (+15), heart disease history (+18)
3. **Kidney Risk** — Creatinine ≥ 1.5 (+14–24), eGFR < 60 (+16–30), diabetes/hypertension co-morbidity (+8)
4. **Respiratory Risk** — SpO2 < 94 (+20–35), RR ≥ 24 (+18), COPD history (+18), symptom text hits
5. **Stroke Risk** — Age ≥ 65 (+8), focal neurological symptoms text (+18 each), hypertension (+8), atrial fibrillation (+16)
6. **Sepsis Risk** — WBC abnormal (+16), lactate ≥ 2 (+16–28), SBP < 100 (+14), RR ≥ 22 (+10), infection keywords

### 8.6 Composite Score Calculation

`python
base_score = sum(component["score"] for component in components)
disease_bonus = max(disease_risk_scores) * 0.25
final_score = cap(base_score + disease_bonus, 0, 100)
`

### 8.7 Outcome Probability Estimates

Using a logistic sigmoid function, the system estimates:

- **ICU Admission Probability**: Sigmoid(score + 8 × critical_component_count, center=62)
- **Readmission Probability**: Sigmoid(score + 4 × prior_admissions, center=55)
- **Mortality Probability**: Sigmoid(score + age_penalty, center=78)
- **Length of Stay (days)**: max(1.0, 1.2 + score/18 + 5×ICU_prob + 0.6×prior_admissions)

### 8.8 Automated Care Plan Generation

Based on the risk tier and highest-scoring disease categories, the system generates a personalized care plan:

- **Critical**: "Immediate clinician review and emergency response activation."
- **High**: "Urgent doctor review with increased monitoring."
- For diabetes-dominant patients: "Review glucose control, diet, medication adherence, and HbA1c follow-up."
- For cardiac-dominant patients: "Evaluate cardiac symptoms urgently and consider ECG/troponin pathway."
- For sepsis-dominant patients: "Screen for infection source and consider sepsis bundle workflow."

### 8.9 Triage Department Routing

The _rank_departments() function scores departments based on symptom text, ICD code keywords, and disease risk scores to recommend the most appropriate clinical routing:

- Emergency → sepsis, cardiac arrest, respiratory failure, unconscious
- Cardiology → chest pain, troponin, heart failure, palpitations
- Pulmonology → dyspnea, pneumonia, COPD, low SpO2
- Nephrology → creatinine, eGFR, kidney disease
- Endocrinology → diabetes, HbA1c, hyperglycemia
- Neurology → stroke, slurred speech, facial droop, seizure

### 8.10 Population Risk Intelligence

The population_risk_intelligence() function processes an entire patient cohort and returns:

- Per-patient risk profiles
- Risk distribution across tiers
- Critical alerts list (P1 triage patients)
- Doctor review queue (sorted by risk score descending)
- Department workload forecast
- Hospital capacity estimates (expected ICU cases, high-risk cases, average LOS)
- **Fairness checks**: Compares average risk scores across age groups (0–17, 18–39, 40–64, 65+) and gender groups to detect potential scoring disparities

### 8.11 Patient Timeline & Visit Comparison

uild_patient_timeline() accepts a list of dated events (visits, vitals snapshots, notes) and computes a risk score at each time point, returning a trend trajectory (improving / stable / worsening).

compare_patient_visits() compares two visit snapshots and returns:
- Previous and current risk profiles
- Risk delta (change in score)
- Trend label with clinical narrative

### 8.12 Similar Patient Search

ind_similar_patients() computes normalized Euclidean distance between a target patient and a cohort using shared numeric fields, returning the top-K most clinically similar patients sorted by similarity score (0–1).

---

## 9. SHAP EXPLAINABILITY

### 9.1 Overview

**File:** ml-engine/explainability/shap_explainer.py

SHAP (SHapley Additive exPlanations) is a game-theoretic approach to explain the output of any ML model. In MediCluster, SHAP is used to explain why a patient was assigned to a particular cluster and which features drove that assignment.

### 9.2 Technical Implementation

Since clustering is unsupervised (no target variable), MediCluster uses a clever proxy approach:

1. **Proxy Model**: A Ridge regression model is trained to predict cluster labels from features (treating cluster IDs as the target)
2. **SHAP LinearExplainer**: SHAP's LinearExplainer is applied to the Ridge proxy with eature_perturbation="interventional" (most accurate for clinical interpretation)
3. **Global Importance**: Mean absolute SHAP value per feature across all patients
4. **Per-Patient Top Drivers**: Top 3 features by absolute SHAP value per patient, with direction (increases_risk / decreases_risk)

### 9.3 Subsampling Strategy

For performance, SHAP is computed on a subsample of max 200 patients (configurable via max_samples). Random sampling ensures representative coverage.

### 9.4 Graceful Degradation

If shap is not installed, the endpoint returns a stub response with zero scores and a message: "Install shap>=0.45.0 to enable explainability." — the frontend handles this gracefully by hiding the SHAP panel.

### 9.5 Frontend Integration

The Dashboard's right sidebar has a **SHAP Explainability Panel** that:
- Is collapsed by default (lazy-loaded on demand to avoid performance impact)
- Shows a horizontal bar chart of mean_abs_shap per feature
- Uses purple color coding to distinguish from the blue feature importance bars

### 9.6 Interpreting SHAP Values

- **Positive SHAP value** for a feature → that feature's value pushes the patient toward higher-numbered (higher-risk) clusters
- **Negative SHAP value** → that feature pulls the patient toward lower-risk clusters
- **High mean |SHAP|** → that feature strongly separates clusters globally

---

## 10. ANOMALY DETECTION

### 10.1 Overview

**File:** ml-engine/anomaly/isolation_forest.py

Isolation Forest detects statistically unusual patients — those whose clinical values deviate significantly from the majority of the dataset. These patients may represent:
- Rare disease presentations
- Data entry errors requiring verification
- Patients who don't fit any standard cluster (candidates for individual review)

### 10.2 Algorithm

Isolation Forest works by building random decision trees:
1. Randomly select a feature and a random split value
2. Recursively partition data until each point is isolated
3. Points requiring fewer splits to isolate → more anomalous (shorter average path length)
4. Anomaly score: nomaly_score = -2^(-average_path_length / c(n)) where c(n) is the average path length for a dataset of size n

### 10.3 Parameters

- contamination (default: 0.05) — Expected fraction of anomalies (5%)

### 10.4 Output

`json
{
  "anomaly_flags": [-1, 1, 1, -1, ...],   // -1 = anomaly, 1 = normal
  "anomaly_scores": [0.123, -0.456, ...],  // more negative = more anomalous
  "anomaly_count": 12,
  "feature_contributions": [...]
}
`

### 10.5 Frontend — Anomaly Watchlist

The Dashboard's **Anomalies tab** renders the AnomalyWatchlist component:
- Shows all flagged patients in a red-bordered list
- Displays anomaly score, risk tier, and top feature values
- Clicking any anomalous patient opens the Patient Detail Modal
- If no anomalies detected, shows a green checkmark success state

### 10.6 Automatic Triggering

After each clustering run, anomaly detection is automatically triggered in the background (non-blocking) and results are merged into the dashboard state when ready.

---

## 11. AUTOML & FEATURE SELECTION

### 11.1 Optimal K Selection

**File:** ml-engine/automl/feature_selector.py — ind_optimal_k()

This endpoint automatically recommends the best number of clusters for a given dataset using two complementary methods:

**Elbow Method:**
- Runs K-Means for K = 2 to 10 (capped at N-1)
- Computes inertia (within-cluster sum of squares) at each K
- Finds the K where the second derivative of inertia is maximized (the "elbow" of the curve)
- A high second derivative indicates diminishing returns from increasing K

**Silhouette Score Method:**
- At each K, computes silhouette score: measures how similar each patient is to its own cluster vs. other clusters
- Score range: -1 (wrong cluster) to +1 (perfect cluster)
- Selects K with highest silhouette score

**Recommendation Logic:**
- If best silhouette score > 0.3 → use silhouette K
- Otherwise → use elbow K
- Returns both K values, full sweep data, and a rationale string

**Rationale String Example:**
> "Elbow method suggests k=3. Silhouette method suggests k=4 (score=0.412). Recommended: k=4."

### 11.2 Feature Importance Ranking

**File:** ml-engine/automl/feature_selector.py — ank_features()

Features are ranked using two complementary methods:

**Mutual Information (MI):**
- Measures non-linear statistical dependence between feature values and cluster assignments
- Robust to non-linear relationships (e.g., glucose has non-linear effect at extreme values)
- Range: [0, ∞) where higher = more informative

**ANOVA F-Score:**
- Measures linear separation between cluster means relative to within-cluster variance
- Classic and interpretable: "How well does this feature separate the clusters?"
- Range: [0, ∞) where higher = better separation

**Composite Score:**
`
composite = 0.6 × MI_normalized + 0.4 × F_normalized
`

Mutual Information is weighted higher (0.6) because clinical data often has non-linear relationships (e.g., U-shaped risk curves for blood pressure).

### 11.3 Dimensionality Reduction Alternatives

Beyond PCA (used by default for scatter plots), MediCluster supports:

**UMAP (Uniform Manifold Approximation and Projection):**
- Preserves both local and global structure better than t-SNE
- Fast for large datasets
- Parameters: 
_neighbors (15), min_dist (0.1)
- Falls back to PCA if umap-learn not installed

**t-SNE (t-Distributed Stochastic Neighbor Embedding):**
- Excellent local structure preservation
- Perplexity auto-clamped to min(30, (N-1)/3) for small datasets
- Falls back to PCA for datasets with fewer than 10 patients

Both methods return [[x, y], ...] coordinates that the frontend uses in the scatter plot.

---

## 12. SUPERVISED LEARNING MODULE

### 12.1 Overview

**File:** ml-engine/automl/supervised.py

The supervised AutoML module trains baseline predictive models when labelled patient data is available. It supports both classification and regression tasks.

### 12.2 Task Auto-Detection

The _infer_task() function automatically determines whether the target variable requires classification or regression:
- **Classification**: Object/categorical dtype, boolean dtype, or ≤ max(8, 8% of rows) unique values
- **Regression**: Continuous numeric with many unique values (e.g., length of stay in days)

### 12.3 Preprocessing Pipeline

For each supervised task, a ColumnTransformer is built:

**Numeric Features:**
- Median imputation → StandardScaler

**Categorical Features:**
- Most-frequent imputation → One-Hot Encoding (unknown categories ignored)

### 12.4 Classification Models

Three models are trained and evaluated:

| Model | Configuration |
|---|---|
| Logistic Regression | max_iter=1000, class_weight="balanced" |
| Random Forest Classifier | 
_estimators=120, class_weight="balanced" |
| Gradient Boosting Classifier | Default with andom_state=42 |

**Evaluation Metrics:**
- Accuracy, Precision (weighted), Recall (weighted), F1 (weighted)
- ROC-AUC (binary classification only)

**Primary Metric for Leaderboard Ranking:** F1 (weighted) — chosen because clinical datasets are typically imbalanced

### 12.5 Regression Models

| Model | Configuration |
|---|---|
| Ridge Regression | lpha=1.0 |
| Random Forest Regressor | 
_estimators=120 |
| Gradient Boosting Regressor | Default with andom_state=42 |

**Evaluation Metrics:** MAE, RMSE, R²

**Primary Metric for Leaderboard Ranking:** R²

### 12.6 Leaderboard Output

The endpoint returns a ranked leaderboard of all models with their metrics, identifies the best model, and extracts feature importance from the winner's pipeline.

### 12.7 Sample Predictions

The best model's predictions on the first 5 test rows are included in the response, allowing quick sanity-checking: {"actual": "High", "predicted": "High"}.

### 12.8 Supported Clinical Targets

Common targets for training:
- isk_label — Predicted risk tier (classification)
- eadmitted — 30-day readmission (classification)
- icu_admission — ICU need prediction (classification)
- length_of_stay — Predicted LOS in days (regression)
- mortality_risk — In-hospital mortality (classification)

---

## 13. NLP CLINICAL NOTES ANALYZER

### 13.1 Overview

**File:** ml-engine/nlp/notes_analyzer.py

The NLP module processes free-text clinical notes — doctor's notes, discharge summaries, nursing reports, and prescriptions — extracting structured clinical information for risk assessment.

### 13.2 Processing Pipeline

When nalyze_clinical_notes(text) is called, the following pipeline runs in sequence:

`
Input text
  ↓
1. Medical spell correction
  ↓
2. Risk keyword extraction (4-tier lexicon)
  ↓
3. Clinical trajectory determination (improving/stable/deteriorating)
  ↓
4. Drug extraction (regex pattern matching)
  ↓
5. Prescription details (drug + dose + frequency)
  ↓
6. Lab value extraction (regex: "HbA1c was 8.2 mg/dL")
  ↓
7. Lab interpretation (high/low/normal with reference ranges)
  ↓
8. Symptom extraction (with negation, severity, duration)
  ↓
9. SpaCy NER (disease, drug, anatomy entities)
  ↓
10. ICD-10 code suggestion (rule-based mapping)
  ↓
11. Risk tier inference
  ↓
12. Emergency flag detection
  ↓
13. Department routing
  ↓
14. Follow-up question generation
  ↓
15. Incomplete description detection
  ↓
16. Clinical section parsing
  ↓
17. Abbreviation expansion
  ↓
18. Plain-language summary generation (Transformers or template)
  ↓
Output: 20+ field structured dict
`

### 13.3 Medical Named Entity Recognition

**SpaCy Integration:**
- Primary: en_core_sci_md (scispaCy biomedical model)
- Fallback: en_core_web_sm (general English model)
- Entity types captured: DISEASE, CHEMICAL, ANATOMY, PROBLEM, TREATMENT, TEST

**Regex Fallback:**
When SpaCy is unavailable, the system uses the DRUG_PATTERN regex covering 30+ common medications.

### 13.4 Symptom Extraction with Negation Detection

The symptom extraction is clinically sophisticated:

**Negation detection**: Looks at the 45-character window before a symptom mention for negation phrases: "no", "denies", "without", "not", "negative for", "free of".

**Severity extraction**: Detects modifiers within 50 characters: severe, moderate, mild, worsening, persistent, cute

**Duration extraction**: Detects time phrases: "for 3 days", "since last week", "2-day history"

**Positive wins**: If the same symptom appears both negated and positive, the positive mention wins.

**21 Canonical Symptoms Tracked:**
chest pain, breathlessness, fever, cough, wheeze, palpitations, syncope, weakness, slurred speech, facial droop, confusion, vomiting, diarrhea, abdominal pain, headache, swelling, reduced urine, fatigue, weight loss, blurred vision, polyuria, polydipsia

### 13.5 ICD-10 Code Suggestion

Rule-based mapping covers 19 common conditions:

| Keyword | ICD-10 Code | Description |
|---|---|---|
| pneumonia | J18.9 | Pneumonia, unspecified |
| sepsis | A41.9 | Sepsis, unspecified |
| heart failure | I50.9 | Heart failure, unspecified |
| myocardial infarction | I21.9 | Acute MI, unspecified |
| diabetes | E11.9 | Type 2 DM without complications |
| hypertension | I10 | Essential hypertension |
| copd | J44.9 | COPD, unspecified |
| stroke | I63.9 | Cerebral infarction |
| pulmonary embolism | I26.99 | PE without cor pulmonale |
| acute kidney injury | N17.9 | Acute kidney failure |

### 13.6 Risk Keyword Lexicon

A 4-tier lexicon classifies text by risk level:

**Critical:** cardiac arrest, respiratory failure, septic shock, multi-organ failure, acute MI, stroke, intubated, ICU, code blue, vasopressors

**High:** pneumonia, pulmonary embolism, heart failure, acute kidney injury, hyperglycemia, hypertensive crisis, deteriorating, worsening

**Moderate:** diabetes, hypertension, COPD, atrial fibrillation, chronic, elevated, abnormal, follow-up required

**Low:** stable, improving, discharged, routine, normal, within limits, no acute, well-controlled

### 13.7 Clinical Trajectory

The trajectory is determined by comparing hit counts:
- Deterioration phrases: deteriorating, worsening, decompensating, cute exacerbation, hemodynamically unstable
- Improvement phrases: improving, stable, febrile, 	olerating, mbulatory, discharged

If deterioration hits > improvement hits → "deteriorating"
If improvement hits > deterioration hits → "improving"
Otherwise → "stable"

### 13.8 Medical Spell Correction

Common clinical misspellings are automatically corrected:
- diabtes → diabetes
- hypertention → hypertension
- pnuemonia → pneumonia
- eaver → ever
- ommiting → omiting

### 13.9 AI Summary Generation

If 	ransformers is installed, the sshleifer/distilbart-cnn-12-6 model generates an abstractive summary of the note (truncated to 1000 characters, max 120 tokens output). If unavailable, a template-based summary is generated from extracted structured data.

### 13.10 NLP Backend Detection

The response includes "nlp_backend": "scispacy" or "nlp_backend": "regex-fallback" to inform the frontend about the level of NLP sophistication available.

---

## 14. VITAL SIGNS FORECASTING

### 14.1 Overview

**File:** ml-engine/forecasting/vitals_forecaster.py

The forecasting module predicts future vital sign values from historical sequences using machine learning time-series models and calculates the Modified Early Warning Score (MEWS) for immediate deterioration risk.

### 14.2 MEWS Calculator

The Modified Early Warning Score is a validated clinical scoring system for early deterioration detection:

**MEWS Components and Scoring:**

| Vital | Ranges & Scores |
|---|---|
| Systolic BP | <70→3, <80→2, <100→1, <200→0, ≥200→2 |
| Heart Rate | <40→2, <50→1, <100→0, <110→1, <130→2, ≥130→3 |
| Respiratory Rate | <9→2, <14→1, <20→0, <29→1, ≥29→2 |
| Temperature | <35→2, <36→1, <38→0, <38.5→1, ≥38.5→2 |
| Consciousness (AVPU) | A=0, V=1, P=2, U=3 |
| Urine Output (ml/kg/hr) | <0.5→3, <1.0→2, ≥1.0→0 |

**Alert Levels:**
- MEWS 0–1: Low — Routine monitoring every 12 hours
- MEWS 2–3: Moderate — Increased monitoring every 4 hours, notify charge nurse
- MEWS 4–5: High — Urgent medical review within 30 minutes
- MEWS ≥ 6: Critical — IMMEDIATE medical emergency response

### 14.3 LSTM Forecasting

**Architecture:** Single-layer LSTM with 2 stacked layers

`
Input: Sequence of length min(10, N//2) → LSTM(hidden=32, layers=2) → FC(1) → Output
`

**Training Process (per vital, per request):**
1. Normalize series: (x - mean) / std
2. Build sliding window dataset with seq_len lookback
3. Train with Adam optimizer (lr=0.01) for 60 epochs
4. Forecast iteratively: each prediction becomes input for the next step
5. De-normalize forecast back to original scale

**Confidence Band:** ±0.5 standard deviations of the training series

**Requirements:** PyTorch 2.2.1, minimum 4 data points in series

### 14.4 Prophet Forecasting

For longer series (≥ 10 readings), Facebook Prophet is used:
- Models trend + seasonality decomposition
- Returns yhat, yhat_lower, yhat_upper confidence intervals
- Configured without daily/weekly/yearly seasonality (appropriate for short vital histories)
- Date range: Hourly frequency starting from 2024-01-01

### 14.5 Auto Method Selection

When method="auto":
- ≥ 10 readings + Prophet available → Prophet
- PyTorch available → LSTM
- Otherwise → Linear extrapolation fallback

### 14.6 Linear Extrapolation Fallback

When deep learning models are unavailable, simple linear regression via 
umpy.polyfit is used:
- Fits degree-1 polynomial to the series
- Extrapolates for steps future points
- Confidence band: ±0.5 × standard deviation

### 14.7 Deterioration Risk Assessment

After forecasting, trend-based deterioration signals are counted:
- Heart rate or respiratory rate forecast > 10% above last value → +1 signal
- Systolic BP forecast > 10% below last value → +1 signal

Combined with MEWS:
- MEWS ≥ 6 OR ≥ 3 trend signals → "critical"
- MEWS ≥ 4 OR ≥ 2 trend signals → "high"
- MEWS ≥ 2 OR ≥ 1 signal → "moderate"
- Otherwise → "low"

---

## 15. MEDICAL IMAGING AI

### 15.1 Overview

**File:** ml-engine/imaging/analyzer.py

The imaging module uses deep convolutional neural networks (CNNs) pre-trained on large chest X-ray datasets to detect pathological findings in radiological images.

### 15.2 Available Models

Five TorchXRayVision pre-trained models are available:

| Model ID | Architecture | Training Data | Input Size |
|---|---|---|---|
| densenet121-res224-chex | DenseNet-121 | Stanford CheXpert (224k) | 224×224 |
| densenet121-res224-all | DenseNet-121 | CheXpert + NIH + MIMIC + PadChest | 224×224 |
| resnet50-res512-all | ResNet-50 | All datasets | 512×512 |
| densenet121-res224-nih | DenseNet-121 | NIH ChestX-ray14 | 224×224 |
| densenet121-res224-pc | DenseNet-121 | PadChest | 224×224 |

**Recommended default:** densenet121-res224-chex (CheXNet) — best calibrated for 14-class detection

### 15.3 DenseNet-121 Architecture

DenseNet-121 uses dense connections: each layer receives feature maps from all preceding layers. For medical imaging:
- 121 layers deep
- Dense blocks with skip connections combat vanishing gradients
- Global average pooling → sigmoid output per pathology class
- Pre-trained weights downloaded automatically from TorchXRayVision's model hub

### 15.4 Image Preprocessing Pipeline

1. **DICOM detection** (.dcm/.dicom extension check)
2. **For DICOM**: Read pixel array, apply RescaleSlope + RescaleIntercept (Hounsfield units)
3. **For standard images**: PIL grayscale conversion
4. **CLAHE enhancement** (for non-DICOM only): Contrast Limited Adaptive Histogram Equalization to bridge the gap between stock photos and clinical DICOM images
5. **TorchXRayVision normalization**: Maps values to [-1024, 1024] range (matching training preprocessing)
6. **Center crop + resize**: Using TorchXRayVision's own XRayCenterCrop and XRayResizer
7. **Tensor conversion**: shape (1, 1, H, W) for inference

### 15.5 Pathology Detection

Model output goes through sigmoid activation (not softmax, since conditions can co-occur). Findings with confidence ≥ 15% are retained and sorted by confidence descending.

### 15.6 Clinical Information Enrichment

Each detected finding is enriched with clinical context from clinical_knowledge.py:
- **Cause**: Common underlying etiologies
- **Medications**: Relevant treatment medications
- **Prevention**: Preventive measures
- **Severity**: Low / Moderate / High / Critical

### 15.7 Medical Scan Validation

Before running inference, the system validates the image:
- Minimum size: 128×128 pixels
- Color channel check: Real medical scans are near-grayscale (R-G difference < 15, G-B difference < 15)
- If validation fails, a scan_warning is included in the response but inference still proceeds

### 15.8 Model Caching

Models are cached in a module-level _cache dict after first load, avoiding repeated download overhead. Each model is set to .eval() mode and kept in memory for the session lifetime.

### 15.9 Grad-CAM Visualization

**File:** ml-engine/imaging/gradcam.py

Grad-CAM (Gradient-weighted Class Activation Mapping) generates a heatmap showing which regions of the X-ray the model focused on for each pathology prediction:

1. Register forward hooks on the last convolutional layer
2. Run forward pass
3. Compute gradients of the target class score w.r.t. the last conv feature maps
4. Weight feature maps by global-average-pooled gradients
5. Apply ReLU and normalize to [0, 1]
6. Upsample to original image size
7. Return as base64-encoded PNG for frontend overlay

---

## 16. RAG CHATBOT — CLINICAL Q&A

### 16.1 Overview

**File:** ml-engine/chatbot/rag_assistant.py

The RAG (Retrieval-Augmented Generation) chatbot allows clinicians to query patient data in natural language after clustering. The system uses a vector store to retrieve relevant patient records and generates structured answers.

### 16.2 Architecture

`
User Query ("Which High Risk patients are over 60?")
         ↓
1. TF-IDF vector search (top-50 matching patients)
         ↓
2. Structured filter extraction (risk_tier, age range, cluster_id)
         ↓
3. Filter application to retrieved patients
         ↓
4. Answer generation (statistics + patient list)
         ↓
Response: {answer, matched_patients, filters_applied}
`

### 16.3 Patient Vector Store

The PatientVectorStore class maintains an in-memory patient index using TF-IDF vectorization:

**Text Representation of Each Patient:**
Each patient dict is converted to a bag-of-words string:
`
"age 67.3 heart_rate 94.2 risk_tier High cluster_id 2 spo2 91.0 ..."
`

**TF-IDF Vectorizer:** max_features=500, English stop words removed

**Cosine Similarity Search:** Query is vectorized and cosine similarity is computed against all patient text representations. Top-K patients by similarity are returned.

**FAISS Optional:** If aiss-cpu is installed, approximate nearest neighbor search can replace exact cosine similarity for very large patient cohorts.

### 16.4 Query Filter Extraction

The _parse_filters() function uses regex to extract structured constraints:

- **Risk tier**: "critical", "high", "moderate", "low" found in query text
- **Age range**: "over 60", "above 65", "under 30", "younger than 40"
- **Cluster ID**: "cluster 2", "cluster 3"

### 16.5 Answer Generation

The answer is constructed programmatically:
1. Count matched patients per risk tier
2. Compute mean feature values across top 4 numeric features
3. Compose a natural-language summary

**Example output:**
> "Found 12 patient(s) matching 'high risk over 60': 8 High, 4 Critical. Mean values: age avg=71.2, heart_rate avg=101.3, spo2 avg=92.1, glucose avg=187.4."

### 16.6 Index Update

Every time POST /cluster runs successfully, update_patient_index() is called to rebuild the patient vector store with the latest clustering results. This keeps the chatbot synchronized with the most recent data.

---

## 17. DRUG INTERACTION CHECKER

### 17.1 Overview

**File:** ml-engine/chatbot/rag_assistant.py — check_drug_interactions()

A rule-based drug interaction knowledge base checks medication lists for dangerous combinations.

### 17.2 Knowledge Base

12 high-priority drug pairs are encoded as frozensets (order-independent):

| Drug Pair | Severity | Clinical Effect |
|---|---|---|
| Warfarin + Aspirin | Major | Increased bleeding risk, monitor INR |
| Warfarin + Ibuprofen | Major | NSAIDs potentiate anticoagulation — hemorrhage risk |
| Metformin + Alcohol | Major | Risk of lactic acidosis |
| Metoprolol + Verapamil | Major | Bradycardia and heart block risk |
| Ciprofloxacin + Warfarin | Major | Fluoroquinolones inhibit warfarin metabolism — INR spike |
| SSRI + Tramadol | Major | Serotonin syndrome risk |
| Lithium + Ibuprofen | Major | NSAID reduces lithium clearance — toxicity |
| Ceftriaxone + Calcium (IV) | Major | Precipitate formation — do not co-administer IV |
| Lisinopril + Potassium | Moderate | Hyperkalemia risk |
| Furosemide + Digoxin | Moderate | Hypokalemia increases digoxin toxicity |
| Atorvastatin + Azithromycin | Moderate | CYP3A4 inhibition → myopathy risk |
| Heparin + Aspirin | Moderate | Combined anticoagulation → bleeding |

### 17.3 Matching Algorithm

Drug names are matched with substring containment (bidirectional):
`python
any(d in med or med in d for med in meds_lower)
`
This handles brand names, abbreviations, and partial matches.

### 17.4 Response Format

`json
{
  "interactions": [{"drugs": ["warfarin", "aspirin"], "severity": "major", "effect": "..."}],
  "has_major_interaction": true,
  "summary": "⚠️ 2 interaction(s) detected — 1 major.",
  "medications_checked": ["warfarin", "aspirin", "metformin"]
}
`

### 17.5 Automatic Integration

In the Clinical AI page, when 2+ medications are extracted from clinical notes via NLP, the drug interaction checker is automatically triggered. Results appear in the medication section with severity badges.

---

## 18. BACKEND API GATEWAY

### 18.1 Overview

**File:** medicluster/backend/server.js

The Node.js/Express backend serves as an API gateway between the React frontend and the Python ML engine. It also manages MongoDB persistence for all non-ML data.

### 18.2 Server Configuration

- **Port**: 5000 (configurable via PORT environment variable)
- **CORS**: Allows requests from http://localhost:3000 and http://localhost:5173
- **Body size limit**: 50MB (supports large CSV uploads and base64 images)

### 18.3 Route Modules

| Route | File | Responsibility |
|---|---|---|
| /api/data | dataRoutes.js | CSV upload, dataset CRUD, data preview |
| /api/cluster | clusterRoutes.js | Clustering trigger, result storage, history |
| /api/ai | aiRoutes.js | AI insights, medication plans, chatbot proxy |
| /api/ml | mlRoutes.js | ML engine health + feature routes |
| /api/media | mediaRoutes.js | Medical image upload + X-ray analysis |
| /api/triage | triageRoutes.js | Emergency triage assessments |
| /api/dispatch | dispatchRoutes.js | Ambulance dispatch management |
| /api/reminders | reminderRoutes.js | Clinical reminder CRUD |

### 18.4 ML Engine Proxy Pattern

All ML routes proxy requests to the Python engine:
`javascript
const response = await axios.post(
  ${process.env.ML_ENGINE_URL}/cluster,
  { data: patients, algorithm, params },
  { timeout: 120000 }
);
`

Results are stored in MongoDB before being returned to the frontend, enabling historical comparison.

### 18.5 Error Handling

A centralized error handler catches:
- Multer file upload errors (file too large, wrong type)
- MongoDB connection errors (server starts even without DB for resilience)
- ML engine timeouts and upstream errors

### 18.6 Environment Configuration

`env
MONGO_URI=mongodb://localhost:27017/medicluster
ML_ENGINE_URL=http://localhost:5001
PORT=5000
`

---

## 19. FRONTEND — OVERVIEW

### 19.1 Technology

The frontend is a React 18 Single-Page Application built with Vite:
- **Routing**: React Router v6 (13 page routes)
- **Styling**: TailwindCSS + custom CSS utilities
- **Charts**: Recharts (bar, line, donut, radar)
- **Maps**: Leaflet.js + React-Leaflet
- **Dendrograms**: D3.js
- **PDF Export**: jsPDF + html2canvas

### 19.2 Application Structure

`
src/
├── App.jsx              ← Route definitions
├── main.jsx             ← React DOM render
├── index.css            ← Global styles + TailwindCSS
├── api/
│   └── apiClient.js     ← Axios API functions (30+ endpoints)
├── components/          ← Reusable UI components (12)
├── pages/               ← Page components (13)
├── utils/
│   └── exportPdf.js     ← PDF export utility
└── data/                ← Sample/mock data
`

### 19.3 Navigation

The Navbar component provides top navigation with links to all 13 pages:
- 🏠 Home
- 📊 Dashboard
- 🧠 Clinical AI
- 🔬 ML Tools
- 🩻 Imaging
- 👥 Patients
- 🔮 Predict
- 🚑 Dispatch
- 🏥 Hospitals
- ⏰ Reminders
- 🚨 MCI Board
- 💬 Ask AI

---

## 20. DASHBOARD PAGE

### 20.1 Overview

**File:** rontend/src/pages/DashboardPage.jsx

The Dashboard is the primary analytical workspace. It provides an end-to-end workflow: upload data → configure algorithm → run clustering → visualize results.

### 20.2 Layout

Three-column layout:
- **Left sidebar** (15rem): Dataset upload + algorithm configuration
- **Main area** (flex-1): Tabbed visualization + patient table
- **Right sidebar** (14rem): Risk distribution donut + metrics + SHAP panel

### 20.3 Upload Panel (UploadPanel Component)

Supports three data input modes:
1. **CSV file upload**: Drag-and-drop or click to select. Parsed client-side.
2. **Sample dataset**: Built-in cardiovascular sample data for demo purposes
3. **Paste JSON**: Direct paste of patient JSON array

After upload, a preprocessing preview shows feature statistics.

### 20.4 Algorithm Selector (AlgorithmSelector Component)

Allows configuration of:
- Algorithm selection (K-Means, DBSCAN, Hierarchical, GMM, All)
- Per-algorithm parameters (K, eps, min_samples, linkage, covariance type)
- Risk feature weight overrides
- Optional SHAP computation toggle

### 20.5 Visualization Tabs

**Tab 1 — Scatter Plot** (ClusterScatterPlot):
PCA-reduced 2D plot using Recharts ScatterChart. Each patient is a dot colored by risk tier (green/yellow/orange/red). Clicking a patient opens the Patient Detail Modal showing all feature values vs. cluster centroid.

**Tab 2 — Comparison Panel** (ComparisonPanel):
When "All Algorithms" is run, shows side-by-side radar charts of 5 evaluation metrics across all 4 algorithms. Risk distributions are compared using horizontal bar charts.

**Tab 3 — Dendrogram** (DendrogramView):
D3.js dendrogram rendered from the hierarchical clustering linkage matrix. Leaves represent individual patients. Branch heights indicate merge distances.

**Tab 4 — Anomaly Watchlist** (AnomalyWatchlist):
Lists all Isolation Forest-flagged patients. Shows anomaly score, risk tier, and feature values. Patients are click-able to open the detail modal.

### 20.6 Right Sidebar Components

**Risk Donut Chart** (RiskDonutChart):
Recharts PieChart showing distribution across Low/Moderate/High/Critical tiers. Color-coded (green/amber/orange/red).

**Metrics Panel** (MetricsPanel):
Displays clustering quality scores:
- **Silhouette Score**: -1 to 1 (higher = better-separated clusters)
- **Davies-Bouldin Index**: Lower = better (measures intra-cluster vs inter-cluster distance)
- **Calinski-Harabasz Index**: Higher = better (variance ratio criterion)

**Feature Importance**: Bar chart of centroid standard deviations per feature (proxy for discriminative power)

**SHAP Panel**: On-demand SHAP loading with violet bar chart of mean |SHAP| values

### 20.7 PDF Export

The "Export PDF" button calls exportToPdf("dashboard-results", ...) which:
1. Uses html2canvas to screenshot the #dashboard-results div
2. Embeds the screenshot in a jsPDF document
3. Triggers browser download

### 20.8 AI Cluster Insights (AIClusterInsights Component)

After clustering, the AIClusterInsights component renders AI-generated narrative insights:
- Cluster-level summaries (size, dominant risk tier, key features)
- Cohort-level alerts and recommendations
- Highlighted at-risk subgroups

---

## 21. CLINICAL AI PAGE

### 21.1 Overview

**File:** rontend/src/pages/ClinicalAIPage.jsx

The Clinical AI page is the most feature-rich page in MediCluster. It combines real-time NLP analysis, risk profiling, vital sign assessment, and care plan generation in a unified clinical workspace.

### 21.2 Input Zone

**Clinical Notes Textarea:**
A large textarea accepts free-text clinical notes. As the user types (debounced 800ms, minimum 30 characters), the NLP pipeline is triggered automatically. A character counter and clear button are provided.

**Image Upload Zone:**
Drag-and-drop or click to upload a prescription image or scanned report. The image is processed by the AI vision system to extract text, which is automatically appended to the notes textarea.

### 21.3 Real-Time Critical Alert Scanning

As the user types, a client-side keyword scanner instantly checks for 12 critical clinical phrases:

| Keyword | Alert Note |
|---|---|
| chest pain | Requires immediate cardiac assessment |
| breathlessness | Assess airway and O₂ saturation immediately |
| unconsciousness | Check GCS — activate emergency protocol |
| seizure | Protect airway, note duration, check glucose |
| stroke | FAST assessment — time-sensitive intervention |
| cardiac arrest | Initiate CPR — call emergency services |
| respiratory failure | Secure airway — prepare ventilatory support |
| anaphylaxis | Administer epinephrine — monitor airway |
| hypotension | Check for shock — IV access and fluid resuscitation |

Critical alerts appear instantly (< 1ms) — before the NLP pipeline completes.

### 21.4 Clinical Summary Section

After NLP completes, the following are displayed:

**Extracted Entities Table:** SpaCy-extracted medical entities with type (DISEASE, DRUG, ANATOMY) and confidence score.

**ICD-10 Codes:** Detected ICD-10 codes shown as monospace purple badges with description tooltip.

**Clinical Trajectory Badge:** Color-coded trajectory pill (green=Improving, red=Deteriorating, teal=Stable).

**Symptoms Grid:** Pills for each extracted symptom showing name, severity, and duration. Negated symptoms shown in grey.

**Labs Grid:** Extracted lab values with high/low/normal interpretation badges.

**Prescription Grid:** Extracted medications with detected dose and frequency.

**Routing Recommendations:** Department routing pills sorted by priority score.

**Follow-up Questions:** Auto-generated clarifying questions based on symptom gaps.

**Care Recommendations:** Priority-ordered clinical actions.

### 21.5 Vital Signs Input

10 vital sign fields:
- Age, Blood Pressure (Systolic), Heart Rate, Respiratory Rate, Temperature, SpO2, Cholesterol, BMI, Glucose, Creatinine

When vitals are entered and notes are analyzed, the advanced risk profiler and MEWS calculator run automatically in parallel.

### 21.6 Advanced Risk Intelligence Panel

Displays the full output of compute_patient_risk_profile():

- **Overall Risk Score** (0–100) with large numeric display
- **Risk Tier Badge** (color-coded)
- **Triage Priority** (P1–P4)
- **Confidence Score**
- **Top Risk Drivers**: Bar chart of contributing components with severity colors
- **Disease-Specific Risks**: Radar chart of 6 disease scores (diabetes, cardiac, kidney, respiratory, stroke, sepsis)
- **Probability Estimates**: ICU admission %, readmission %, mortality %
- **Estimated Length of Stay**
- **Recommended Departments**
- **Next Tests to Order**
- **Care Plan**

### 21.7 MEWS Display

When vital fields are populated, MEWS score and component breakdown are displayed:
- Total MEWS score with alert level badge
- Per-vital component scores
- Recommendation text

### 21.8 Drug Interaction Alerts

After NLP extracts 2+ medications, the drug interaction checker runs automatically. If major interactions are detected, a prominent red warning banner appears with full interaction details.

### 21.9 Risk Prediction Panel

When a trained cluster model is selected, the "Predict Risk" button sends vitals to the backend which:
1. Assigns the patient to the nearest cluster
2. Returns predicted risk tier
3. Generates AI cluster insights for that cluster
4. Triggers medication plan generation

### 21.10 Patient History Timeline

Loads historical cluster assignments for the entered Patient ID, showing risk tier evolution over time.

---

## 22. IMAGING PAGE

### 22.1 Overview

**File:** rontend/src/pages/ImagingPage.jsx

The Imaging page provides AI-powered chest X-ray analysis with pathology detection, clinical context, and Grad-CAM visualization.

### 22.2 Image Upload

Supports JPEG, PNG, WebP, GIF, and DICOM (.dcm) files. Images can be:
- Uploaded via drag-and-drop or file picker
- Up to 50MB in size

### 22.3 Model Selection

Dropdown to select from 5 available X-ray models:
- CheXNet (recommended default)
- DenseNet121 All Datasets
- ResNet50 High-Resolution
- DenseNet121 NIH
- DenseNet121 PadChest

### 22.4 Results Display

After analysis:
- **Primary Findings**: Cards for each detected pathology above the confidence threshold (15%)
- **Confidence Meter**: Visual progress bar showing detection confidence
- **Clinical Context**: For each finding — cause, medications, prevention, severity classification
- **Scan Warning**: Banner shown if image may not be a real medical scan

### 22.5 Grad-CAM Heatmap

After primary analysis, the "Generate Heatmap" button triggers Grad-CAM:
- Heatmap is overlaid on the original image
- Red regions = areas most strongly activating the pathology prediction
- Downloadable as PNG

---

## 23. ML TOOLS PAGE

### 23.1 Overview

**File:** rontend/src/pages/MLToolsPage.jsx

The ML Tools page provides access to advanced ML capabilities beyond basic clustering.

### 23.2 Features

**Optimal K Finder:**
- Input: Dataset + K range (2-10)
- Output: Elbow curve + silhouette curve charts, recommended K with rationale
- Displays full sweep table with inertia and silhouette at each K

**Dimensionality Reduction:**
- Method selection: UMAP, t-SNE, or PCA
- Renders an alternative scatter plot using the selected embedding
- Parameter controls for UMAP (n_neighbors, min_dist) and t-SNE (perplexity)

**Supervised AutoML:**
- Target column selection from uploaded data
- Task type: Auto-detect, Classification, or Regression
- Returns model leaderboard with performance metrics
- Feature importance chart for the best model
- Sample predictions table

**Feature Importance:**
- Runs MI + ANOVA analysis after clustering
- Displays ranked feature table with composite scores
- Highlights top-5 features driving cluster separation

---

## 24. PATIENT MANAGEMENT PAGE

### 24.1 Overview

**File:** rontend/src/pages/PatientPage.jsx

The Patient Management page provides individual patient record lookup, management, and media attachment.

### 24.2 Features

- Search patients by ID or name
- View complete patient record with all vitals and history
- Upload patient media (X-rays, reports, photos)
- View patient cluster history across multiple runs
- Access patient-specific care recommendations
- Similar Patient Search: find clinically similar patients from the cohort

### 24.3 Patient Media Modal (PatientMediaModal Component)

Supports upload and viewing of:
- X-ray images
- PDF reports
- Clinical photos
- Stored in MongoDB via GridFS

---

## 25. DISPATCH & TRIAGE SYSTEM

### 25.1 Overview

**File:** rontend/src/pages/DispatchPage.jsx

The Dispatch page is a real-time emergency management interface combining triage assessment, ambulance dispatch, and hospital routing.

### 25.2 Features

**Triage Assessment:**
- Enter patient vitals → instant triage classification
- ESI (Emergency Severity Index) assignment
- Recommended treatment area
- Wait time estimate

**Ambulance Dispatch:**
- Real-time map (Leaflet) showing ambulances and patients
- OSRM-based road network routing (replaces straight-line distances)
- Ambulance assignment to dispatch events
- ETA calculation and display

**MCI (Mass Casualty Incident) Board:**
The MCI Board page provides a color-coded grid of all active patients categorized by START triage:
- Black: Deceased/Expectant
- Red: Immediate
- Yellow: Delayed
- Green: Minor

### 25.3 Real-Time Communication

Ambulance-dispatcher communication uses the BroadcastChannel API for same-browser tab communication during development, with WebSocket upgrade path for production deployment.

---

## 26. NEARBY HOSPITALS MAP

### 26.1 Overview

**File:** rontend/src/pages/NearbyHospitalsPage.jsx

An interactive Leaflet map showing:
- User's current location (geolocation API)
- Nearby hospitals within configurable radius
- Hospital details (name, type, distance, capacity)
- Route planning to selected hospital using OSRM

### 26.2 Hospital Data

Uses OpenStreetMap Overpass API to query hospitals tagged with menity=hospital within the search radius.

---

## 27. REMINDERS SYSTEM

### 27.1 Overview

**File:** rontend/src/pages/RemindersPage.jsx

A clinical task reminder system for follow-ups, medication reviews, and patient check-ins.

### 27.2 Features

- Create/Edit/Delete clinical reminders
- Set priority (Routine, Urgent, Critical)
- Patient-linked reminders
- Due date and time scheduling
- Recurring reminders (daily, weekly)
- Notification badges in navbar for overdue items
- Export reminders as PDF or CSV

---

## 28. ASK AI PAGE

### 28.1 Overview

**File:** rontend/src/pages/AskAIPage.jsx

A natural-language chat interface connected to the RAG chatbot backend.

### 28.2 Features

- Chat-style interface with message history
- Supports complex patient queries:
  - "Show me all Critical patients over 70"
  - "Which patients in Cluster 2 have high glucose?"
  - "How many high-risk patients have troponin elevated?"
- Shows matched patient count and sample records
- Displays applied filters (risk tier, age range, cluster)
- Copyable query results

---

## 29. AMBULANCE DISPATCH SYSTEM

### 29.1 Overview

**Directory:** mbulance-dispatch/

A fully separate sub-application providing real-time ambulance coordination. It operates independently and can be deployed separately from the main MediCluster platform.

### 29.2 Architecture

`
ambulance-dispatch/
├── frontend/           ← Dispatcher dashboard + Driver interface
├── backend/            ← Node.js + Socket.io WebSocket server
├── mobile/             ← React Native driver mobile app (optional)
├── infrastructure/     ← Kubernetes + Terraform configs
├── tests/              ← Integration + load tests
└── docs/               ← API documentation
`

### 29.3 Dispatcher Interface

- Real-time map showing all ambulance units
- Incoming emergency call queue
- One-click ambulance assignment
- Route visualization using OSRM road network routing
- ETA and distance display
- Call log with timestamps

### 29.4 Driver Interface

- Assigned dispatch notifications
- Turn-by-turn navigation (road-network aware)
- Patient location pin on map
- Status updates (en route, on scene, transporting, available)
- Two-way communication with dispatcher

### 29.5 WebSocket Events

| Event | Direction | Purpose |
|---|---|---|
| dispatch:new | Server→Driver | New dispatch assignment |
| driver:status | Driver→Server | Status update |
| location:update | Driver→Server | GPS coordinate update |
| driver:location | Server→Dispatcher | Live driver position |
| dispatch:complete | Driver→Server | Job completion |

### 29.6 OSRM Integration

Road-network routing replaced straight-line (Haversine) distance calculation. Queries the OSRM public demo server or self-hosted instance for:
- Actual driving routes
- Real road distance
- Realistic ETA based on road network

---

## 30. DATA FLOW & WORKFLOW DIAGRAMS

### 30.1 Patient Clustering Workflow

`
User Uploads CSV/JSON
      ↓
Backend: POST /api/cluster
      ↓
ML Engine: POST /cluster
      ↓
  preprocess() ──→ IQR removal, scaling, PCA
      ↓
  _run_algorithm() ──→ KMeans/DBSCAN/Hierarchical/GMM
      ↓
  compute_metrics() ──→ Silhouette, Davies-Bouldin, CH
      ↓
  label_risk_tiers() ──→ Low/Moderate/High/Critical
      ↓
  detect_anomalies() ──→ Isolation Forest flags
      ↓
  update_patient_index() ──→ RAG chatbot updated
      ↓
MongoDB: Save cluster result
      ↓
Frontend: Render scatter plot + risk distribution
`

### 30.2 Clinical Notes Analysis Workflow

`
Clinician Types/Pastes Notes
      ↓
Client-side: Instant keyword scan → alerts
      ↓
800ms debounce → POST /api/ai/analyze-notes
      ↓
Backend → ML Engine: POST /analyze-notes
      ↓
  Spell correction
  → Trajectory detection
  → Drug extraction
  → Lab extraction + interpretation
  → Symptom extraction (with negation)
  → SpaCy NER (or regex fallback)
  → ICD-10 suggestion
  → Risk tier inference
  → Emergency flag detection
  → Department routing
  → Care recommendations
  → Summary generation
      ↓
Frontend: Render clinical summary panel
      ↓
Auto-trigger: Drug interaction check (if 2+ meds)
Auto-trigger: Advanced risk profiling (if notes + vitals)
Auto-trigger: MEWS calculation (if vitals provided)
`

### 30.3 X-Ray Analysis Workflow

`
Upload X-Ray Image (JPEG/PNG/DICOM)
      ↓
Backend: POST /api/media/analyze-image
      ↓
ML Engine: POST /analyze-image
      ↓
  _load_pixels() ──→ PIL/pydicom decode
  _apply_clahe() ──→ Contrast enhancement
  xrv normalize ──→ [-1024, 1024] range
  xrv transforms ──→ Center crop + resize
      ↓
  DenseNet/ResNet forward pass
  sigmoid() ──→ Per-pathology probabilities
      ↓
  Filter: confidence ≥ 15%
  _attach_clinical_info() ──→ Cause/Meds/Prevention
      ↓
Frontend: Display findings + confidence bars
      ↓
Optional: POST /gradcam → Heatmap overlay
`

---

## 31. COMPLETE API REFERENCE

### 31.1 ML Engine API (Port 5001)

#### Core Clustering

**POST /cluster**
`json
Request:
{
  "data": [{"age": 65, "systolic_bp": 145, "heart_rate": 88, ...}],
  "algorithm": "kmeans",
  "params": {"k": 4},
  "include_shap": false,
  "include_anomalies": false
}

Response:
{
  "patients": [{"patient_id": "...", "cluster_id": 2, "risk_tier": "High", "pca_x": 1.23, "pca_y": -0.45}],
  "metrics": {"silhouette": 0.412, "davies_bouldin": 0.892, "calinski_harabasz": 234.1},
  "risk_distribution": {"Low": 45, "Moderate": 30, "High": 20, "Critical": 5},
  "cluster_profiles": [{"cluster_id": 0, "risk_tier": "Low", "size": 45, "centroid_features": {...}}],
  "algorithm": "kmeans",
  "feature_names": ["age", "systolic_bp", "heart_rate"],
  "preprocessing": {"rows_before": 100, "rows_after": 98, "dropped_rows": 2},
  "warnings": ["Preprocessing removed 2 row(s) as outliers."]
}
`

**POST /preprocess-preview**
`json
Request: {"data": [...]}
Response: {"row_count": 98, "feature_names": [...], "feature_stats": {"age": {"mean": 52.3, "std": 14.2, "min": 18, "max": 89}}}
`

**POST /optimal-k**
`json
Request: {"data": [...], "k_min": 2, "k_max": 10}
Response: {"recommended_k": 4, "sweep": [{"k": 2, "inertia": 892.1, "silhouette": 0.234}, ...], "elbow_k": 3, "silhouette_k": 4, "rationale": "..."}
`

**POST /explain**
`json
Request: {"data": [...], "algorithm": "kmeans", "params": {"k": 4}}
Response: {"global_importance": [{"feature": "systolic_bp", "mean_abs_shap": 0.423}], "per_patient": [...], "shap_available": true}
`

**POST /detect-anomalies**
`json
Request: {"data": [...], "contamination": 0.05}
Response: {"anomaly_flags": [1, -1, 1, ...], "anomaly_scores": [0.12, -0.34, ...], "anomaly_count": 5}
`

#### Risk Intelligence

**POST /risk-profile**
`json
Request: {"patient": {"age": 72, "systolic_bp": 88, "heart_rate": 124, "spo2": 89, "notes": "patient complains of chest pain and breathlessness"}}
Response: {
  "risk_tier": "Critical",
  "overall_risk_score": 82.4,
  "triage_priority": "P1 - immediate",
  "confidence": 0.85,
  "top_risk_drivers": [{"name": "spo2", "score": 18, "severity": "critical", "message": "SpO2 below 90..."}],
  "disease_specific_risks": {"cardiac": {"score": 78.5, "tier": "Critical", "drivers": ["chest pain", "high heart rate"]}},
  "probabilities": {"icu_admission": 0.74, "readmission": 0.62, "mortality": 0.31},
  "estimated_length_of_stay_days": 8.2,
  "recommended_departments": [{"department": "Emergency", "priority": 7}],
  "recommended_next_tests": ["ECG", "Troponin repeat", "Chest X-ray"],
  "care_plan": ["Immediate clinician review...", "Evaluate cardiac symptoms urgently..."],
  "alerts": [...]
}
`

**POST /compare-visits**
`json
Request: {"previous": {...}, "current": {...}}
Response: {"previous": {...risk_profile}, "current": {...risk_profile}, "risk_delta": 18.5, "trend": "worsening"}
`

**POST /similar-patients**
`json
Request: {"patient": {...}, "candidates": [...], "top_k": 5}
Response: {"matches": [{"patient_id": "P-042", "similarity": 0.91, "risk_tier": "High", "shared_fields": 7}]}
`

#### NLP Endpoints

**POST /analyze-notes**
`json
Request: {"notes": "72M with chest pain and SOB, BP 88/60, HR 124, SpO2 89%, troponin elevated..."}
Response: {
  "trajectory": "deteriorating",
  "risk_tier": "Critical",
  "symptoms": [{"symptom": "chest pain", "negated": false, "severity": "acute", "duration": null}],
  "drugs": ["aspirin", "heparin"],
  "lab_values": [{"marker": "troponin", "value": "0.8", "unit": ""}],
  "icd10_suggestions": [{"code": "I21.9", "description": "Acute MI, unspecified", "keyword": "myocardial infarction"}],
  "emergency_flags": [{"flag": "high troponin", "action": "Cardiac pathway review."}],
  "recommended_departments": [{"department": "Emergency", "priority": 7}],
  "summary": "Patient is deteriorating. Assessed risk: Critical..."
}
`

**POST /drug-interactions**
`json
Request: {"medications": ["warfarin", "aspirin", "metformin"]}
Response: {"interactions": [{"drugs": ["warfarin", "aspirin"], "severity": "major", "effect": "Increased bleeding risk..."}], "has_major_interaction": true}
`

#### Forecasting Endpoints

**POST /forecast-vitals**
`json
Request: {
  "vitals_history": {"heart_rate": [72, 75, 78, 82, 88, 95], "systolic_bp": [128, 126, 124, 120, 115, 108]},
  "steps": 3,
  "method": "auto"
}
Response: {
  "forecasts": {
    "heart_rate": {"method": "lstm", "forecasts": [101.2, 108.5, 115.3], "lower_bound": [...], "upper_bound": [...]},
    "systolic_bp": {"method": "lstm", "forecasts": [102.1, 97.4, 93.2], ...}
  },
  "mews_latest": {"mews_score": 5, "alert_level": "high", "recommendation": "Urgent medical review..."},
  "deterioration_risk": "high"
}
`

#### Imaging Endpoints

**GET /models**
`json
Response: [{"id": "densenet121-res224-chex", "label": "CheXNet · CheXpert", "desc": "...", "size": 224}]
`

**POST /analyze-image**
`json
Request: {"image": "<base64>", "model": "densenet121-res224-chex", "filename": "xray.jpg"}
Response: {
  "findings": [
    {"label": "Pneumonia", "confidence": 0.734, "cause": "...", "medications": [...], "severity": "High"},
    {"label": "Cardiomegaly", "confidence": 0.423, "cause": "...", "severity": "Moderate"}
  ],
  "model": "densenet121-res224-chex",
  "model_label": "CheXNet · CheXpert (recommended)"
}
`

**POST /ask**
`json
Request: {"query": "Show me all High Risk patients over 65"}
Response: {
  "answer": "Found 8 patient(s) matching 'High Risk over 65': 5 High, 3 Critical. Mean values: age avg=71.2, heart_rate avg=98.4.",
  "matched_patients": [...],
  "matched_count": 8,
  "filters_applied": {"risk_tier": "High", "min_age": 65}
}
`

---

## 32. EVALUATION METRICS

### 32.1 Clustering Evaluation

**File:** ml-engine/evaluation/metrics.py

Three standard clustering quality metrics are computed after each run:

**Silhouette Score:**
For each patient i:
- a(i) = mean distance to other patients in same cluster
- b(i) = mean distance to patients in nearest different cluster
- s(i) = (b(i) - a(i)) / max(a(i), b(i))

Overall score = mean s(i) across all patients. Range: [-1, 1]. Higher is better.

**Davies-Bouldin Index:**
For each cluster i, finds the cluster j maximizing (σᵢ + σⱼ) / d(cᵢ, cⱼ) where σ = average intra-cluster distance and d = inter-centroid distance.

DB = mean of these maximum ratios. Lower is better (0 = perfect separation).

**Calinski-Harabasz Index:**
Variance Ratio Criterion = (Between-cluster variance / Within-cluster variance) × (N-K)/(K-1)

Higher is better. Well-defined clusters with small intra-cluster spread and large inter-cluster distances score high.

---

## 33. DOCKER & DEPLOYMENT

### 33.1 Docker Compose Configuration

medicluster/docker-compose.yml defines three services:

`yaml
services:
  ml-engine:
    build: ./ml-engine
    ports: ["5001:5001"]
    environment:
      - FLASK_ENV=production
    
  backend:
    build: ./backend
    ports: ["5000:5000"]
    depends_on: [ml-engine, mongodb]
    environment:
      - MONGO_URI=mongodb://mongodb:27017/medicluster
      - ML_ENGINE_URL=http://ml-engine:5001
    
  frontend:
    build: ./frontend
    ports: ["5173:80"]
    depends_on: [backend]
    
  mongodb:
    image: mongo:7
    volumes: [mongo_data:/data/db]
`

### 33.2 ML Engine Dockerfile

`dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5001
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:5001", "--workers", "2", "--timeout", "300"]
`

Gunicorn workers: 2 (memory-limited by large ML models). Timeout: 300s (for LSTM training + Grad-CAM).

### 33.3 Frontend Build

The Vite frontend is built to static files (dist/) and served via Nginx in the Docker container. Nginx config proxies /api/ requests to the backend service.

### 33.4 Production Deployment

For production, the ambulance dispatch system includes:
- Kubernetes manifests (helm charts)
- Terraform infrastructure configs
- Production docker-compose with resource limits
- Health check endpoints for container orchestration

---

## 34. SECURITY & COMPLIANCE

### 34.1 Current Security Measures

- **CORS**: Restricted to known origins (localhost:3000, localhost:5173)
- **Input validation**: All API inputs validated before ML processing
- **File size limits**: 50MB maximum for CSV and image uploads
- **Error sanitization**: Internal error details not exposed to frontend in production mode
- **Environment variables**: No secrets hardcoded in source code

### 34.2 Clinical Data Considerations

- **No PHI hardcoded**: Sample data uses synthetic patient records
- **Local processing**: All ML inference runs locally — no patient data sent to external APIs
- **Audit trail**: All clustering runs timestamped and stored in MongoDB

### 34.3 Recommended Production Additions

- HTTPS/TLS termination at load balancer
- JWT-based authentication for all API routes
- Role-based access control (physician, nurse, admin)
- Field-level encryption for sensitive patient data
- HIPAA-compliant audit logging
- Data retention policies aligned with local regulations

---

## 35. PERFORMANCE & SCALABILITY

### 35.1 ML Engine Performance

| Operation | Dataset Size | Typical Latency |
|---|---|---|
| K-Means clustering | 100 patients | < 200ms |
| K-Means clustering | 10,000 patients | < 5 seconds |
| NLP notes analysis | Short note | < 500ms |
| NLP notes analysis | Full discharge summary | < 2 seconds |
| LSTM training + forecast | 20 readings, 3 steps | < 3 seconds |
| Prophet forecast | 50 readings | < 2 seconds |
| Chest X-ray inference | Single image | < 1 second (CPU) |
| SHAP computation | 200 patients (subsample) | < 10 seconds |
| Optimal K sweep | K=2-10, 500 patients | < 15 seconds |

### 35.2 Scalability Strategies

**Horizontal scaling**: ML engine is stateless between requests (except in-memory patient vector store for chatbot). Multiple instances can run behind a load balancer with sticky sessions for chatbot continuity.

**Model caching**: X-ray models cached in memory after first load — subsequent requests are fast.

**SHAP subsampling**: SHAP is computed on ≤200 samples to prevent timeout on large datasets.

**Async anomaly detection**: Anomaly detection runs in the background after clustering, not blocking the primary response.

**Gunicorn workers**: 2 workers for ML engine (balanced between memory and concurrency).

### 35.3 Frontend Performance

- Lazy-loaded SHAP panel (not computed until user clicks "Load")
- Paginated patient table (max 50 rows visible at once)
- Debounced NLP (800ms delay prevents excessive API calls while typing)
- React.useMemo for expensive feature importance computation

---

## 36. TESTING STRATEGY

### 36.1 ML Engine Tests

**File:** ml-engine/test_smoke.py

Smoke tests verify all endpoints start correctly:
- Health endpoint returns status "ok"
- Clustering returns expected response shape
- Risk profile returns required fields

**File:** ml-engine/test_new_features.py

Feature tests covering:
- NLP notes analysis with sample clinical text
- Vital forecasting with synthetic time series
- Drug interaction detection with known pairs
- Anomaly detection with artificially injected outliers

### 36.2 Frontend Tests

The Vite build process includes TypeScript checking. Integration testing via the ambulance dispatch 	ests/ directory covers:
- WebSocket connection establishment
- Dispatch event flow (new → assigned → complete)
- Map rendering with mock coordinates

### 36.3 API Testing Dashboard

The ML engine includes an interactive API testing dashboard accessible at http://localhost:5001/ — a full HTML form interface (pi_tester.html) allowing manual testing of all 25+ endpoints without external tools like Postman.

---

## 37. FEATURE ROADMAP

Based on MediCluster_Clean_Feature_Roadmap.pptx, planned enhancements include:

### Phase 1 (Complete)
- ✅ Core clustering (K-Means, DBSCAN, Hierarchical, GMM)
- ✅ Risk scoring and triage
- ✅ NLP notes analysis
- ✅ Chest X-ray AI
- ✅ Vital sign forecasting
- ✅ RAG chatbot
- ✅ Drug interaction checker
- ✅ SHAP explainability
- ✅ Anomaly detection
- ✅ Ambulance dispatch

### Phase 2 (Planned)
- Federated learning across hospital networks
- Real-time HL7 FHIR integration
- Electronic health record (EHR) connector
- Mobile application for ward nurses
- Voice input for clinical notes
- Multilingual support (clinical notes in non-English languages)
- Wearable device integration (smartwatch vitals)

### Phase 3 (Future)
- Predictive readmission prevention program
- Population health trend analysis
- Insurance risk stratification module
- Genomic risk factor integration
- Remote patient monitoring (IoT sensors)

---

## 38. KNOWN LIMITATIONS

### 38.1 Clinical Limitations

1. **Not FDA/CE cleared**: MediCluster is a decision support tool, not a cleared medical device. All predictions must be reviewed by qualified clinicians.

2. **Unsupervised baseline**: Without labelled training data, risk tier assignments are heuristic-based. Supervised training on hospital-specific labelled data will significantly improve accuracy.

3. **Limited ICD-10 coverage**: The rule-based ICD-10 mapper covers ~19 common conditions. Rare diagnoses will not be coded.

4. **Drug interaction coverage**: 12 drug pairs in the knowledge base. Clinical pharmacists should verify all interactions independently.

### 38.2 Technical Limitations

1. **In-memory patient index**: The RAG chatbot uses an in-memory TF-IDF index that resets on server restart.

2. **Single-node ML**: LSTM training happens per-request on the API server. High concurrency could cause performance degradation.

3. **DICOM support**: Full DICOM metadata parsing (anonymization, multi-frame studies) is not yet implemented.

4. **No model persistence**: Supervised AutoML models are trained per-request and not persisted. Model registry integration is planned.

---

## 39. GLOSSARY

| Term | Definition |
|---|---|
| AVPU | Alert, Voice, Pain, Unresponsive — consciousness scale |
| BUN | Blood Urea Nitrogen |
| CLAHE | Contrast Limited Adaptive Histogram Equalization |
| DBSCAN | Density-Based Spatial Clustering of Applications with Noise |
| eGFR | Estimated Glomerular Filtration Rate |
| GMM | Gaussian Mixture Model |
| Grad-CAM | Gradient-weighted Class Activation Mapping |
| HbA1c | Glycated Hemoglobin — diabetes control marker |
| ICD-10 | International Classification of Diseases, 10th Revision |
| IQR | Interquartile Range |
| LOS | Length of Stay |
| LSTM | Long Short-Term Memory (recurrent neural network) |
| MCI | Mass Casualty Incident |
| MEWS | Modified Early Warning Score |
| MI | Mutual Information |
| NER | Named Entity Recognition |
| OSRM | Open Source Routing Machine |
| PCA | Principal Component Analysis |
| PHI | Protected Health Information |
| RAG | Retrieval-Augmented Generation |
| SHAP | SHapley Additive exPlanations |
| SpO2 | Peripheral oxygen saturation |
| t-SNE | t-Distributed Stochastic Neighbor Embedding |
| UMAP | Uniform Manifold Approximation and Projection |
| WBC | White Blood Cell count |

---

## 40. CONCLUSION

MediCluster represents a comprehensive, production-grade approach to AI-powered patient health risk segregation. By combining unsupervised machine learning, clinical NLP, deep learning imaging, time-series forecasting, and real-time dispatch coordination into a single unified platform, it addresses the full spectrum of clinical decision support needs.

### Key Innovations

1. **Zero-label risk stratification**: Delivers meaningful risk tiers from raw patient data without any pre-labelled training data, making deployment feasible for hospitals with no historical labelled datasets.

2. **Graceful degradation architecture**: Every component has a fallback — SHAP → zero stubs, LSTM → linear extrapolation, SpaCy → regex NER, FAISS → linear search. The system always returns useful output.

3. **Field alias resolution**: Handles diverse EHR column naming conventions automatically, enabling integration with any hospital's existing data exports.

4. **Clinical transparency**: Every prediction includes SHAP explanations, confidence scores, and natural-language care plans — not just a risk score.

5. **Integrated emergency ecosystem**: From patient risk scoring to ambulance dispatch to MCI board management, MediCluster covers the complete emergency care workflow.

### Impact Potential

In a typical 500-bed hospital:
- **Triage time reduction**: Automated risk stratification could reduce initial assessment time from 15 minutes to under 2 minutes per patient
- **Missed deteriorations**: MEWS-based continuous monitoring could reduce preventable ICU transfers by early detection
- **Drug safety**: Automated interaction checking could prevent medication errors
- **Imaging efficiency**: AI-assisted preliminary X-ray reading could reduce radiologist workload for routine cases

### Technical Excellence

MediCluster demonstrates that production-quality healthcare AI does not require:
- Massive labelled datasets
- Expensive cloud AI APIs
- Proprietary model weights
- Complex MLOps infrastructure

By leveraging open-source pre-trained models (TorchXRayVision, HuggingFace Transformers, scispaCy), standard ML libraries (scikit-learn, PyTorch, Prophet), and established clinical scoring systems (MEWS, triage protocols), MediCluster delivers enterprise-grade clinical AI on commodity hardware.

---

## APPENDIX A — SAMPLE PATIENT DATA FORMAT

`json
[
  {
    "patient_id": "P-001",
    "age": 67,
    "systolic_bp": 145,
    "diastolic_bp": 92,
    "heart_rate": 88,
    "respiratory_rate": 18,
    "temperature": 37.2,
    "spo2": 96,
    "glucose": 142,
    "hba1c": 7.2,
    "bmi": 28.4,
    "creatinine": 1.1,
    "wbc": 8.2,
    "hemoglobin": 13.1,
    "troponin": 0.02,
    "cholesterol": 218,
    "diabetes": 1,
    "hypertension": 1,
    "smoker": 0,
    "notes": "Patient presents with mild exertional dyspnea, controlled hypertension on lisinopril 10mg daily. HbA1c improving from 8.1 last visit."
  }
]
`

## APPENDIX B — ENVIRONMENT SETUP

### Quick Start (Development)

`ash
# 1. Start ML Engine
cd medicluster/ml-engine
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
python app.py  # Starts on port 5001

# 2. Start Backend
cd medicluster/backend
npm install
npm run dev  # Starts on port 5000

# 3. Start Frontend
cd medicluster/frontend
npm install
npm run dev  # Starts on port 5173
`

### Docker (Production)

`ash
cd medicluster
docker-compose up --build
# Access at http://localhost:5173
`

## APPENDIX C — KEY FILES REFERENCE

| File | Size | Purpose |
|---|---|---|
| ml-engine/app.py | 35KB | Flask API server — 25+ endpoints |
| ml-engine/risk/advanced_risk.py | 32KB | Clinical risk scoring engine |
| ml-engine/nlp/notes_analyzer.py | 30KB | Clinical NLP pipeline |
| frontend/src/pages/ClinicalAIPage.jsx | 55KB | Clinical AI workspace UI |
| frontend/src/pages/MCIBoardPage.jsx | 33KB | Mass Casualty Incident board |
| frontend/src/pages/DispatchPage.jsx | 29KB | Ambulance dispatch interface |
| frontend/src/pages/ImagingPage.jsx | 29KB | Medical imaging AI page |
| backend/routes/aiRoutes.js | 17KB | AI API route handlers |
| backend/routes/mediaRoutes.js | 18KB | Media upload and analysis routes |
| ml-engine/forecasting/vitals_forecaster.py | 10KB | LSTM + Prophet forecasting |
| ml-engine/imaging/analyzer.py | 7KB | X-ray CNN analysis |

---

*End of MediCluster Technical Report*
*Total Sections: 40 | Estimated Reading Time: 3-4 hours*
*Platform Version: 1.0 | Documentation Date: May 2026*
