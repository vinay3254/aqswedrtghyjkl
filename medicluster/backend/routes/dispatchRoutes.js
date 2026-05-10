/**
 * backend/routes/dispatchRoutes.js
 * ARIA ambulance dispatch system — CRUD for ambulances/hospitals + AI dispatch.
 */

const express   = require("express");
const mongoose  = require("mongoose");
const Ambulance = require("../models/Ambulance");
const Hospital  = require("../models/Hospital");
const Dispatch  = require("../models/Dispatch");

const router = express.Router();

const ARIA_SYSTEM_PROMPT = `You are ARIA (Automated Response & Intelligence Agent), an AI-powered ambulance dispatch system for emergency medical services. You operate in real-time, making critical life-or-death decisions with speed, accuracy, and compassion.

## CORE IDENTITY
You are the central intelligence of an emergency dispatch system. Your decisions directly affect human lives. You must always be:
- Fast: Respond and act within seconds
- Accurate: Never hallucinate hospital capacity, ambulance location, or ETA — use ONLY the data provided
- Calm: Maintain professional tone even in chaotic inputs
- Decisive: Always recommend an action — never leave a dispatch unresolved

## YOUR RESPONSIBILITIES

### 1. TRIAGE & SEVERITY ASSESSMENT
- Analyze the emergency details and classify severity: CRITICAL / HIGH / MEDIUM / LOW
- Map reported condition to required ambulance type:
  - BLS (Basic Life Support): minor injuries, non-life-threatening
  - ALS (Advanced Life Support): cardiac, stroke, trauma
  - ICU Mobile: multi-organ failure, major trauma, burns >40%

### 2. AMBULANCE DISPATCH
- Select the optimal ambulance from the provided list based on:
  1. Proximity to caller (minimize response time — estimate from lat/lng)
  2. Ambulance type match for the condition
  3. Only select ambulances with status "available"
- Output the dispatch decision with assigned ambulance ID and estimated ETA

### 3. HOSPITAL ALLOCATION
- Pre-allocate the best hospital from the provided list BEFORE ambulance arrives
- Selection criteria (in priority order):
  1. Trauma level match
  2. Specialty match (cardiac center for MI, neuro for stroke, etc.)
  3. Available beds > 0
  4. Distance from incident scene

### 4. DECISION RULES
- NEVER dispatch a BLS unit to a cardiac arrest or major trauma
- NEVER send a patient to a hospital with 0 available beds
- ALWAYS provide a primary + backup hospital
- If no ICU ambulance is available and patient is CRITICAL, dispatch ALS + flag for air ambulance
- If two ambulances are equidistant, prefer the higher-capability unit
- State assumptions made for any missing data

## OUTPUT FORMAT
Respond ONLY with this exact JSON structure (no markdown, no extra text):

{
  "dispatch_id": "use the dispatch_id provided in the input",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW",
  "ambulance_type_required": "BLS | ALS | ICU",
  "dispatched_ambulance": {
    "id": "AMB-ID from the provided list",
    "eta_minutes": <number>,
    "route_summary": "brief route description"
  },
  "hospital_allocation": {
    "primary": {
      "id": "HOSP-ID from the provided list",
      "name": "Hospital name",
      "eta_from_scene_minutes": <number>,
      "reason": "why this hospital was chosen"
    },
    "backup": {
      "id": "HOSP-ID from the provided list",
      "name": "Hospital name",
      "eta_from_scene_minutes": <number>,
      "reason": "why this hospital was chosen"
    }
  },
  "alerts": ["alert 1", "alert 2"],
  "pre_alert_paramedic": "Concise clinical message to paramedic crew",
  "pre_alert_hospital": "Professional pre-alert message to receiving ER",
  "dispatcher_notes": "Plain English summary for human dispatcher review"
}`;

// ── Seed demo data ────────────────────────────────────────────────────────────
router.post("/seed", async (req, res, next) => {
  try {
    const ambCount  = await Ambulance.countDocuments();
    const hospCount = await Hospital.countDocuments();

    if (ambCount === 0) {
      await Ambulance.insertMany([
        { ambulanceId: "AMB-001", name: "Alpha 1", type: "ALS", status: "available", location: { lat: 12.9352, lng: 77.6244, description: "Koramangala, Bangalore" }, crew: "Dr. Ravi + 2 paramedics" },
        { ambulanceId: "AMB-002", name: "Bravo 2", type: "BLS", status: "available", location: { lat: 12.9698, lng: 77.7500, description: "Whitefield, Bangalore" }, crew: "2 paramedics" },
        { ambulanceId: "AMB-003", name: "Charlie 3", type: "ICU", status: "en_route", location: { lat: 12.9308, lng: 77.5838, description: "Jayanagar, Bangalore" }, crew: "Dr. Priya + 3 paramedics" },
        { ambulanceId: "AMB-004", name: "Delta 4",  type: "ALS", status: "available", location: { lat: 12.9591, lng: 77.6974, description: "Marathahalli, Bangalore" }, crew: "Dr. Kumar + 2 paramedics" },
        { ambulanceId: "AMB-005", name: "Echo 5",   type: "BLS", status: "at_scene",  location: { lat: 13.0358, lng: 77.5970, description: "Hebbal, Bangalore" }, crew: "2 paramedics" },
        { ambulanceId: "AMB-006", name: "Foxtrot 6", type: "ICU", status: "available", location: { lat: 12.9719, lng: 77.5937, description: "Indiranagar, Bangalore" }, crew: "Dr. Anita + 3 paramedics" },
      ]);
    }

    if (hospCount === 0) {
      await Hospital.insertMany([
        { hospitalId: "HOSP-001", name: "Victoria Hospital", trauma_level: 1, specialty: ["Trauma", "Cardiac", "Neuro", "Burns"], available_beds: 8, location: { lat: 12.9659, lng: 77.5716, description: "Majestic, Bangalore" }, phone: "080-2670-1150" },
        { hospitalId: "HOSP-002", name: "St. John's Medical College Hospital", trauma_level: 1, specialty: ["Trauma", "Cardiac", "Ortho"], available_beds: 5, location: { lat: 12.9250, lng: 77.6177, description: "Koramangala, Bangalore" }, phone: "080-2206-5000" },
        { hospitalId: "HOSP-003", name: "Manipal Hospital Whitefield", trauma_level: 2, specialty: ["Cardiac", "Ortho", "Neuro"], available_beds: 12, location: { lat: 12.9698, lng: 77.7500, description: "Whitefield, Bangalore" }, phone: "080-4031-0100" },
        { hospitalId: "HOSP-004", name: "Fortis Hospital Bannerghatta", trauma_level: 2, specialty: ["Cardiac", "Burns", "Ortho"], available_beds: 3, location: { lat: 12.8744, lng: 77.5971, description: "Bannerghatta, Bangalore" }, phone: "080-6621-4444" },
        { hospitalId: "HOSP-005", name: "Apollo Hospital Bannerghatta", trauma_level: 2, specialty: ["Cardiac", "Neuro", "Pediatric"], available_beds: 7, location: { lat: 12.8850, lng: 77.5989, description: "Bannerghatta Road, Bangalore" }, phone: "080-2630-4050" },
        { hospitalId: "HOSP-006", name: "Narayana Health City", trauma_level: 1, specialty: ["Cardiac", "Burns", "Trauma", "Pediatric"], available_beds: 15, location: { lat: 12.8994, lng: 77.6101, description: "Bommasandra, Bangalore" }, phone: "080-7122-2222" },
      ]);
    }

    return res.json({ message: "Seed data loaded", ambulances: await Ambulance.countDocuments(), hospitals: await Hospital.countDocuments() });
  } catch (err) {
    return next(err);
  }
});

// ── Ambulance CRUD ────────────────────────────────────────────────────────────

router.get("/ambulances", async (req, res, next) => {
  try {
    const ambulances = await Ambulance.find().sort({ ambulanceId: 1 }).lean();
    return res.json(ambulances);
  } catch (err) { return next(err); }
});

router.patch("/ambulances/:ambulanceId", async (req, res, next) => {
  try {
    const allowed = ["status", "location", "crew"];
    const update = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const updated = await Ambulance.findOneAndUpdate(
      { ambulanceId: req.params.ambulanceId },
      update,
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Ambulance not found" });
    return res.json(updated);
  } catch (err) { return next(err); }
});

// ── Hospital CRUD ─────────────────────────────────────────────────────────────

router.get("/hospitals", async (req, res, next) => {
  try {
    const hospitals = await Hospital.find().sort({ trauma_level: 1, hospitalId: 1 }).lean();
    return res.json(hospitals);
  } catch (err) { return next(err); }
});

router.patch("/hospitals/:hospitalId", async (req, res, next) => {
  try {
    const allowed = ["available_beds", "specialty", "phone"];
    const update = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    const updated = await Hospital.findOneAndUpdate(
      { hospitalId: req.params.hospitalId },
      update,
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Hospital not found" });
    return res.json(updated);
  } catch (err) { return next(err); }
});

// ── Dispatch history ──────────────────────────────────────────────────────────

router.get("/history", async (req, res, next) => {
  try {
    const dispatches = await Dispatch.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return res.json(dispatches);
  } catch (err) { return next(err); }
});

router.patch("/history/:dispatchId/status", async (req, res, next) => {
  const { status } = req.body;
  if (!["active", "resolved", "cancelled"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  try {
    const updated = await Dispatch.findOneAndUpdate(
      { dispatch_id: req.params.dispatchId },
      { status },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Dispatch not found" });
    return res.json(updated);
  } catch (err) { return next(err); }
});

// ── ARIA emergency dispatch ───────────────────────────────────────────────────

router.post("/emergency", async (req, res, next) => {
  const { caller_location, reported_condition, severity_score, casualties = 1 } = req.body;

  if (!caller_location || !reported_condition) {
    return res.status(400).json({ error: "caller_location and reported_condition are required" });
  }
  if (!severity_score || severity_score < 1 || severity_score > 10) {
    return res.status(400).json({ error: "severity_score must be between 1 and 10" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-ant-placeholder")) {
    return res.status(503).json({ error: "ARIA unavailable — ANTHROPIC_API_KEY not configured" });
  }

  try {
    const [ambulances, hospitals] = await Promise.all([
      Ambulance.find().lean(),
      Hospital.find().lean(),
    ]);

    const dispatch_id = `ARIA-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    const contextPayload = {
      dispatch_id,
      ambulances: ambulances.map((a) => ({
        id: a.ambulanceId,
        name: a.name,
        type: a.type,
        status: a.status,
        location: a.location,
        crew: a.crew,
      })),
      hospitals: hospitals.map((h) => ({
        id: h.hospitalId,
        name: h.name,
        trauma_level: h.trauma_level,
        specialty: h.specialty,
        available_beds: h.available_beds,
        location: h.location,
        phone: h.phone,
      })),
      emergency: {
        caller_location,
        reported_condition,
        severity_score: Number(severity_score),
        casualties: Number(casualties),
        timestamp: new Date().toISOString(),
      },
    };

    const Anthropic = require("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: ARIA_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Process this emergency dispatch request:\n\n${JSON.stringify(contextPayload, null, 2)}`,
        },
      ],
    });

    let ariaResponse;
    const raw = message.content?.[0]?.text ?? "";
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      ariaResponse = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch {
      return res.status(502).json({ error: "ARIA returned malformed response", raw });
    }

    // Persist dispatch to MongoDB
    const saved = await Dispatch.create({
      dispatch_id,
      emergency: { caller_location, reported_condition, severity_score: Number(severity_score), casualties: Number(casualties) },
      aria_response: ariaResponse,
      dispatched_ambulance_id: ariaResponse.dispatched_ambulance?.id ?? null,
      primary_hospital_id: ariaResponse.hospital_allocation?.primary?.id ?? null,
    });

    // Mark dispatched ambulance as en_route
    const ambId = ariaResponse.dispatched_ambulance?.id;
    if (ambId) {
      await Ambulance.findOneAndUpdate({ ambulanceId: ambId }, { status: "en_route" });
    }

    return res.status(201).json({ dispatch_id, aria_response: ariaResponse, saved_id: saved._id });
  } catch (err) {
    if (err.response) return res.status(err.response.status).json(err.response.data);
    return next(err);
  }
});

module.exports = router;
