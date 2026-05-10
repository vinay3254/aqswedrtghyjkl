/**
 * backend/routes/triageRoutes.js
 * Patient-level triage records, vitals scoring, per-patient hospital allocation,
 * voice-to-triage (Claude API), and MCI board data.
 */

const express  = require("express");
const mongoose = require("mongoose");
const IncidentPatient = require("../models/IncidentPatient");
const Hospital        = require("../models/Hospital");
const { scoreVitals, detectPathways, suggestBedType, requiredSpecialties } = require("../utils/triageScoring");

const router = express.Router();

// ── Tag generator ─────────────────────────────────────────────────────────────
async function nextPatientTag(incidentId) {
  const count = await IncidentPatient.countDocuments({ incident_id: incidentId });
  const n = String(count + 1).padStart(3, "0");
  const shortId = incidentId.replace(/^ARIA-/, "").slice(0, 8);
  return `PT-${shortId}-${n}`;
}

// ── GET /api/triage/incidents/:incidentId ─────────────────────────────────────
// All patients for one dispatch incident
router.get("/incidents/:incidentId", async (req, res, next) => {
  try {
    const patients = await IncidentPatient.find({ incident_id: req.params.incidentId })
      .sort({ triage_category: 1, createdAt: 1 })
      .lean();
    return res.json(patients);
  } catch (err) { return next(err); }
});

// ── POST /api/triage/incidents/:incidentId/patients ───────────────────────────
// Create a new patient within an incident
router.post("/incidents/:incidentId/patients", async (req, res, next) => {
  const { incidentId } = req.params;
  const {
    name, age, gender,
    vitals,
    pathway_flags,
    sector,
    voice_triage_notes,
  } = req.body;

  try {
    const patient_tag = await nextPatientTag(incidentId);

    // Auto-score if vitals provided
    let triage_category = "UNSET";
    let triage_score    = 0;
    let triage_issues   = [];
    let autoPathways    = [];

    if (vitals && typeof vitals === "object") {
      const result = scoreVitals(vitals, age);
      triage_category = result.category;
      triage_score    = result.score;
      triage_issues   = result.issues;
    }

    // Detect pathways from voice notes or injury description
    const textForPathways = [
      voice_triage_notes,
      vitals?.injury_type,
      vitals?.injury_description,
      vitals?.notes,
    ].filter(Boolean).join(" ");
    autoPathways = detectPathways(textForPathways, age);

    const mergedFlags = [...new Set([...(pathway_flags ?? []), ...autoPathways])];
    const bedType = suggestBedType(triage_category, mergedFlags);

    const patient = await IncidentPatient.create({
      incident_id: incidentId,
      patient_tag,
      name:            name ?? "Unknown",
      age:             age ?? undefined,
      gender:          gender ?? "Unknown",
      triage_category,
      triage_score,
      triage_issues,
      pathway_flags:   mergedFlags,
      vitals:          vitals ?? undefined,
      vitals_history:  vitals ? [{ ...vitals, recorded_at: new Date() }] : [],
      sector:          sector ?? "A",
      bed_type:        bedType,
      voice_triage_notes: voice_triage_notes ?? "",
    });

    return res.status(201).json(patient);
  } catch (err) { return next(err); }
});

// ── PATCH /api/triage/patients/:patientId ─────────────────────────────────────
// Update allocation, transport status, or manual triage override
router.patch("/patients/:patientId", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.patientId)) {
    return res.status(400).json({ error: "Invalid patientId" });
  }
  const allowed = [
    "name", "age", "gender", "triage_category", "pathway_flags",
    "transport_status", "assigned_ambulance_id",
    "destination_hospital_id", "destination_hospital_name",
    "bed_type", "sector", "voice_triage_notes",
  ];
  const update = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const updated = await IncidentPatient.findByIdAndUpdate(req.params.patientId, update, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: "Patient not found" });
    return res.json(updated);
  } catch (err) { return next(err); }
});

// ── POST /api/triage/patients/:patientId/vitals ───────────────────────────────
// Append a new vitals reading + re-score triage
router.post("/patients/:patientId/vitals", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.patientId)) {
    return res.status(400).json({ error: "Invalid patientId" });
  }
  const vitals = req.body;
  if (!vitals || typeof vitals !== "object") {
    return res.status(400).json({ error: "Vitals object required" });
  }
  try {
    const patient = await IncidentPatient.findById(req.params.patientId);
    if (!patient) return res.status(404).json({ error: "Patient not found" });

    const result = scoreVitals(vitals, patient.age);
    const newVitals = { ...vitals, recorded_at: new Date() };

    patient.vitals         = newVitals;
    patient.triage_category = result.category;
    patient.triage_score    = result.score;
    patient.triage_issues   = result.issues;
    patient.vitals_history.push(newVitals);

    await patient.save();
    return res.json(patient.toObject());
  } catch (err) { return next(err); }
});

// ── POST /api/triage/score ────────────────────────────────────────────────────
// Stateless: compute triage score from vitals without saving
router.post("/score", (req, res) => {
  const { vitals, age, condition_text } = req.body;
  if (!vitals || typeof vitals !== "object") {
    return res.status(400).json({ error: "vitals object required" });
  }
  const result   = scoreVitals(vitals, age);
  const pathways = detectPathways(condition_text ?? "", age);
  const bedType  = suggestBedType(result.category, pathways);
  const specs    = requiredSpecialties(pathways);
  return res.json({ ...result, pathway_flags: pathways, suggested_bed_type: bedType, required_specialties: specs });
});

// ── POST /api/triage/voice ────────────────────────────────────────────────────
// Voice/text-to-triage: Claude extracts vitals + category from free text
router.post("/voice", async (req, res, next) => {
  const { text, incidentId } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: "text is required" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-ant-placeholder")) {
    return res.status(503).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  const prompt = `You are a paramedic triage assistant. Analyze the following dispatcher call transcript or field crew notes and extract:
1. Patient demographics (age, gender if mentioned)
2. Estimated vitals (respiratory_rate, spo2, systolic_bp, heart_rate, avpu, gcs) — extract numbers from the text or estimate from clinical descriptions
3. Injury/condition type
4. Suggested START triage category (RED/YELLOW/GREEN/BLACK)
5. Relevant pathway flags from: trauma, stroke, stemi, cardiac, pediatric, burn, psychiatric, hazmat, maternity, infectious
6. A concise clinical summary for the triage tag (2-3 sentences, paramedic language)

Respond ONLY with this JSON (no markdown):
{
  "age": <number or null>,
  "gender": "M" | "F" | "Unknown",
  "vitals": {
    "respiratory_rate": <number or null>,
    "spo2": <number or null>,
    "systolic_bp": <number or null>,
    "heart_rate": <number or null>,
    "avpu": "A" | "V" | "P" | "U" | null,
    "gcs": <number or null>,
    "injury_type": "<string or null>",
    "injury_description": "<string>"
  },
  "suggested_category": "RED" | "YELLOW" | "GREEN" | "BLACK",
  "pathway_flags": ["flag1", "flag2"],
  "triage_summary": "<2-3 sentence clinical summary>"
}

Transcript/notes:
${text.trim()}`;

  try {
    const Anthropic = require("@anthropic-ai/sdk");
    const client    = new Anthropic({ apiKey });
    const message   = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages:   [{ role: "user", content: prompt }],
    });

    const raw = message.content?.[0]?.text ?? "";
    let parsed;
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : raw);
    } catch {
      return res.status(502).json({ error: "AI returned malformed response", raw });
    }

    // Also run local scoring if vitals extracted
    let localScore = null;
    if (parsed.vitals) {
      localScore = scoreVitals(parsed.vitals, parsed.age);
    }

    return res.json({ ...parsed, local_score: localScore });
  } catch (err) {
    return next(err);
  }
});

// ── POST /api/triage/allocate ─────────────────────────────────────────────────
// Suggest best hospital for a patient based on triage + pathways
router.post("/allocate", async (req, res, next) => {
  const { triage_category, pathway_flags = [], exclude_hospital_ids = [] } = req.body;
  if (!triage_category) {
    return res.status(400).json({ error: "triage_category required" });
  }
  try {
    const hospitals = await Hospital.find({ hospitalId: { $nin: exclude_hospital_ids } }).lean();
    if (hospitals.length === 0) {
      return res.status(404).json({ error: "No hospitals available" });
    }

    const needed = requiredSpecialties(pathway_flags);
    const needsCritical = triage_category === "RED";

    // Score each hospital
    const scored = hospitals
      .filter((h) => h.available_beds > 0)
      .map((h) => {
        let pts = 0;
        // Trauma level match
        if (needsCritical && h.trauma_level === 1) pts += 5;
        else if (needsCritical && h.trauma_level === 2) pts += 3;
        else if (!needsCritical && h.trauma_level >= 3) pts += 2;

        // Specialty match
        const specMatches = needed.filter((s) => h.specialty.includes(s)).length;
        pts += specMatches * 4;

        // Bed availability
        pts += Math.min(h.available_beds, 10);

        return { hospital: h, score: pts };
      })
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      return res.json({ primary: null, backup: null, message: "All hospitals at capacity" });
    }

    const primary = scored[0].hospital;
    const backup  = scored.length > 1 ? scored[1].hospital : null;
    const bedType = suggestBedType(triage_category, pathway_flags);

    return res.json({ primary, backup, suggested_bed_type: bedType });
  } catch (err) { return next(err); }
});

module.exports = router;
