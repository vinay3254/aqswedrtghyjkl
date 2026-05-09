const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");
const { Readable } = require("stream");
const axios = require("axios");
const PatientMedia = require("../models/PatientMedia");

const ML_ENGINE_URL = process.env.ML_ENGINE_URL || "http://localhost:8000";

const router = express.Router();

const ALLOWED_MIMETYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMETYPES.has(file.mimetype)) {
      const err = new Error("Only images (JPEG/PNG/GIF/WebP) and documents (PDF/DOC/DOCX/TXT) are supported");
      err.status = 415;
      cb(err);
      return;
    }
    cb(null, true);
  },
});

function getBucket() {
  return new GridFSBucket(mongoose.connection.db, { bucketName: "patient_media" });
}

function getFileType(mimetype) {
  return mimetype.startsWith("image/") ? "image" : "document";
}

// POST /api/media/upload
router.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { patient_id } = req.body;
    if (!patient_id) return res.status(400).json({ error: "patient_id is required" });

    const bucket = getBucket();
    const readable = Readable.from(req.file.buffer);
    const uploadStream = bucket.openUploadStream(req.file.originalname, {
      contentType: req.file.mimetype,
    });

    await new Promise((resolve, reject) => {
      readable.pipe(uploadStream).on("error", reject).on("finish", resolve);
    });

    const media = await PatientMedia.create({
      patient_id,
      original_name: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      file_type: getFileType(req.file.mimetype),
      gridfs_id: uploadStream.id,
    });

    res.status(201).json(media);
  } catch (err) {
    next(err);
  }
});

// GET /api/media/file/:fileId  — stream file content (must be before /:patientId)
router.get("/file/:fileId", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.fileId))
      return res.status(400).json({ error: "Invalid file ID" });

    const media = await PatientMedia.findOne({
      gridfs_id: new mongoose.Types.ObjectId(req.params.fileId),
    });
    if (!media) return res.status(404).json({ error: "File not found" });

    res.set("Content-Type", media.mimetype);
    res.set("Content-Disposition", `inline; filename="${encodeURIComponent(media.original_name)}"`);
    if (media.size) res.set("Content-Length", media.size);

    const bucket = getBucket();
    const downloadStream = bucket.openDownloadStream(media.gridfs_id);
    downloadStream.on("error", () => res.status(404).end());
    downloadStream.pipe(res);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/media/file/:fileId
router.delete("/file/:fileId", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.fileId))
      return res.status(400).json({ error: "Invalid file ID" });

    const media = await PatientMedia.findOne({
      gridfs_id: new mongoose.Types.ObjectId(req.params.fileId),
    });
    if (!media) return res.status(404).json({ error: "File not found" });

    const bucket = getBucket();
    await bucket.delete(media.gridfs_id);
    await media.deleteOne();

    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/media/analyze/:fileId  — run DL analysis on an image (must be before /:patientId)
router.post("/analyze/:fileId", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.fileId))
      return res.status(400).json({ error: "Invalid file ID" });

    const media = await PatientMedia.findOne({
      gridfs_id: new mongoose.Types.ObjectId(req.params.fileId),
    });
    if (!media) return res.status(404).json({ error: "File not found" });
    if (media.file_type !== "image")
      return res.status(400).json({ error: "Only images can be analyzed" });

    // Stream file from GridFS into a buffer
    const bucket = getBucket();
    const chunks = [];
    const downloadStream = bucket.openDownloadStream(media.gridfs_id);
    await new Promise((resolve, reject) => {
      downloadStream.on("data", (chunk) => chunks.push(chunk));
      downloadStream.on("end", resolve);
      downloadStream.on("error", reject);
    });

    const imageB64 = Buffer.concat(chunks).toString("base64");

    // Send to ML engine
    const mlRes = await axios.post(
      `${ML_ENGINE_URL}/analyze-image`,
      { image_b64: imageB64 },
      { timeout: 120_000 }
    );

    const analysis = {
      findings: mlRes.data.findings,
      model: mlRes.data.model,
      analyzedAt: new Date(),
    };

    media.analysis = analysis;
    await media.save();

    res.json(analysis);
  } catch (err) {
    next(err);
  }
});

// GET /api/media/:patientId  — list all files for a patient
router.get("/:patientId", async (req, res, next) => {
  try {
    const files = await PatientMedia.find({ patient_id: req.params.patientId })
      .sort({ createdAt: -1 });
    res.json(files);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
