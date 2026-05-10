# Imaging Disease Detection with Clinical Recommendations

**Date:** 2026-05-10  
**Project:** MediCluster — Patient Health Risk Segregation  
**Feature:** Upload medical image → detect pathologies → show cause, medications, prevention + AI deep explanation

---

## Overview

Enhance the existing ImagingPage so that after a chest X-ray or CT scan is uploaded and analysed, each detected pathology is shown in an expandable card with:
- Cause of the disease
- Recommended medications
- Prevention tips
- An on-demand "AI Deep Explanation" powered by Claude API

---

## Architecture

```
User uploads image
       │
       ▼
POST /api/media/upload  (Node backend — already exists)
  → stores file in MongoDB GridFS
  → returns fileId
       │
       ▼
POST /api/media/analyze/:fileId  (Node backend → ML engine — already exists, extended)
  → ML engine validates image (grayscale + size check)
  → runs torchxrayvision model
  → attaches clinical info from clinical_knowledge.py per finding
  → returns findings[] each with { label, confidence, cause, medications[], prevention[], severity }
       │
       ▼
Frontend renders expandable disease cards instantly (static info, no wait)
       │
  [user clicks "AI Deep Explanation"]
       │
       ▼
POST /api/media/explain/:fileId  (Node backend → Claude API — new endpoint)
  → accepts { findings, model_name } in request body
  → builds prompt from top findings
  → calls claude-haiku-4-5 via Anthropic SDK
  → returns { explanation: "..." }
  → frontend displays inside expanded card
```

---

## Section 1 — ML Engine Changes

### New file: `ml-engine/clinical_knowledge.py`

Static knowledge base mapping each torchxrayvision pathology label to clinical info.

**Structure per entry:**
```python
CLINICAL_KNOWLEDGE = {
    "Pneumonia": {
        "cause": "Bacterial, viral, or fungal infection of the lung air sacs",
        "medications": ["Amoxicillin", "Azithromycin", "Doxycycline"],
        "prevention": ["Pneumococcal vaccine", "Annual flu vaccine", "Regular handwashing"],
        "severity": "high"
    },
    # ... all 18 pathologies
}
```

**Severity levels** (used for card colour coding):
- `"high"` → red border
- `"moderate"` → yellow border  
- `"low"` → grey border

**Pathologies covered** (all 18 torchxrayvision labels):
Atelectasis, Consolidation, Infiltration, Pneumothorax, Edema, Emphysema, Fibrosis, Effusion, Pneumonia, Pleural_Thickening, Cardiomegaly, Nodule, Mass, Hernia, Lung Lesion, Fracture, Lung Opacity, Enlarged Cardiomediastinum

### Changes to `ml-engine/imaging/analyzer.py`

**Image validation** — before running the model, check:
1. Is the image grayscale or near-grayscale? (mean of |R-G|, |G-B| channels < 15)
2. Is it at least 128×128 px?
3. If either check fails → set `"scan_warning": "Image may not be a medical scan — results may be unreliable"` in the response

**Clinical info attachment** — after model inference, for each finding above the confidence threshold:
```python
from clinical_knowledge import CLINICAL_KNOWLEDGE

finding["cause"]        = CLINICAL_KNOWLEDGE.get(label, {}).get("cause", "Unknown")
finding["medications"]  = CLINICAL_KNOWLEDGE.get(label, {}).get("medications", [])
finding["prevention"]   = CLINICAL_KNOWLEDGE.get(label, {}).get("prevention", [])
finding["severity"]     = CLINICAL_KNOWLEDGE.get(label, {}).get("severity", "low")
```

**Confidence threshold** — only return findings with `confidence >= 0.15`. Sort descending by confidence.

**Response shape** (extended from current):
```json
{
  "findings": [
    {
      "label": "Pneumonia",
      "confidence": 0.87,
      "cause": "Bacterial or viral infection...",
      "medications": ["Amoxicillin", "Azithromycin"],
      "prevention": ["Pneumococcal vaccine", "Handwashing"],
      "severity": "high"
    }
  ],
  "scan_warning": "Image may not be a medical scan — results may be unreliable",
  "model": "densenet121-res224-chex",
  "model_label": "CheXNet · CheXpert (recommended)"
}
```

---

## Section 2 — Node Backend Changes

### New endpoint in `backend/routes/mediaRoutes.js`

```
POST /api/media/explain/:fileId
```

**Request body:**
```json
{
  "findings": [
    { "label": "Pneumonia", "confidence": 0.87 },
    { "label": "Atelectasis", "confidence": 0.43 }
  ],
  "model_name": "densenet121-res224-chex"
}
```

**Implementation:**
1. Validate `findings` array is present and non-empty
2. Build a prompt from the top findings (max 5)
3. Call `claude-haiku-4-5` via `@anthropic-ai/sdk`
4. Return `{ explanation: "..." }`

**Prompt template:**
```
A chest X-ray / medical scan analysis detected the following findings:
{findings.map(f => `${f.label} (${Math.round(f.confidence * 100)}% confidence)`).join(', ')}.

In plain English (2-3 short paragraphs), explain:
1. What these conditions mean and how they may be related
2. What treatment is typically recommended
3. How the patient can prevent worsening or recurrence

Be clear, concise, and avoid unnecessary medical jargon. 
Do not provide a specific diagnosis — this is for educational purposes only.
```

**Error handling:**
- Missing `ANTHROPIC_API_KEY` → return `{ explanation: null, error: "AI explanation unavailable" }` with HTTP 200 (card degrades gracefully, static info still shown)
- Claude API timeout/error → same graceful fallback

**New `.env` variable:**
```
ANTHROPIC_API_KEY=sk-ant-...
```

**New npm dependency:**
```
@anthropic-ai/sdk
```

---

## Section 3 — Frontend Changes

### `frontend/src/pages/ImagingPage.jsx` — full redesign of results section

**Layout:** Two-column — upload/model selector on left (200px), results on right (flex-1)

**Results section components:**

**1. Scan warning banner** (conditional)
- Shown if `scan_warning` is present in the API response
- Amber background, warning icon

**2. Disease cards** — one per finding, sorted by confidence desc
- Card border colour by severity: red (high), yellow (moderate), grey (low)
- Collapsed by default, click header to expand
- Header shows: disease name, confidence %, severity badge, expand toggle

**Expanded card content:**
- 3-column grid: Cause | Medications | Prevention
- "AI Deep Explanation" button — on click, calls `POST /api/media/explain/:fileId`, shows loading spinner, then renders explanation text
- Explanation is cached in component state so re-expanding doesn't re-fetch

**3. Medical disclaimer** — fixed at bottom of results:
> "⚠️ This tool is for educational purposes only and does not constitute medical advice. Always consult a qualified physician."

**New API client functions** (in `frontend/src/api/apiClient.js` — already has `analyzePatientMedia`):
```js
export async function explainFindings(fileId, findings, modelName) {
  const res = await api.post(`/media/explain/${fileId}`, { findings, model_name: modelName }, { timeout: 30_000 });
  return res.data;
}
```

---

## Error States

| Scenario | Behaviour |
|---|---|
| Non-medical image uploaded | Analysis still runs, amber warning banner shown |
| No findings above 15% threshold | "No significant findings detected" empty state |
| Claude API key missing | AI Deep Explanation button shows "Unavailable" |
| Claude API timeout | Graceful fallback message inside card |
| ML engine down | Existing error handling in ImagingPage |

---

## Out of Scope

- Dosage information (legal risk for a student project)
- Drug interaction warnings
- Saving analysis results to MongoDB (existing behaviour unchanged)
- Support for multi-image uploads
