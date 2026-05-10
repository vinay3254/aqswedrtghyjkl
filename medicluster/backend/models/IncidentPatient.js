/**
 * backend/models/IncidentPatient.js
 * A single patient record within a dispatch incident (MCI or single-casualty).
 */

const mongoose = require("mongoose");

const VitalsSchema = new mongoose.Schema(
  {
    respiratory_rate: Number,
    spo2:             Number,
    systolic_bp:      Number,
    diastolic_bp:     Number,
    heart_rate:       Number,
    temperature:      Number,
    avpu:             { type: String, enum: ["A", "V", "P", "U"], uppercase: true },
    gcs:              { type: Number, min: 3, max: 15 },
    injury_type:      String,
    injury_description: String,
    notes:            String,
    recorded_at:      { type: Date, default: Date.now },
  },
  { _id: false }
);

const IncidentPatientSchema = new mongoose.Schema(
  {
    incident_id:   { type: String, required: true, index: true }, // dispatch_id
    patient_tag:   { type: String, required: true, unique: true }, // PT-ARIA-xxx-001

    // Demographics (may be unknown)
    name:          { type: String, default: "Unknown" },
    age:           Number,
    gender:        { type: String, enum: ["M", "F", "Unknown"], default: "Unknown" },

    // Triage
    triage_category: { type: String, enum: ["RED", "YELLOW", "GREEN", "BLACK", "UNSET"], default: "UNSET" },
    triage_score:    { type: Number, default: 0 },
    triage_issues:   [String],  // human-readable reasons for score

    // Pathway flags (special routing rules)
    pathway_flags: {
      type: [String],
      enum: ["trauma", "stroke", "stemi", "cardiac", "pediatric", "burn", "psychiatric", "hazmat", "maternity", "infectious"],
      default: [],
    },

    // Latest vitals (append-only history)
    vitals:          { type: VitalsSchema, default: undefined },
    vitals_history:  { type: [VitalsSchema], default: [] },

    // Transport & allocation
    transport_status:       { type: String, enum: ["waiting", "loading", "en_route", "arrived", "handed_off"], default: "waiting" },
    assigned_ambulance_id:  { type: String, default: null },
    destination_hospital_id:   { type: String, default: null },
    destination_hospital_name: { type: String, default: null },
    bed_type:               { type: String, enum: ["ICU", "trauma", "general", "pediatric", "burn", "psychiatric", null], default: null },

    // Scene management
    sector:              { type: String, default: "A" },

    // AI-assisted notes
    voice_triage_notes:  { type: String, default: "" },
  },
  { timestamps: true }
);

IncidentPatientSchema.index({ incident_id: 1, triage_category: 1 });

module.exports = mongoose.model("IncidentPatient", IncidentPatientSchema);
