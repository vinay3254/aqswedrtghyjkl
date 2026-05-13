# Clinical AI Page — Design Spec

**Date:** 2026-05-13  
**Project:** MediCluster (`medicluster/frontend`)  
**Status:** Approved

---

## Overview

A single scrollable dashboard page (`/clinical-ai`) that gives a clinician a unified workflow: paste or upload clinical notes/prescriptions → get instant critical alerts → see structured NLP analysis → run ML risk prediction with explainability → receive a personalized care plan → review the patient's historical risk timeline. All six panels live on one page; no modals or tab-switching.

---

## Tech Stack

The medicluster frontend uses **Tailwind CSS** + vanilla React (no MUI, no component library). All UI is built with Tailwind utility classes and inline styles, matching the existing page patterns (see `PredictPage.jsx`, `MLToolsPage.jsx`). PDF export uses the already-installed `jspdf` + `html2canvas` packages (see `src/utils/exportPdf.js`).

---

## Architecture

The page is a new React component at `medicluster/frontend/src/pages/ClinicalAIPage.jsx`. It consumes existing functions from `medicluster/frontend/src/api/apiClient.js`. No new backend endpoints are required; the page composes existing endpoints in sequence.

**Data flow:**

```
User types/pastes notes
  │
  ├─► [client-side, instant]         → Critical Alerts panel
  ├─► [debounce 800ms] analyzeNotes(notes)
  │     └─► Clinical Summary panel (entities, ICD-10, trajectory, AI summary)
  │
  └─► [Run Prediction button]
        1. predictRisk(resultId, vitals)       → risk tier + cluster
        2. generateClusterInsights(result)     → narrative explanation
        3. generateMedicationPlan(patientId, notes) → care plan
        4. getPatientClusterHistory(patientId) → timeline (also loads on patient change)
```

---

## API Signatures (actual, from apiClient.js)

| Purpose | Function | Signature |
|---|---|---|
| NLP analysis | `analyzeNotes` | `analyzeNotes(notes: string)` |
| Risk prediction | `predictRisk` | `predictRisk(resultId: string, vitals: object)` |
| AI risk explanation | `generateClusterInsights` | `generateClusterInsights(result: object)` |
| Care plan | `generateMedicationPlan` | `generateMedicationPlan(patientId, text, currentReminders?)` |
| Patient history | `getPatientClusterHistory` | `getPatientClusterHistory(patientId: string)` |
| Drug interactions | `checkDrugInteractions` | `checkDrugInteractions(medications: string[])` |
| Image/file analysis | `aiChat` | `aiChat(imageBase64, mediaType, chatHistory, question)` |
| Available models | `listClusterResults` | `listClusterResults()` — used to populate the result picker |

---

## Components / Sections

### 1 — Page Header

- Title "Clinical AI" with a subtitle "Intelligent clinical note analysis & risk prediction".
- Patient ID input (plain text input, e.g. "P-001"), used for `generateMedicationPlan` and `getPatientClusterHistory`.
- Cluster Result selector: a `<select>` populated by `listClusterResults()` — the user picks which trained model to run prediction against. Defaults to the most recent result.

### 2 — Input Zone (top, two-column on ≥768px)

**Left — Notes editor:**
- `<textarea>` for pasting clinical notes, min-height 160px, monospace-ish font.
- Character count badge bottom-right of textarea.
- "Clear" button.

**Right — File upload:**
- Drop zone accepting images (JPEG/PNG/WebP) and PDFs (display-only; extracted via `aiChat`).
- On file select: read as base64 via `FileReader`; call `aiChat(base64, mediaType, [], "Extract all clinical observations, diagnoses, medications, and vitals from this document as plain text.")`.
- On response: inject extracted text into the notes textarea (appended, not replaced, so user can combine).
- Upload state indicator: idle / uploading (spinner) / done (green tick) / error (red message).
- PDFs: convert to image via `html2canvas` or instruct user to screenshot if multi-page; single-page image is the primary use case.

### 3 — Critical Alerts Panel (right column, alongside input zone)

- Re-runs on every keystroke (no debounce — client-side only, no API call).
- Keyword list: `['chest pain', 'breathlessness', 'unconsciousness', 'syncope', 'seizure', 'stroke', 'cardiac arrest', 'severe bleeding', 'anaphylaxis', 'respiratory failure', 'altered mental status', 'hypotension']`.
- Each matched keyword → red banner with bold keyword + one-line clinical note.
- Also: after `analyzeNotes` returns, any entities with `severity === 'critical'` render as amber banners.
- If no matches: single green "No critical keywords detected" line.
- Panel has a sticky header so it stays visible while scrolling the notes.

### 4 — Clinical Summary Panel

- Triggered by debounced (800ms) `analyzeNotes(notes)` call whenever notes.length ≥ 30 characters.
- Sections:
  - **Entities table** (Tailwind `<table>`): columns — Entity, Type, Confidence. Striped rows.
  - **ICD-10 codes**: flexbox row of code chips (code + label, tooltip on hover).
  - **Trajectory badge**: `stable` (green) / `worsening` (red) / `improving` (teal).
  - **AI Summary**: blockquote styled with left border + italic text.
- Skeleton loader (animated pulse div) while call is in flight.
- **Drug interactions sub-section**: after entities load, extract medication-type entities → call `checkDrugInteractions(medicationNames)` → display any interactions as amber warning cards.

### 5 — Risk Prediction Panel

- Gated behind a **"Run Prediction"** button (only enabled when a cluster result is selected + notes.length ≥ 30).
- **Vitals form**: below the notes, a compact row of numeric inputs for the features the selected cluster model expects (age, bmi, glucose, systolic_bp, heart_rate, o2_sat). Pre-populated where `analyzeNotes` returned matching entities (e.g. if NLP found HR=92, pre-fill heart_rate).
- On button click:
  1. `predictRisk(resultId, vitals)` → `{ risk_tier, cluster_id, distance, confidence }`.
  2. `generateClusterInsights({ resultId, cluster_id, risk_tier, vitals })` → `{ insights: string }` narrative explanation.
- Renders:
  - Risk tier badge: `LOW` (green) / `MEDIUM` (amber) / `HIGH` (red) / `CRITICAL` (dark red + pulse CSS animation).
  - Confidence bar: Tailwind `<div>` with `w-[{confidence}%]` width, labeled "X% confidence".
  - AI Insights: the `insights` string from `generateClusterInsights`, rendered as formatted text.
- Loading spinner during calls; error state with "Retry" button.

### 6 — Personalized Care Plan Panel

- Rendered immediately after Risk Prediction succeeds (not before).
- Calls `generateMedicationPlan(patientId, notes)`.
- The response is a structured object with keys: `reminders` (array of medication reminder objects), and `rawPlan` (AI-generated text). Display:
  - **Medication reminders**: table of drug name, dose, frequency, time-of-day.
  - **Full care plan text**: the `rawPlan` AI narrative, displayed in a scrollable pre-formatted block.
- **Download PDF** button: uses `html2canvas` to capture the panel's DOM node → `jsPDF` to export as `care-plan-{patientId}.pdf`. Uses the existing `exportPdf.js` utility if it already handles this pattern; otherwise inline implementation.

### 7 — Patient History Timeline

- Calls `getPatientClusterHistory(patientId)` whenever `patientId` changes (not gated behind prediction).
- Returns: `[{ resultId, algorithm, createdAt, cluster_id, risk_tier, pca_x, pca_y }]`.
- Renders a vertical timeline (pure CSS + Tailwind, no library):
  - Each entry: date (formatted), risk tier chip, algorithm label, cluster ID.
  - Latest entry pinned at top with "Most Recent" badge.
  - Connector line between entries via `border-l-2` on a wrapper div.
- Empty state: "No history found for this patient."
- Loading: 3 animated skeleton timeline items.

---

## State Management

All state is local to `ClinicalAIPage` via `useState` / `useRef`. No Redux or context changes.

| State var | Type | Purpose |
|---|---|---|
| `patientId` | string | Typed patient ID |
| `notes` | string | Textarea value |
| `vitals` | object | Numeric vitals form values |
| `selectedResultId` | string | Chosen cluster model result |
| `clusterResults` | array | From `listClusterResults()` |
| `uploadStatus` | `'idle'\|'uploading'\|'done'\|'error'` | File upload state |
| `alerts` | array | Client-side keyword matches |
| `nlpResult` | object\|null | `analyzeNotes` response |
| `nlpLoading` | bool | NLP call in-flight |
| `drugInteractions` | object\|null | `checkDrugInteractions` response |
| `predResult` | object\|null | `predictRisk` response |
| `predInsights` | string\|null | `generateClusterInsights` response |
| `predLoading` | bool | Prediction calls in-flight |
| `carePlan` | object\|null | `generateMedicationPlan` response |
| `carePlanLoading` | bool | Care plan in-flight |
| `history` | array | `getPatientClusterHistory` response |
| `historyLoading` | bool | History in-flight |

---

## Error Handling

- All API calls wrapped in try/catch; errors surface as a dismissible error banner inside the relevant panel.
- No global error boundary change required — panel-level errors are isolated.
- If a call exceeds the client timeout (set in apiClient), show "This is taking longer than expected — the model may be loading. Please wait or retry."

---

## Routing & Navigation

- New route: `<Route path="/clinical-ai" element={<ClinicalAIPage />} />` in `medicluster/frontend/src/App.jsx`.
- New nav link "Clinical AI" in `medicluster/frontend/src/components/Navbar.jsx`, placed between "CliniQ" and "ML Tools".

---

## Dependencies

All already installed in `medicluster/frontend/package.json`:
- `recharts` ^2.12.0 — for the confidence bar or any mini-charts (optional, may not be needed).
- `jspdf` ^4.2.1 + `html2canvas` ^1.4.1 — PDF export.
- `axios` ^1.6.7 — via existing `apiClient`.
- `tailwindcss` ^3.4.1 — all styling.
- No new packages needed.

---

## Out of Scope

- Authentication / patient record persistence (MediCluster has no auth by design).
- Real-time websocket streaming of NLP results.
- Export to EHR systems.
- Multi-patient batch processing.
- Multi-page PDF scanning (single-page image upload only).
