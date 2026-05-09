/**
 * backend/routes/dataRoutes.js
 * Routes for dataset upload and retrieval.
 */

const express = require("express");
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const Dataset = require("../models/Dataset");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── POST /api/data/upload ──────────────────────────────────────────────────
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const csvText = req.file.buffer.toString("utf8");

    // Parse CSV
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      cast: (value, context) => {
        if (context.header) return value;
        const num = Number(value);
        return isNaN(num) ? value : num;
      },
    });

    if (!records.length) return res.status(400).json({ error: "CSV is empty" });

    const featureNames = Object.keys(records[0]);
    const name = req.file.originalname.replace(/\.csv$/i, "");

    const dataset = await Dataset.create({
      name,
      rowCount: records.length,
      featureNames,
      rawData: records,
    });

    // Preview: first 5 rows
    const preview = records.slice(0, 5);

    return res.status(201).json({
      datasetId: dataset._id,
      name: dataset.name,
      rowCount: dataset.rowCount,
      featureNames,
      preview,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/data/:id ─────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const dataset = await Dataset.findById(req.params.id).lean();
    if (!dataset) return res.status(404).json({ error: "Dataset not found" });
    return res.json(dataset);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/data ─────────────────────────────────────────────────────────
router.get("/", async (_req, res) => {
  try {
    const datasets = await Dataset.find({}, { rawData: 0 })
      .sort({ createdAt: -1 })
      .lean();
    return res.json(datasets);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
