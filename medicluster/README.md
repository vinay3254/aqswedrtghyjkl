# MediCluster — AI Patient Risk Stratification

> **AI-powered patient risk stratification using unsupervised clustering**  
> CtrlAltElite · M S Engineering College · Hackathon 2024

![Demo Screenshot Placeholder](docs/screenshot.png)

---

## Overview

MediCluster is a full-stack web application that automatically identifies at-risk patient populations from raw health data — **without labels**. Upload a CSV of patient vitals, choose a clustering algorithm, and instantly visualise risk tiers across your patient cohort.

**Key features:**
- 4 clustering algorithms: K-Means, DBSCAN, Hierarchical, GMM
- Interactive PCA scatter plot with risk-tier colour coding
- Silhouette, Davies-Bouldin, and Calinski-Harabasz quality metrics
- D3-powered dendrogram with cut-height slider
- Sortable, filterable patient table with CSV export
- Side-by-side algorithm comparison mode
- Bundled 100-patient sample dataset (no external APIs required)
- Full Docker Compose deployment

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React)                          │
│   HomePage  ─►  DashboardPage  ─►  ResultsPage                 │
│   Recharts ScatterChart · D3 Dendrogram · Tailwind CSS          │
└─────────────────────┬───────────────────────────────────────────┘
                      │ REST (Axios)  port 5000
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              Node.js + Express  (API Gateway)                   │
│   POST /api/data/upload   ─►  MongoDB (Dataset)                 │
│   POST /api/cluster       ─►  Python ML Engine                  │
│   GET  /api/cluster/:id   ─►  MongoDB (ClusterResult)           │
└───────────────┬─────────────────────────┬───────────────────────┘
                │                         │
         port 27017                  port 8000
                ▼                         ▼
┌───────────────────┐     ┌───────────────────────────────────────┐
│  MongoDB 6        │     │     Python 3.10 + Flask               │
│  Dataset          │     │   /cluster  ─►  preprocess ─►          │
│  ClusterResult    │     │              ─►  algorithm ─►          │
└───────────────────┘     │              ─►  metrics   ─►          │
                          │              ─►  risk_labeler          │
                          └───────────────────────────────────────┘
```

---

## Quick Start — Docker Compose

```bash
# 1. Clone / download the project
cd medicluster

# 2. Start all services
docker compose up --build

# 3. Open browser
open http://localhost:3000
```

---

## Quick Start — Manual

### 1. Python ML Engine

```bash
cd ml-engine
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py          # runs on port 8000
```

### 2. Node.js Backend

```bash
cd backend
npm install
# Edit .env: set MONGO_URI, ML_ENGINE_URL, and OLLAMA_URL/OLLAMA_API_KEY (see below)
npm run dev            # runs on port 5000
```

#### LLM provider — Ollama (primary)

All LLM features (cluster insights, medication-plan extraction, vision analysis,
clinical explanation, ARIA dispatch, voice-to-triage, chatbot) now use **Ollama**
instead of Anthropic. Configure via `backend/.env`:

```env
# Local daemon:
OLLAMA_URL=http://localhost:11434
OLLAMA_API_KEY=                         # leave blank for unauthenticated local daemon

# OR Ollama Cloud:
OLLAMA_URL=https://ollama.com
OLLAMA_API_KEY=ollama_…

# Optional pinning (auto-detected from /api/tags when blank):
OLLAMA_MODEL=nemotron-mini              # default text model
OLLAMA_VISION_MODEL=minimax-m3:cloud    # default vision model

# Reorder priority, e.g. "minimax,gemma,qwen" puts those families first:
OLLAMA_PREFERRED_FAMILIES=
```

If `OLLAMA_API_KEY` is set it's sent as `Authorization: Bearer <key>` on every
request. For Ollama Cloud this is required; for a local daemon it's optional
unless you've put an auth proxy in front of `OLLAMA_URL`. NVIDIA NIM remains a
secondary fallback (set `NVIDIA_API_KEY` if you want it).

#### Supported vision models

`looksLikeVisionModel()` auto-classifies the following families as
multimodal — pin any of them with `OLLAMA_VISION_MODEL` or set
`OLLAMA_PREFERRED_FAMILIES` to control ordering:

| Family       | Example picks                                  |
|--------------|------------------------------------------------|
| minimax      | `minimax-m3:cloud`, `minimax-m2.7:cloud`        |
| Gemma 3+ / 4 | `gemma4:31b-cloud`, `gemma3:27b`                |
| Qwen-VL      | `qwen3-vl:8b`, `qwen2.5-vl:32b`, `qwen3.5:cloud` |
| Kimi-VL      | `kimi-vl`, `kimi-k3:cloud`, `kimi-k2.6:cloud`   |
| Llama Vision | `llama3.2-vision`                                |
| LLaVA        | `llava:13b`, `llava-llama3`                      |
| Mistral      | `mistral-large-3:675b-cloud`, `pixtral:12b`      |
| GLM          | `glm-5.1:cloud`, `glm-5.2:cloud`, `glm-4v`       |
| DeepSeek     | `deepseek-v4-flash:cloud`                        |
| Nemotron     | `nemotron-3-vl`, `nemotron-3-super:cloud`        |
| InternVL     | `internvl2:8b`, `internvl2:26b`                  |
| Molmo        | `molmo:7b`                                       |

Anything tagged `:cloud` from a known multimodal family (above) is treated as
vision-capable. Pure text-only models (`*-embed-text`, `*-index-advisor`,
ad-hoc community finetunes like `laravel12-php84-boost`) are explicitly
excluded even if they share a family name.

### 3. React Frontend

```bash
cd frontend
npm install
npm run dev            # runs on port 3000
```

---

## API Endpoints

### Data Service (`/api/data`)

| Method | Endpoint           | Description                              |
|--------|--------------------|------------------------------------------|
| POST   | `/api/data/upload` | Upload CSV, returns datasetId + preview  |
| GET    | `/api/data/:id`    | Fetch a dataset by ID                    |
| GET    | `/api/data`        | List all datasets                        |

### Cluster Service (`/api/cluster`)

| Method | Endpoint                        | Description                              |
|--------|---------------------------------|------------------------------------------|
| POST   | `/api/cluster`                  | Run clustering `{ datasetId, algorithm, params }` |
| GET    | `/api/cluster/:id`              | Get a saved cluster result               |
| GET    | `/api/cluster/history/:datasetId` | Get all runs for a dataset             |

### ML Engine (internal, `port 8000`)

| Method | Endpoint                  | Description                         |
|--------|---------------------------|-------------------------------------|
| GET    | `/health`                 | Health check                        |
| POST   | `/cluster`                | Run clustering on raw patient data  |
| POST   | `/preprocess-preview`     | Return preprocessing stats          |

---

## Sample Dataset

Located at `frontend/src/data/sample_patients.json` — **100 synthetic patients** with 4 distinct risk profiles:

| Field           | Description                        |
|-----------------|------------------------------------|
| `patient_id`    | Unique identifier (P001–P100)      |
| `age`           | Age in years                       |
| `gender`        | M / F                              |
| `bmi`           | Body Mass Index                    |
| `systolic_bp`   | Systolic blood pressure (mmHg)     |
| `diastolic_bp`  | Diastolic blood pressure (mmHg)    |
| `glucose`       | Fasting blood glucose (mg/dL)      |
| `hba1c`         | HbA1c percentage                   |
| `cholesterol`   | Total cholesterol (mg/dL)          |
| `hdl`           | HDL cholesterol (mg/dL)            |
| `ldl`           | LDL cholesterol (mg/dL)            |
| `triglycerides` | Triglycerides (mg/dL)              |
| `heart_rate`    | Resting heart rate (bpm)           |
| `spo2`          | Blood oxygen saturation (%)        |
| `num_medications` | Number of current medications    |

Risk tiers: **Low** (35), **Moderate** (30), **High** (22), **Critical** (13)

---

## Algorithms

### K-Means
Partitions patients into K centroid-based clusters. Fast and interpretable. Best when clusters are roughly spherical and similar in size. Uses k-means++ initialisation for stable convergence.

### DBSCAN
Density-Based Spatial Clustering of Applications with Noise. Automatically detects arbitrary cluster shapes and flags sparse patients as noise (outliers). No need to specify K in advance.

### Hierarchical (Agglomerative)
Builds a tree of nested merges from individual patients up to a single cluster. Ward linkage minimises within-cluster variance. The dendrogram lets you choose K post-hoc by adjusting the cut height.

### GMM (Gaussian Mixture Model)
Probabilistic soft-assignment clustering using the Expectation-Maximisation algorithm. Each patient receives a probability score for each cluster. Best for overlapping, elliptical clusters.

---

## Team

**CtrlAltElite** · M S Engineering College  
Hackathon 2024
