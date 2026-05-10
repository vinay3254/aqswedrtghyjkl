# Patient Dashboard — Design

**Date:** 2026-05-10
**Feature:** Dedicated page per patient showing their full picture: risk tier, imaging analysis history, and clustering membership

---

## Overview

A `/patient/:patientId` page that aggregates everything MediCluster knows about one patient. Pulls imaging data (already in MongoDB via PatientMedia) and cluster membership (by scanning ClusterResult patients arrays). Single-page summary useful for demo and viva.

---

## Architecture

```
Navigate to /patient/:patientId (or search by ID)
        │
        ▼
Frontend calls two APIs in parallel:
  GET /api/media/:patientId        → imaging history + analysis
  GET /api/cluster/patient/:patientId → find this patient in saved results
        │
        ▼
Renders patient summary card + imaging section + clustering section
```

---

## Backend — New Endpoint

**`GET /api/cluster/patient/:patientId`** added to `clusterRoutes.js`

Logic:
1. Search all ClusterResults where `patients` array contains a patient with `patient_id === patientId`
2. Return up to 5 most recent matches: `{ resultId, algorithm, createdAt, cluster_id, risk_tier, pca_x, pca_y }`
3. If none found, return `[]`

Uses MongoDB projection to avoid loading full patients arrays — uses `$elemMatch` to find matching patients efficiently.

---

## Frontend — New Page

**`frontend/src/pages/PatientPage.jsx`**

**Header section:**
- Patient ID display (large, monospace)
- Overall risk tier badge — derived from most recent clustering result (or "Unanalyzed" if none)
- Last updated timestamp

**Imaging section** (uses existing `getMediaFileUrl`, `analyzePatientMedia` data):
- Grid of uploaded scans with their analysis results
- Each scan shows top finding + severity badge
- "No images uploaded" empty state

**Clustering history section:**
- Table: Algorithm | Risk Tier | Date | Cluster ID
- Colour-coded risk tier per row
- "Not found in any clustering run" empty state

**Search/navigation:**
- Page has a patient ID input at top — navigate to any patient
- Navbar "Patients" link goes to `/patient` (blank search state)

**`frontend/src/api/apiClient.js`** — add:
- `getPatientClusterHistory(patientId)` → GET /api/cluster/patient/:patientId

**`frontend/src/App.jsx`** — add routes `/patient` and `/patient/:patientId`

**`frontend/src/components/Navbar.jsx`** — add "Patients" nav link

---

## Error States

| Scenario | Behaviour |
|---|---|
| Patient has no images | Empty state shown in imaging section |
| Patient not in any cluster result | Empty state in clustering section |
| Patient ID not found at all | Both sections show empty state |

---

## Out of Scope
- Editing patient data
- Deleting patients
- Patient-level notes or annotations
