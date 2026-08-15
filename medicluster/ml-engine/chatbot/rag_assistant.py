"""
chatbot/rag_assistant.py
RAG-based clinical Q&A assistant.

Architecture:
  - Patient data is embedded into a FAISS vector store (in-memory per session)
  - User queries are answered by retrieving relevant patient records + generating
    a response using a local LLM (via transformers) or rule-based fallback
  - Drug interaction checking via rule-based knowledge base

The entire system degrades gracefully if faiss-cpu / langchain / transformers
are not installed — falling back to keyword search + template answers.
"""

import json
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False

try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False
    logger.warning("faiss-cpu not installed — using linear similarity search fallback.")

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False


# ── Drug Interaction Knowledge Base ───────────────────────────────────────────

DRUG_INTERACTIONS = {
    frozenset(["warfarin", "aspirin"]):       {"severity": "major",  "effect": "Increased bleeding risk. Monitor INR closely."},
    frozenset(["warfarin", "ibuprofen"]):     {"severity": "major",  "effect": "NSAIDs potentiate warfarin anticoagulation — risk of serious hemorrhage."},
    frozenset(["metformin", "alcohol"]):      {"severity": "major",  "effect": "Risk of lactic acidosis. Avoid alcohol with metformin."},
    frozenset(["lisinopril", "potassium"]):   {"severity": "moderate", "effect": "ACE inhibitors reduce potassium excretion — monitor for hyperkalemia."},
    frozenset(["metoprolol", "verapamil"]):   {"severity": "major",  "effect": "Both reduce heart rate/conduction — risk of bradycardia and heart block."},
    frozenset(["furosemide", "digoxin"]):     {"severity": "moderate", "effect": "Furosemide causes hypokalemia which increases digoxin toxicity risk."},
    frozenset(["atorvastatin", "azithromycin"]): {"severity": "moderate", "effect": "CYP3A4 inhibition increases statin exposure — monitor for myopathy."},
    frozenset(["ceftriaxone", "calcium"]):    {"severity": "major",  "effect": "Can precipitate ceftriaxone-calcium complex — do not co-administer IV."},
    frozenset(["heparin", "aspirin"]):        {"severity": "moderate", "effect": "Combined anticoagulation increases bleeding risk significantly."},
    frozenset(["ciprofloxacin", "warfarin"]): {"severity": "major",  "effect": "Fluoroquinolones inhibit warfarin metabolism — INR can spike dangerously."},
    frozenset(["ssri", "tramadol"]):          {"severity": "major",  "effect": "Risk of serotonin syndrome — avoid combination."},
    frozenset(["lithium", "ibuprofen"]):      {"severity": "major",  "effect": "NSAIDs reduce lithium clearance — can cause lithium toxicity."},
}


def check_drug_interactions(medications: list[str]) -> dict:
    """
    Check a list of medications for known dangerous interactions.

    Parameters
    ----------
    medications : list of drug names (case-insensitive)

    Returns
    -------
    {
        "interactions": [{ drugs, severity, effect }],
        "has_major_interaction": bool,
        "summary": str
    }
    """
    meds_lower = [m.lower().strip() for m in medications]
    found = []

    for drug_pair, info in DRUG_INTERACTIONS.items():
        pair_list = list(drug_pair)
        if all(
            any(d in med or med in d for med in meds_lower)
            for d in pair_list
        ):
            found.append({
                "drugs":    pair_list,
                "severity": info["severity"],
                "effect":   info["effect"],
            })

    has_major = any(i["severity"] == "major" for i in found)
    summary = (
        f"⚠️ {len(found)} interaction(s) detected — {sum(1 for i in found if i['severity'] == 'major')} major."
        if found else "✅ No known interactions detected for the listed medications."
    )

    return {
        "interactions":          found,
        "has_major_interaction": has_major,
        "summary":               summary,
        "medications_checked":   meds_lower,
    }


# ── In-Memory Patient Vector Store ────────────────────────────────────────────

class PatientVectorStore:
    """
    A lightweight in-memory vector store for patient data.
    Uses TF-IDF on patient text representations for similarity search,
    with optional FAISS for larger datasets.
    """

    def __init__(self):
        self._patient_texts = []
        self._patient_records = []
        self._vectorizer: Optional[object] = None
        self._matrix = None
        self._faiss_index = None
        self._faiss_vectors = None

    def _patient_to_text(self, patient: dict) -> str:
        """Convert a patient record dict to a searchable text representation."""
        parts = []
        for k, v in patient.items():
            if k in ("pca_x", "pca_y", "gmm_probabilities"):
                continue
            parts.append(f"{k} {v}")
        return " ".join(str(p) for p in parts)

    def index_patients(self, patients: list[dict]) -> None:
        """Build the search index from a list of patient dicts."""
        self._patient_records = patients
        self._patient_texts = [self._patient_to_text(p) for p in patients]

        if not SKLEARN_AVAILABLE or not self._patient_texts:
            return

        self._vectorizer = TfidfVectorizer(max_features=500, stop_words="english")
        self._matrix = self._vectorizer.fit_transform(self._patient_texts)
        logger.info(f"Indexed {len(patients)} patients in vector store.")

    def search(self, query: str, top_k: int = 10) -> list[dict]:
        """Retrieve top-k most relevant patient records for a query."""
        if not self._patient_records:
            return []

        if self._vectorizer is None or self._matrix is None or not SKLEARN_AVAILABLE:
            # Keyword fallback
            q_lower = query.lower()
            return [p for p in self._patient_records
                    if q_lower in self._patient_to_text(p).lower()][:top_k]

        q_vec = self._vectorizer.transform([query])
        scores = cosine_similarity(q_vec, self._matrix).flatten()
        top_indices = scores.argsort()[::-1][:top_k]
        return [self._patient_records[i] for i in top_indices if scores[i] > 0]


# Global store (session-scoped; re-indexed on each /cluster call)
_store = PatientVectorStore()


def update_patient_index(patients: list[dict]) -> None:
    """Re-index patients after a new clustering run."""
    _store.index_patients(patients)


# ── Query Answering ───────────────────────────────────────────────────────────

def _parse_filters(query: str) -> dict:
    """Extract structured filters from a natural-language query."""
    filters = {}

    # Risk tier
    for tier in ["critical", "high", "moderate", "low"]:
        if tier in query.lower():
            filters["risk_tier"] = tier.capitalize()
            break

    # Age range
    age_match = re.search(r"(?:over|above|older than)\s+(\d+)", query, re.IGNORECASE)
    if age_match:
        filters["min_age"] = int(age_match.group(1))

    age_match2 = re.search(r"(?:under|below|younger than)\s+(\d+)", query, re.IGNORECASE)
    if age_match2:
        filters["max_age"] = int(age_match2.group(1))

    # Cluster ID
    cluster_match = re.search(r"cluster\s+(\d+)", query, re.IGNORECASE)
    if cluster_match:
        filters["cluster_id"] = int(cluster_match.group(1))

    return filters


def _apply_filters(patients: list[dict], filters: dict) -> list[dict]:
    """Filter a patient list by extracted constraints."""
    result = patients
    if "risk_tier" in filters:
        result = [p for p in result if str(p.get("risk_tier", "")).lower() == filters["risk_tier"].lower()]
    if "min_age" in filters:
        result = [p for p in result if float(p.get("age", 0)) >= filters["min_age"]]
    if "max_age" in filters:
        result = [p for p in result if float(p.get("age", 999)) <= filters["max_age"]]
    if "cluster_id" in filters:
        result = [p for p in result if int(p.get("cluster_id", -99)) == filters["cluster_id"]]
    return result


def _generate_answer(query: str, relevant_patients: list[dict], filters: dict) -> str:
    """Generate a natural-language answer from retrieved patient data."""
    n = len(relevant_patients)

    if n == 0:
        return f"No patients found matching your query: '{query}'. Try broadening the search."

    # Try local Ollama integration first
    try:
        from utils.ollama_helper import query_ollama
        patient_summaries = []
        for p in relevant_patients[:10]:
            p_details = {k: v for k, v in p.items() if k not in ("pca_x", "pca_y")}
            patient_summaries.append(str(p_details))
        
        prompt = (
            f"Here are the patient records matching the search criteria:\n"
            f"{chr(10).join(patient_summaries)}\n\n"
            f"Question: {query}\n\n"
            f"Generate a professional and concise clinical answer summarizing the matched patients, "
            f"key vitals, statistical patterns, or warning signs. Do not hallucinate fields not present."
        )
        ollama_ans = query_ollama(prompt, system_prompt="You are an advanced medical dashboard assistant. Be highly concise, structured, and clinically precise.")
        if ollama_ans:
            return ollama_ans
    except Exception as e:
        logger.warning(f"Ollama answer generation failed: {e}. Falling back to template.")

    risk_tiers = {}
    for p in relevant_patients:
        tier = p.get("risk_tier", "Unknown")
        risk_tiers[tier] = risk_tiers.get(tier, 0) + 1

    tier_summary = ", ".join(f"{cnt} {tier}" for tier, cnt in sorted(risk_tiers.items()))

    # Build contextual answer
    base = f"Found {n} patient(s) matching '{query}': {tier_summary}."

    # Add feature stats if available
    numeric_keys = [k for k in relevant_patients[0].keys()
                    if k not in ("patient_id", "risk_tier", "cluster_id", "pca_x", "pca_y")]
    if numeric_keys:
        import numpy as np
        stat_parts = []
        for feat in numeric_keys[:4]:
            vals = []
            for p in relevant_patients:
                try:
                    vals.append(float(p[feat]))
                except (KeyError, ValueError, TypeError):
                    pass
            if vals:
                stat_parts.append(f"{feat} avg={round(np.mean(vals), 1)}")
        if stat_parts:
            base += f" Mean values: {', '.join(stat_parts)}."

    return base


def answer_query(query: str, all_patients: Optional[list[dict]] = None) -> dict:
    """
    Answer a natural-language clinical query about patients.

    Parameters
    ----------
    query       : e.g. "Which High Risk patients have age over 60?"
    all_patients: optional list of patient dicts (used to refresh index)

    Returns
    -------
    {
        "answer"        : str,
        "matched_patients": list of patient records,
        "filters_applied": dict,
        "query"         : str
    }
    """
    if all_patients:
        _store.index_patients(all_patients)

    if not _store._patient_records:
        return {
            "answer": "No patient data is indexed yet. Run clustering first, then retry.",
            "matched_patients": [],
            "filters_applied":  {},
            "query": query,
        }

    # Step 1: Vector search
    retrieved = _store.search(query, top_k=50)

    # Step 2: Apply structured filters
    filters = _parse_filters(query)
    filtered = _apply_filters(retrieved if retrieved else _store._patient_records, filters)

    # Step 3: Generate answer
    answer = _generate_answer(query, filtered, filters)

    return {
        "answer":            answer,
        "matched_patients":  filtered[:20],  # cap output size
        "matched_count":     len(filtered),
        "filters_applied":   filters,
        "query":             query,
    }
