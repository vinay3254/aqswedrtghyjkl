# Imaging Disease Detection — Clinical Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cause, medications, prevention, and AI deep explanation to every detected pathology in the imaging page.

**Architecture:** ML engine gains a static clinical knowledge base and image validation; the existing `/analyze-image` endpoint is extended to attach clinical info to each finding. A new Node backend endpoint `/api/media/explain/:fileId` calls Claude Haiku to produce a plain-English explanation on demand. The frontend `ImagingPage.jsx` is redesigned so each finding renders as an expandable card with the clinical info inline and an "AI Deep Explanation" button.

**Tech Stack:** Python/Flask (ML engine), Node.js/Express + `@anthropic-ai/sdk` (backend), React + Tailwind (frontend)

---

## File Map

| Action | Path |
|---|---|
| Create | `medicluster/ml-engine/clinical_knowledge.py` |
| Create | `medicluster/ml-engine/tests/test_clinical_knowledge.py` |
| Modify | `medicluster/ml-engine/imaging/analyzer.py` |
| Modify | `medicluster/backend/routes/mediaRoutes.js` |
| Modify | `medicluster/frontend/src/api/apiClient.js` |
| Modify | `medicluster/frontend/src/pages/ImagingPage.jsx` |

---

## Task 1: Clinical Knowledge Base

**Files:**
- Create: `medicluster/ml-engine/clinical_knowledge.py`
- Create: `medicluster/ml-engine/tests/__init__.py`
- Create: `medicluster/ml-engine/tests/test_clinical_knowledge.py`

- [ ] **Step 1: Write the failing tests**

Create `medicluster/ml-engine/tests/__init__.py` (empty file), then create `medicluster/ml-engine/tests/test_clinical_knowledge.py`:

```python
import pytest
from clinical_knowledge import CLINICAL_KNOWLEDGE, get_clinical_info, ALL_LABELS

def test_all_18_labels_present():
    assert len(CLINICAL_KNOWLEDGE) == 18

def test_known_labels_present():
    for label in ALL_LABELS:
        assert label in CLINICAL_KNOWLEDGE, f"Missing: {label}"

def test_each_entry_has_required_keys():
    for label, info in CLINICAL_KNOWLEDGE.items():
        assert "cause" in info,        f"{label} missing 'cause'"
        assert "medications" in info,  f"{label} missing 'medications'"
        assert "prevention" in info,   f"{label} missing 'prevention'"
        assert "severity" in info,     f"{label} missing 'severity'"
        assert isinstance(info["medications"], list)
        assert isinstance(info["prevention"], list)
        assert info["severity"] in ("high", "moderate", "low"), f"{label} bad severity"

def test_get_clinical_info_known_label():
    info = get_clinical_info("Pneumonia")
    assert info["severity"] == "high"
    assert len(info["medications"]) > 0

def test_get_clinical_info_unknown_label():
    info = get_clinical_info("SomeFakeDisease")
    assert info["cause"] == "Unknown"
    assert info["medications"] == []
    assert info["prevention"] == []
    assert info["severity"] == "low"
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd medicluster/ml-engine
python -m pytest tests/test_clinical_knowledge.py -v
```

Expected: `ModuleNotFoundError: No module named 'clinical_knowledge'`

- [ ] **Step 3: Create `medicluster/ml-engine/clinical_knowledge.py`**

```python
"""Clinical knowledge base for torchxrayvision pathology labels."""

ALL_LABELS = [
    "Atelectasis", "Consolidation", "Infiltration", "Pneumothorax",
    "Edema", "Emphysema", "Fibrosis", "Effusion", "Pneumonia",
    "Pleural_Thickening", "Cardiomegaly", "Nodule", "Mass", "Hernia",
    "Lung Lesion", "Fracture", "Lung Opacity", "Enlarged Cardiomediastinum",
]

CLINICAL_KNOWLEDGE = {
    "Atelectasis": {
        "cause": "Partial or complete collapse of a lung or lobe, often caused by mucus blockage, post-surgical complications, or prolonged bed rest.",
        "medications": ["Bronchodilators", "Mucolytics (e.g. N-acetylcysteine)", "Antibiotics if infection present"],
        "prevention": ["Deep breathing exercises", "Early ambulation after surgery", "Incentive spirometry use"],
        "severity": "moderate",
    },
    "Consolidation": {
        "cause": "Lung tissue fills with fluid, pus, blood, or cells instead of air — typically from pneumonia or pulmonary oedema.",
        "medications": ["Antibiotics (e.g. Amoxicillin-clavulanate)", "Antifungals if fungal cause", "Diuretics if cardiac cause"],
        "prevention": ["Pneumococcal and flu vaccination", "Smoking cessation", "Prompt treatment of respiratory infections"],
        "severity": "high",
    },
    "Infiltration": {
        "cause": "Inflammatory cells, fluid, or other material accumulate in lung tissue, often from infection, allergy, or autoimmune disease.",
        "medications": ["Corticosteroids (e.g. Prednisolone)", "Antibiotics if bacterial", "Antihistamines if allergic"],
        "prevention": ["Avoid known allergens and irritants", "Annual flu vaccination", "Good hand hygiene"],
        "severity": "moderate",
    },
    "Pneumothorax": {
        "cause": "Air leaks into the space between the lung and chest wall, causing the lung to collapse. Spontaneous or from trauma/medical procedures.",
        "medications": ["Oxygen therapy", "Needle aspiration", "Chest tube insertion (for large pneumothorax)"],
        "prevention": ["Avoid smoking (primary risk factor for spontaneous type)", "Protective gear in contact sports", "Inform doctors of prior pneumothorax before procedures"],
        "severity": "high",
    },
    "Edema": {
        "cause": "Excess fluid accumulates in the lungs (pulmonary oedema), usually from heart failure, kidney disease, or acute lung injury.",
        "medications": ["Furosemide (loop diuretic)", "ACE inhibitors", "Oxygen therapy", "Morphine (in acute episodes)"],
        "prevention": ["Manage heart failure and hypertension", "Restrict salt and fluid intake", "Regular cardiac follow-up"],
        "severity": "high",
    },
    "Emphysema": {
        "cause": "Air sacs (alveoli) are progressively destroyed, reducing lung surface area. Almost exclusively caused by long-term smoking or alpha-1 antitrypsin deficiency.",
        "medications": ["Bronchodilators (e.g. Salbutamol, Tiotropium)", "Inhaled corticosteroids", "Oxygen therapy in severe cases"],
        "prevention": ["Quit smoking — most effective intervention", "Avoid occupational dust and fumes", "Alpha-1 antitrypsin replacement therapy if deficient"],
        "severity": "high",
    },
    "Fibrosis": {
        "cause": "Scar tissue replaces normal lung tissue, progressively reducing lung function. Causes include autoimmune disease, occupational exposure, or idiopathic (unknown).",
        "medications": ["Pirfenidone", "Nintedanib", "Oxygen therapy for breathlessness"],
        "prevention": ["Avoid asbestos, silica dust, and toxic fumes", "Treat autoimmune conditions early", "Avoid smoking"],
        "severity": "high",
    },
    "Effusion": {
        "cause": "Excess fluid collects in the pleural space (between lung and chest wall). Caused by heart failure, infection, cancer, or kidney disease.",
        "medications": ["Diuretics", "Antibiotics if infectious (empyema)", "Thoracentesis for drainage", "Treat underlying cause"],
        "prevention": ["Control heart failure and kidney disease", "Prompt treatment of pneumonia", "Regular follow-up for known cancer"],
        "severity": "moderate",
    },
    "Pneumonia": {
        "cause": "Bacterial, viral, or fungal infection of the lung air sacs causes inflammation and fluid build-up.",
        "medications": ["Amoxicillin (first-line bacterial)", "Azithromycin (atypical pneumonia)", "Oseltamivir (viral)", "Fluconazole (fungal)"],
        "prevention": ["Pneumococcal vaccine", "Annual influenza vaccine", "Regular handwashing", "Avoid smoking"],
        "severity": "high",
    },
    "Pleural_Thickening": {
        "cause": "Pleural lining thickens from past inflammation, infection, asbestos exposure, or haemothorax.",
        "medications": ["Anti-inflammatory drugs (e.g. NSAIDs)", "Corticosteroids if inflammatory cause", "Treat underlying condition"],
        "prevention": ["Avoid asbestos exposure", "Treat pleural infections promptly", "Occupational health monitoring"],
        "severity": "low",
    },
    "Cardiomegaly": {
        "cause": "Enlarged heart, usually due to hypertension, coronary artery disease, heart valve problems, or cardiomyopathy.",
        "medications": ["ACE inhibitors (e.g. Enalapril)", "Beta-blockers (e.g. Metoprolol)", "Diuretics", "Digoxin"],
        "prevention": ["Control blood pressure and cholesterol", "Regular aerobic exercise", "Avoid excessive alcohol", "Manage diabetes"],
        "severity": "moderate",
    },
    "Nodule": {
        "cause": "Small rounded growth (< 3 cm) in the lung. Usually benign (old infection, scar tissue) but requires follow-up to exclude early-stage cancer.",
        "medications": ["No immediate treatment for benign nodules", "Surgery or ablation if malignant"],
        "prevention": ["Quit smoking (largest risk factor for malignant nodules)", "Reduce radon exposure at home", "Annual low-dose CT screening if high risk"],
        "severity": "moderate",
    },
    "Mass": {
        "cause": "Larger lung growth (> 3 cm). Higher likelihood of malignancy than a nodule; requires urgent investigation.",
        "medications": ["Surgery (lobectomy/pneumonectomy)", "Chemotherapy", "Radiotherapy", "Immunotherapy (e.g. Pembrolizumab)"],
        "prevention": ["Smoking cessation", "Radon and asbestos avoidance", "Annual CT screening for high-risk individuals"],
        "severity": "high",
    },
    "Hernia": {
        "cause": "An organ (usually bowel or stomach) protrudes through an abnormal opening into the chest cavity — commonly hiatal or diaphragmatic hernia.",
        "medications": ["Proton pump inhibitors for hiatal hernia symptoms", "Surgical repair for symptomatic or large hernias"],
        "prevention": ["Maintain healthy weight", "Avoid heavy lifting with poor technique", "Treat chronic cough and constipation"],
        "severity": "low",
    },
    "Lung Lesion": {
        "cause": "Abnormal area of lung tissue from infection, inflammation, trauma, or tumour. Non-specific finding requiring further investigation.",
        "medications": ["Depends on cause: antibiotics, antifungals, steroids, or oncology treatment"],
        "prevention": ["Smoking cessation", "Treat respiratory infections promptly", "Avoid inhaled toxins"],
        "severity": "moderate",
    },
    "Fracture": {
        "cause": "Rib or other thoracic bone fracture visible on chest imaging — from trauma, osteoporosis, or pathological fracture from cancer.",
        "medications": ["Analgesics (NSAIDs, paracetamol)", "Intercostal nerve block for pain", "Treat osteoporosis with bisphosphonates"],
        "prevention": ["Fall prevention (exercise, home safety)", "Calcium and vitamin D supplementation", "Bone density screening after 50"],
        "severity": "moderate",
    },
    "Lung Opacity": {
        "cause": "Area of increased density in the lung on imaging — a non-specific finding covering consolidation, atelectasis, oedema, and tumour until further investigation defines it.",
        "medications": ["Depends on underlying cause"],
        "prevention": ["Prompt follow-up imaging to determine underlying cause", "Smoking cessation", "Treat respiratory infections early"],
        "severity": "moderate",
    },
    "Enlarged Cardiomediastinum": {
        "cause": "Widening of the central chest area, indicating cardiomegaly, aortic aneurysm, pericardial effusion, or mediastinal mass.",
        "medications": ["Treat underlying cause: diuretics for heart failure, surgery for aortic aneurysm, antibiotics for mediastinitis"],
        "prevention": ["Regular cardiac check-ups", "Control blood pressure", "CT aortography for at-risk patients"],
        "severity": "high",
    },
}


def get_clinical_info(label: str) -> dict:
    """Return clinical info for a pathology label, or a safe default if unknown."""
    return CLINICAL_KNOWLEDGE.get(label, {
        "cause": "Unknown",
        "medications": [],
        "prevention": [],
        "severity": "low",
    })
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd medicluster/ml-engine
python -m pytest tests/test_clinical_knowledge.py -v
```

Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add medicluster/ml-engine/clinical_knowledge.py medicluster/ml-engine/tests/
git commit -m "feat: add clinical knowledge base for all 18 pathologies"
```

---

## Task 2: Update ML Engine — Image Validation + Clinical Info

**Files:**
- Modify: `medicluster/ml-engine/imaging/analyzer.py`
- Create: `medicluster/ml-engine/tests/test_analyzer_extensions.py`

- [ ] **Step 1: Write failing tests**

Create `medicluster/ml-engine/tests/test_analyzer_extensions.py`:

```python
import numpy as np
import pytest
from imaging.analyzer import _is_medical_scan, _attach_clinical_info

def test_grayscale_image_passes_validation():
    # Pure grayscale: R == G == B
    arr = np.ones((256, 256, 3), dtype=np.uint8) * 128
    warning = _is_medical_scan(arr)
    assert warning is None

def test_colour_photo_fails_validation():
    # Vivid colour image (green channel very different from red)
    arr = np.zeros((256, 256, 3), dtype=np.uint8)
    arr[:, :, 0] = 200   # R
    arr[:, :, 1] = 20    # G
    arr[:, :, 2] = 20    # B
    warning = _is_medical_scan(arr)
    assert warning is not None
    assert "may not be a medical scan" in warning

def test_small_image_fails_validation():
    arr = np.ones((64, 64, 3), dtype=np.uint8) * 128
    warning = _is_medical_scan(arr)
    assert warning is not None

def test_attach_clinical_info_adds_fields():
    findings = [
        {"label": "Pneumonia", "confidence": 0.87},
        {"label": "Atelectasis", "confidence": 0.43},
    ]
    result = _attach_clinical_info(findings, threshold=0.15)
    assert len(result) == 2
    for f in result:
        assert "cause" in f
        assert "medications" in f
        assert "prevention" in f
        assert "severity" in f

def test_attach_clinical_info_filters_below_threshold():
    findings = [
        {"label": "Pneumonia", "confidence": 0.87},
        {"label": "Nodule", "confidence": 0.10},  # below 0.15
    ]
    result = _attach_clinical_info(findings, threshold=0.15)
    assert len(result) == 1
    assert result[0]["label"] == "Pneumonia"

def test_attach_clinical_info_sorted_descending():
    findings = [
        {"label": "Atelectasis", "confidence": 0.43},
        {"label": "Pneumonia", "confidence": 0.87},
    ]
    result = _attach_clinical_info(findings, threshold=0.15)
    assert result[0]["confidence"] > result[1]["confidence"]
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd medicluster/ml-engine
python -m pytest tests/test_analyzer_extensions.py -v
```

Expected: `ImportError` — `_is_medical_scan` and `_attach_clinical_info` not yet defined.

- [ ] **Step 3: Add helper functions to `medicluster/ml-engine/imaging/analyzer.py`**

Add these two functions after the `XRV_MODELS` registry and before `list_models()`. Also add the import at the top of the file:

At the top of the file, after the existing imports, add:
```python
from clinical_knowledge import get_clinical_info
```

After the `_cache: dict = {}` line, add:

```python
CONFIDENCE_THRESHOLD = 0.15


def _is_medical_scan(arr: np.ndarray) -> str | None:
    """
    Returns a warning string if the image is probably not a medical scan,
    or None if it looks like one.
    Checks: near-grayscale colour channels and minimum size.
    """
    if arr.shape[0] < 128 or arr.shape[1] < 128:
        return "Image may not be a medical scan — resolution too low (min 128×128 px)"

    if arr.ndim == 3 and arr.shape[2] == 3:
        rg_diff = float(np.mean(np.abs(arr[:, :, 0].astype(float) - arr[:, :, 1].astype(float))))
        gb_diff = float(np.mean(np.abs(arr[:, :, 1].astype(float) - arr[:, :, 2].astype(float))))
        if rg_diff > 15 or gb_diff > 15:
            return "Image may not be a medical scan — results may be unreliable"

    return None


def _attach_clinical_info(findings: list[dict], threshold: float = CONFIDENCE_THRESHOLD) -> list[dict]:
    """
    Filter findings below threshold, attach clinical info, sort by confidence desc.
    """
    filtered = [f for f in findings if f.get("confidence", 0) >= threshold]
    filtered.sort(key=lambda f: f["confidence"], reverse=True)
    for f in filtered:
        info = get_clinical_info(f["label"])
        f["cause"]        = info["cause"]
        f["medications"]  = info["medications"]
        f["prevention"]   = info["prevention"]
        f["severity"]     = info["severity"]
    return filtered
```

- [ ] **Step 4: Update `analyze_image()` in `analyzer.py` to call these helpers**

Find the `analyze_image` function (starts around line 129). Replace its body with:

```python
def analyze_image(
    image_bytes: bytes,
    model_name: str = DEFAULT_MODEL,
    filename: str = "",
) -> dict:
    cfg = XRV_MODELS.get(model_name)
    if cfg is None:
        raise ValueError(f"Unknown model: {model_name}")

    arr, is_dicom = _load_pixels(image_bytes, filename)

    # Validate image looks like a medical scan
    scan_warning = None
    if not is_dicom:
        rgb_arr = np.stack([arr, arr, arr], axis=-1) if arr.ndim == 2 else arr
        if rgb_arr.dtype != np.uint8:
            rgb_arr = np.clip(rgb_arr, 0, 255).astype(np.uint8)
        scan_warning = _is_medical_scan(rgb_arr)

    model  = _get_model(model_name)
    tensor = _preprocess(arr, cfg["size"], is_dicom)

    with torch.no_grad():
        output = model(tensor)

    probs = torch.sigmoid(output).squeeze().cpu().numpy()

    raw_findings = [
        {"label": label, "confidence": round(float(prob), 4)}
        for label, prob in zip(model.pathologies, probs)
        if label
    ]

    findings = _attach_clinical_info(raw_findings, threshold=CONFIDENCE_THRESHOLD)

    result = {
        "findings":    findings,
        "model":       model_name,
        "model_label": cfg["label"],
    }
    if scan_warning:
        result["scan_warning"] = scan_warning

    return result
```

- [ ] **Step 5: Run all ML engine tests**

```bash
cd medicluster/ml-engine
python -m pytest tests/ -v
```

Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add medicluster/ml-engine/imaging/analyzer.py medicluster/ml-engine/tests/test_analyzer_extensions.py
git commit -m "feat: add image validation and clinical info to analyzer"
```

---

## Task 3: Update Backend — Pass Clinical Info Through + New Explain Endpoint

**Files:**
- Modify: `medicluster/backend/routes/mediaRoutes.js`
- Modify: `medicluster/backend/.env` (add ANTHROPIC_API_KEY)
- Modify: `medicluster/backend/package.json` (add @anthropic-ai/sdk)

- [x] **Step 1: Install Anthropic SDK**

```bash
cd medicluster/backend
npm install @anthropic-ai/sdk
```

Expected: package added to `node_modules` and `package.json`.

- [x] **Step 2: Add `ANTHROPIC_API_KEY` to `.env`**

Open `medicluster/backend/.env` and add:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Replace `sk-ant-your-key-here` with your actual Anthropic API key from https://console.anthropic.com

- [x] **Step 3: Update the analyze endpoint to pass through clinical fields**

In `medicluster/backend/routes/mediaRoutes.js`, find the `POST /analyze/:fileId` route (around line 142). Replace this block:

```js
    const analysis = {
      findings: mlRes.data.findings,
      model: mlRes.data.model,
      analyzedAt: new Date(),
    };
```

With:

```js
    const analysis = {
      findings:     mlRes.data.findings,
      model:        mlRes.data.model,
      model_label:  mlRes.data.model_label,
      scan_warning: mlRes.data.scan_warning || null,
      analyzedAt:   new Date(),
    };
```

- [x] **Step 4: Add the explain endpoint to `mediaRoutes.js`**

Add this new route **before** the `GET /:patientId` route (i.e. before line 191 in the original file). Add it after the analyze route:

```js
// POST /api/media/explain/:fileId  — AI deep explanation via Claude
router.post("/explain/:fileId", async (req, res) => {
  const { findings, model_name } = req.body;

  if (!Array.isArray(findings) || findings.length === 0) {
    return res.status(400).json({ error: "findings array is required" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.json({ explanation: null, error: "AI explanation unavailable — ANTHROPIC_API_KEY not configured" });
  }

  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const top = findings.slice(0, 5);
  const findingsList = top
    .map((f) => `${f.label} (${Math.round((f.confidence ?? 0) * 100)}% confidence)`)
    .join(", ");

  const prompt = `A chest X-ray / medical scan analysis detected the following findings: ${findingsList}.

In plain English (2–3 short paragraphs), explain:
1. What these conditions mean and how they may be related
2. What treatment is typically recommended
3. How the patient can prevent worsening or recurrence

Be clear, concise, and avoid unnecessary medical jargon. Do not provide a specific diagnosis — this is for educational purposes only.`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const explanation = message.content?.[0]?.text ?? null;
    return res.json({ explanation });
  } catch (err) {
    console.error("Claude API error:", err.message);
    return res.json({ explanation: null, error: "AI explanation temporarily unavailable" });
  }
});
```

- [x] **Step 5: Restart backend and smoke-test the analyze endpoint**

```bash
cd medicluster/backend
npm run dev
```

In a second terminal:
```bash
# Health check
curl http://localhost:5000/api/health
```

Expected: `{"status":"ok","service":"medicluster-backend"}`

- [x] **Step 6: Commit**

```bash
git add medicluster/backend/routes/mediaRoutes.js medicluster/backend/package.json medicluster/backend/package-lock.json
git commit -m "feat: add explain endpoint and pass clinical info through analyze route"
```

---

## Task 4: Frontend API Client

**Files:**
- Modify: `medicluster/frontend/src/api/apiClient.js`

- [ ] **Step 1: Add `explainFindings` to `apiClient.js`**

Open `medicluster/frontend/src/api/apiClient.js`. After the existing `analyzePatientMedia` function, add:

```js
/**
 * Request an AI plain-English explanation for a set of findings.
 * Returns { explanation: string | null, error?: string }
 */
export async function explainFindings(fileId, findings, modelName = "densenet121-res224-chex") {
  const res = await api.post(
    `/media/explain/${fileId}`,
    { findings, model_name: modelName },
    { timeout: 30_000 }
  );
  return res.data;
}
```

- [ ] **Step 2: Commit**

```bash
git add medicluster/frontend/src/api/apiClient.js
git commit -m "feat: add explainFindings API client function"
```

---

## Task 5: Redesign ImagingPage — Expandable Disease Cards

**Files:**
- Modify: `medicluster/frontend/src/pages/ImagingPage.jsx`

This task replaces the findings section of `ImageCard` with expandable disease cards. The upload/drag-drop, patient ID input, model selector, image grid, and lightbox remain unchanged.

- [ ] **Step 1: Add the `DiseaseCard` component inside `ImagingPage.jsx`**

At the top of `ImagingPage.jsx`, add `explainFindings` to the import:

```js
import {
  analyzePatientMedia, deletePatientMedia, getMediaFileUrl,
  listModels, listPatientMedia, uploadPatientMedia, explainFindings,
} from "../api/apiClient";
```

Then add a new `DiseaseCard` component just **above** the existing `ImageCard` function definition:

```jsx
const SEVERITY_STYLES = {
  high:     { border: "border-red-300",    badge: "bg-red-100 text-red-700",     title: "text-red-700"     },
  moderate: { border: "border-amber-300",  badge: "bg-amber-100 text-amber-700", title: "text-amber-700"   },
  low:      { border: "border-slate-200",  badge: "bg-slate-100 text-slate-500", title: "text-slate-600"   },
};

function DiseaseCard({ finding, allFindings, fileId, modelName, isFirst }) {
  const [expanded, setExpanded]         = useState(isFirst);
  const [explanation, setExplanation]   = useState(null);
  const [loadingAI, setLoadingAI]       = useState(false);
  const [aiError, setAiError]           = useState(null);

  const style     = SEVERITY_STYLES[finding.severity] ?? SEVERITY_STYLES.low;
  const pct       = Math.round((finding.confidence ?? 0) * 100);

  const handleAIExplain = async () => {
    if (explanation) return;
    setLoadingAI(true);
    setAiError(null);
    try {
      // Pass all findings for context-aware explanation, not just this card's finding
      const data = await explainFindings(fileId, allFindings, modelName);
      if (data.explanation) {
        setExplanation(data.explanation);
      } else {
        setAiError(data.error ?? "Explanation unavailable");
      }
    } catch {
      setAiError("AI explanation temporarily unavailable");
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${style.border}`}>
      {/* Card header — always visible, click to expand */}
      <button
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`font-semibold text-sm truncate ${style.title}`}>{finding.label}</span>
          <span className="text-xs text-slate-400 font-mono shrink-0">{pct}%</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>
            {finding.severity?.toUpperCase()}
          </span>
          <svg
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-100">
          {/* 3-column clinical grid */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="bg-amber-50 rounded-md p-2">
              <p className="text-xs font-bold text-amber-800 mb-1 uppercase tracking-wide">Cause</p>
              <p className="text-xs text-amber-900 leading-relaxed">{finding.cause || "—"}</p>
            </div>
            <div className="bg-blue-50 rounded-md p-2">
              <p className="text-xs font-bold text-blue-800 mb-1 uppercase tracking-wide">Medications</p>
              {(finding.medications ?? []).length > 0 ? (
                <ul className="space-y-0.5">
                  {finding.medications.map((m) => (
                    <li key={m} className="text-xs text-blue-900">• {m}</li>
                  ))}
                </ul>
              ) : <p className="text-xs text-blue-400">—</p>}
            </div>
            <div className="bg-emerald-50 rounded-md p-2">
              <p className="text-xs font-bold text-emerald-800 mb-1 uppercase tracking-wide">Prevention</p>
              {(finding.prevention ?? []).length > 0 ? (
                <ul className="space-y-0.5">
                  {finding.prevention.map((p) => (
                    <li key={p} className="text-xs text-emerald-900">• {p}</li>
                  ))}
                </ul>
              ) : <p className="text-xs text-emerald-400">—</p>}
            </div>
          </div>

          {/* AI Deep Explanation */}
          {!explanation && !aiError && (
            <button
              onClick={handleAIExplain}
              disabled={loadingAI}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md py-1.5 transition-colors disabled:opacity-60"
            >
              {loadingAI ? (
                <><div className="spinner w-3 h-3" />Generating AI explanation…</>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI Deep Explanation
                </>
              )}
            </button>
          )}

          {aiError && (
            <p className="text-xs text-slate-400 italic">{aiError}</p>
          )}

          {explanation && (
            <div className="bg-blue-50 border border-blue-100 rounded-md p-2.5">
              <p className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI Explanation
              </p>
              <p className="text-xs text-blue-900 leading-relaxed whitespace-pre-wrap">{explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace the findings section inside `ImageCard`**

Inside the `ImageCard` function, find the block that starts with:
```jsx
        {img.analysis && (
          <div className="space-y-2 flex-1">
```

Replace **that entire block** (from `{img.analysis && (` down to and including its closing `)}`) with:

```jsx
        {img.analysis && (
          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">AI Findings</p>
              <span className="text-xs font-mono text-slate-300 truncate max-w-[160px]" title={img.analysis.model_label || img.analysis.model}>
                {img.analysis.model_label || img.analysis.model}
              </span>
            </div>

            {img.analysis.scan_warning && (
              <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-amber-700">{img.analysis.scan_warning}</p>
              </div>
            )}

            {img.analysis.findings?.length > 0 ? (
              <div className="space-y-1.5">
                {img.analysis.findings.map((f, i) => (
                  <DiseaseCard
                    key={f.label}
                    finding={f}
                    allFindings={img.analysis.findings}
                    fileId={img.gridfs_id}
                    modelName={selectedModel}
                    isFirst={i === 0}
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                No significant findings detected above threshold
              </p>
            )}

            <p className="text-xs text-slate-300 pt-1 border-t border-slate-100">
              ⚠️ Educational purposes only — not a clinical diagnosis. Consult a qualified physician.
            </p>
          </div>
        )}
```

- [ ] **Step 3: Start the frontend dev server and verify visually**

```bash
cd medicluster/frontend
npm run dev
```

Open `http://localhost:5173/imaging` and verify:
1. Upload any image — should appear in the grid
2. Click "Run AI Analysis" — after analysis, disease cards appear (collapsed except the first)
3. Click a card header — it expands showing Cause / Medications / Prevention grid
4. If the image is not a medical scan, an amber warning banner appears above the cards
5. Click "AI Deep Explanation" — spinner shows, then explanation text appears
6. Re-collapse and re-expand the same card — explanation text is still there (cached, no re-fetch)
7. Medical disclaimer appears below all cards

- [ ] **Step 4: Commit**

```bash
git add medicluster/frontend/src/pages/ImagingPage.jsx
git commit -m "feat: redesign imaging page with expandable disease cards and AI explanation"
```

---

## Task 6: Final Integration Check

- [ ] **Step 1: Start all three services**

Terminal 1 — ML engine:
```bash
cd medicluster/ml-engine
python app.py
```

Terminal 2 — Backend:
```bash
cd medicluster/backend
npm run dev
```

Terminal 3 — Frontend:
```bash
cd medicluster/frontend
npm run dev
```

- [ ] **Step 2: End-to-end smoke test**

1. Open `http://localhost:5173/imaging`
2. Upload a chest X-ray image
3. Click "Run AI Analysis" — verify findings cards appear with clinical info
4. Click a disease card — verify Cause / Medications / Prevention sections are populated
5. Click "AI Deep Explanation" — verify Claude response appears within ~5 seconds
6. Upload a colour photo (e.g. a selfie) — verify amber warning banner appears
7. Verify the medical disclaimer is visible at the bottom of each image card

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete imaging disease detection with clinical recommendations and AI explanation"
```
