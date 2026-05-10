/**
 * backend/routes/reminderRoutes.js
 * CRUD for patient medication reminders.
 */

const express = require("express");
const mongoose = require("mongoose");
const Reminder = require("../models/Reminder");

const router = express.Router();

// ── GET /api/reminders/:patientId ─────────────────────────────────────────
router.get("/:patientId", async (req, res, next) => {
  try {
    const reminders = await Reminder.find({ patientId: req.params.patientId })
      .sort({ active: -1, createdAt: -1 })
      .lean();
    return res.json(reminders);
  } catch (err) {
    return next(err);
  }
});

// ── POST /api/reminders ───────────────────────────────────────────────────
router.post("/", async (req, res, next) => {
  const { patientId, medicationName, dosage, times, frequency, days, notes } = req.body;
  if (!patientId || !patientId.trim()) {
    return res.status(400).json({ error: "patientId is required" });
  }
  if (!medicationName || !medicationName.trim()) {
    return res.status(400).json({ error: "medicationName is required" });
  }
  if (!Array.isArray(times) || times.length === 0) {
    return res.status(400).json({ error: "At least one reminder time is required" });
  }
  try {
    const reminder = await Reminder.create({
      patientId: patientId.trim(),
      medicationName: medicationName.trim(),
      dosage: dosage?.trim() ?? "",
      times,
      frequency: frequency ?? "daily",
      days: days ?? [],
      notes: notes?.trim() ?? "",
    });
    return res.status(201).json(reminder);
  } catch (err) {
    return next(err);
  }
});

// ── PATCH /api/reminders/:id ──────────────────────────────────────────────
router.patch("/:id", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Invalid reminder id" });
  }
  try {
    const allowed = ["medicationName", "dosage", "times", "frequency", "days", "notes", "active"];
    const update = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowed.includes(k))
    );
    const updated = await Reminder.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: "Reminder not found" });
    return res.json(updated);
  } catch (err) {
    return next(err);
  }
});

// ── DELETE /api/reminders/:id ─────────────────────────────────────────────
router.delete("/:id", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ error: "Invalid reminder id" });
  }
  try {
    const deleted = await Reminder.findByIdAndDelete(req.params.id).lean();
    if (!deleted) return res.status(404).json({ error: "Reminder not found" });
    return res.json({ deleted: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
