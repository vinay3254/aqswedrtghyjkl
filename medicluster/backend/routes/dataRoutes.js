/**
 * backend/routes/dataRoutes.js
 * Routes for dataset upload and retrieval.
 */

const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const Dataset = require("../models/Dataset");
const {
  normalizePatientRows,
  denormalizePatientRows,
} = require("../utils/rowSerializer");

const router = express.Router();
const CSV_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "text/plain",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const hasCsvExtension = /\.csv$/i.test(file.originalname || "");
    const hasCsvMimeType = CSV_MIME_TYPES.has(file.mimetype);

    if (!hasCsvExtension || !hasCsvMimeType) {
      const error = new Error("Only CSV files are supported");
      error.status = 415;
      cb(error);
      return;
    }

    cb(null, true);
  },
});

// ── POST /api/data/upload ──────────────────────────────────────────────────
router.post("/upload", upload.single("file"), async (req, res, next) => {
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
      rawData: normalizePatientRows(records),
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
    if (err.code) err.status = 400;
    return next(err);
  }
});

// ── GET /api/data/:id ─────────────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid dataset id" });
    }

    const dataset = await Dataset.findById(req.params.id).lean();
    if (!dataset) return res.status(404).json({ error: "Dataset not found" });
    return res.json({
      ...dataset,
      rawData: denormalizePatientRows(dataset.rawData || []),
    });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/data ─────────────────────────────────────────────────────────
router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const [datasets, total] = await Promise.all([
      Dataset.find({}, { rawData: 0 })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Dataset.countDocuments({}),
    ]);

    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return res.json({
      data: datasets,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
