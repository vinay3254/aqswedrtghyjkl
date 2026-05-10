/**
 * backend/models/Reminder.js
 * Medication reminder schedule for a patient.
 */

const mongoose = require("mongoose");

const ReminderSchema = new mongoose.Schema(
  {
    patientId:      { type: String, required: true, index: true },
    medicationName: { type: String, required: true },
    dosage:         { type: String, default: "" },
    times:          { type: [String], default: [] },  // e.g. ["08:00", "14:00", "20:00"]
    frequency:      { type: String, default: "daily" }, // daily | weekly | as-needed
    days:           { type: [String], default: [] },    // for weekly: ["Mon","Wed","Fri"]
    notes:          { type: String, default: "" },
    active:         { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Reminder", ReminderSchema);
