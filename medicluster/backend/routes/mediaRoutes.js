const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");
const { Readable } = require("stream");
const axios = require("axios");
const PatientMedia = require("../models/PatientMedia");
const {
  chatText,
  chatVision,
  messagesCreate,
  ollamaConfigured,
  OllamaUnavailableError,
} = require("../utils/ollamaClient");

const ML_ENGINE_URL = process.env.ML_ENGINE_URL || "http://localhost:8080";

const router = express.Router();

const ALLOWED_MIMETYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/dicom",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

const DICOM_EXTENSIONS = new Set([".dcm", ".dicom"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = "." + file.originalname.split(".").pop().toLowerCase();
    const isDicom = DICOM_EXTENSIONS.has(ext);
    if (!ALLOWED_MIMETYPES.has(file.mimetype) && !isDicom) {
      const err = new Error("Supported: images (JPEG/PNG/GIF/WebP), DICOM (.dcm), documents (PDF/DOC/DOCX/TXT)");
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

function getFileType(mimetype, originalname = "") {
  const ext = "." + originalname.split(".").pop().toLowerCase();
  if (mimetype.startsWith("image/") || DICOM_EXTENSIONS.has(ext)) return "image";
  return "document";
}

// GET /api/media/models — proxy model list from ML engine
router.get("/models", async (_req, res, next) => {
  try {
    const r = await axios.get(`${ML_ENGINE_URL}/models`, { timeout: 5000 });
    const mlModels = Array.isArray(r.data?.models) ? r.data.models : [];
    const mlDefault = r.data?.default;

    // Probe Ollama in the background for the vision model list. We don't await
    // it on the hot path because /models is loaded by the UI; the UI will fall
    // back to its own copy if this returns empty. We do, however, always include
    // the Ollama vision entry so the "claude-vision" picker still resolves to a
    // real backend handler.
    res.json({
      models: [
        ...mlModels,
        {
          id: "claude-vision",
          label: "Ollama Vision (LungLens · Claude-vision alias)",
          size: 224,
        },
      ],
      default: mlDefault || "densenet121-res224-all",
    });
  } catch {
    res.json({
      models: [
        { id: "densenet121-res224-all", label: "DenseNet121 · All datasets", size: 224 },
        { id: "claude-vision", label: "Ollama Vision (LungLens)", size: 224 },
      ],
      default: "densenet121-res224-all",
    });
  }
});

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
      file_type: getFileType(req.file.mimetype, req.file.originalname),
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

    const model_name = req.body.model_name || "densenet121-res224-all";

    let analysis;

    if (model_name === "claude-vision") {
      // ── Ollama vision analysis (was: Claude Vision) ─────────────────────────
      if (!ollamaConfigured()) return res.status(500).json({ error: "Ollama is not configured. Set OLLAMA_URL and (for cloud) OLLAMA_API_KEY." });

      const SUPPORTED = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
      const mediaType = SUPPORTED.has(media.mimetype) ? media.mimetype : "image/jpeg";

      const prompt = `You are a medical imaging AI. Analyze this medical image and return a JSON object with this exact structure — no extra text, no markdown fences, only the raw JSON:

{
  "findings": [
    {
      "label": "<condition name>",
      "confidence": <0.0–1.0 float>,
      "severity": "<high|moderate|low>",
      "cause": "<one sentence cause>",
      "medications": ["<med1>", "<med2>"],
      "prevention": ["<step1>", "<step2>"]
    }
  ],
  "scan_warning": "<string if image does not look like a medical scan, else null>"
}

Rules:
- List every visible pathology or finding with confidence >= 0.15.
- confidence must be a float between 0 and 1 (e.g. 0.87 means 87%).
- severity must be exactly one of: high, moderate, low.
- Include at least 2 medications and 2 prevention steps per finding.
- If no abnormality is found, return an empty findings array.
- Return ONLY the raw JSON object. No explanation text outside the JSON.`;

      let parsed;
      try {
        const { reply } = await chatVision({
          prompt,
          imageB64,
          mediaType,
          maxTokens: 1500,
        });
        const raw = reply.trim();
        const jsonText = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
        parsed = JSON.parse(jsonText);
      } catch (err) {
        if (err instanceof OllamaUnavailableError) {
          return res.status(502).json({ error: "Ollama vision unavailable — please retry" });
        }
        return res.status(502).json({ error: "Ollama returned malformed JSON — please retry" });
      }

      analysis = {
        findings:     Array.isArray(parsed.findings) ? parsed.findings : [],
        model:        "ollama-vision",
        model_label:  "LungLens",
        scan_warning: parsed.scan_warning || null,
        analyzedAt:   new Date(),
      };
    } else {
      // ── ML engine (DenseNet / ResNet) analysis ─────────────────────────────
      const mlRes = await axios.post(
        `${ML_ENGINE_URL}/analyze-image`,
        { image_b64: imageB64, model_name, filename: media.original_name },
        { timeout: 120_000 }
      );

      analysis = {
        findings:     mlRes.data.findings,
        model:        mlRes.data.model,
        model_label:  mlRes.data.model_label,
        scan_warning: mlRes.data.scan_warning || null,
        analyzedAt:   new Date(),
      };
    }

    media.analysis = analysis;
    await media.save();

    res.json(analysis);
  } catch (err) {
    next(err);
  }
});

// POST /api/media/explain/:fileId  — clinical explanation via Ollama (primary)
// with NVIDIA NIM kept as a secondary fallback for users who still have a key.
router.post("/explain/:fileId", async (req, res) => {
  const { findings, model_name } = req.body;

  if (!Array.isArray(findings) || findings.length === 0) {
    return res.status(400).json({ error: "findings array is required" });
  }

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

  // 1. Ollama (primary) — local daemon or cloud, authenticated with OLLAMA_API_KEY
  try {
    const { reply, model } = await chatText(prompt, { maxTokens: 500 });
    if (reply) {
      return res.json({ explanation: reply, model });
    }
  } catch (err) {
    console.error("Ollama explanation failed, trying NVIDIA NIM...", err.message);
  }

  // 2. NVIDIA NIM fallback (only if user still has a key)
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (nvidiaKey && nvidiaKey.startsWith("nvapi-")) {
    try {
      console.log("Using NVIDIA NIM for clinical explanation...");
      const response = await axios.post(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          model: "writer/palmyra-med-70b",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500,
          temperature: 0.2
        },
        {
          headers: {
            Authorization: `Bearer ${nvidiaKey}`,
            "Content-Type": "application/json"
          },
          timeout: 25000
        }
      );
      const explanation = response.data?.choices?.[0]?.message?.content;
      if (explanation) {
        return res.json({ explanation });
      }
    } catch (err) {
      console.error("NVIDIA NIM explanation failed:", err.message);
    }
  }

  // Heuristic clinical explanation fallback
  const fallbackExplanation = `### Findings Analysis Summary\n\nThe medical scan analysis has identified: ${findingsList}.\n\n` +
    `**Clinical Overview**: These conditions warrant close monitoring. For instance, pulmonary and vascular changes are frequently correlated with systemic cardiovascular or respiratory stress. It is crucial to have these findings interpreted directly by a radiologist or physician in conjunction with the patient's full medical history.\n\n` +
    `**Standard Care Guidelines**: General medical response incorporates lifestyle modifications, routine physical assessments, and therapeutic interventions tailored to the specific grade of the findings.\n\n` +
    `*⚠️ Educational information only. Clinical correlation by a qualified specialist is required.*`;
  return res.json({ explanation: fallbackExplanation });
});

const LANGUAGE_NAMES = {
  en: "English",
  hi: "Hindi",
  kn: "Kannada",
  te: "Telugu",
  ta: "Tamil",
};

// POST /api/media/ai-chat  — Ollama vision chat (direct base64, no GridFS)
router.post("/ai-chat", async (req, res, next) => {
  try {
    const { imageBase64, mediaType, chatHistory = [], question = "", language = "en" } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "imageBase64 is required" });

    const SUPPORTED = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
    const type = SUPPORTED.has(mediaType) ? mediaType : "image/jpeg";

    const langName = LANGUAGE_NAMES[language] || "English";
    const langInstruction = language === "en"
      ? ""
      : `\nIMPORTANT: You MUST respond entirely in ${langName}. All section headings, explanations, and the disclaimer must be written in ${langName} script.`;

    const systemPrompt = `You are a medical AI assistant helping analyze medical images.
When first analyzing an image, structure your response with these clear sections:
|**Condition Name**: The medical condition or finding visible
|**What It Is**: A brief plain-English explanation
|**Prevention**: Steps to prevent this condition
|**Treatment / Cure**: How this condition is typically treated
|**Medications**: Common medications used for this condition

For follow-up questions, respond conversationally.
Always end with: "⚠️ Educational purposes only — consult a qualified physician for diagnosis and treatment."${langInstruction}`;

    // Optional NVIDIA NIM fallback for users who still have a key configured.
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    if (nvidiaKey && nvidiaKey.startsWith("nvapi-")) {
      try {
        console.log("Using NVIDIA NIM Vision API for image analysis...");
        const payload = {
          model: "google/gemma-4-31b-it",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: `${systemPrompt}\n\nUser Question: ${question.trim() || "Please analyze this medical image. Tell me what condition is visible, how to prevent it, how to treat it, and what medications are commonly used."}` },
                { type: "image_url", image_url: { url: `data:${type};base64,${imageBase64}` } }
              ]
            }
          ],
          max_tokens: 1024,
          temperature: 0.2
        };
        const response = await axios.post(
          "https://integrate.api.nvidia.com/v1/chat/completions",
          payload,
          { headers: { Authorization: `Bearer ${nvidiaKey}`, "Content-Type": "application/json" }, timeout: 90000 }
        );
        const reply = response.data?.choices?.[0]?.message?.content;
        if (reply) {
          console.log("Successfully generated analysis using NVIDIA NIM!");
          return res.json({ reply: reply.trim() });
        }
      } catch (nvidiaErr) {
        console.error("NVIDIA NIM API call failed:", nvidiaErr.message || (nvidiaErr.response && nvidiaErr.response.data));
      }
    }

    // Primary path: Ollama (local or cloud, OLLAMA_API_KEY auth if configured).
    const firstUserText = chatHistory.length === 0
      ? (question.trim() || "Please analyze this medical image. Tell me what condition is visible, how to prevent it, how to treat it, and what medications are commonly used.")
      : chatHistory[0].content;

    try {
      const { reply, model } = await chatVision({
        prompt: `${systemPrompt}\n\nUser Question: ${firstUserText}`,
        system: systemPrompt,
        imageB64: imageBase64,
        mediaType: type,
        maxTokens: 1024,
      });
      return res.json({ reply: reply.trim() });
    } catch (err) {
      if (err instanceof OllamaUnavailableError) {
        console.error("Ollama vision chat unavailable:", err.message);
        return res.status(502).json({
          error: "Ollama vision chat unavailable — verify OLLAMA_URL is reachable and OLLAMA_API_KEY (if any) is valid.",
        });
      }
      return next(err);
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/media/ai-assistant/:fileId  — Ollama vision AI assistant (chat)
router.post("/ai-assistant/:fileId", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.fileId))
      return res.status(400).json({ error: "Invalid file ID" });

    const media = await PatientMedia.findOne({
      gridfs_id: new mongoose.Types.ObjectId(req.params.fileId),
    });
    if (!media) return res.status(404).json({ error: "File not found" });
    if (media.file_type !== "image")
      return res.status(400).json({ error: "Only images can be analyzed" });

    const SUPPORTED = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
    const mediaType = SUPPORTED.has(media.mimetype) ? media.mimetype : "image/jpeg";

    const bucket = getBucket();
    const chunks = [];
    const downloadStream = bucket.openDownloadStream(media.gridfs_id);
    await new Promise((resolve, reject) => {
      downloadStream.on("data", (chunk) => chunks.push(chunk));
      downloadStream.on("end", resolve);
      downloadStream.on("error", reject);
    });
    const imageB64 = Buffer.concat(chunks).toString("base64");

    const { chatHistory = [], question = "" } = req.body;

    const systemPrompt = `You are a medical AI assistant helping analyze medical images.
When first analyzing an image, structure your response with these clear sections:
|**Condition Name**: The medical condition or finding visible
|**What It Is**: A brief plain-English explanation
|**Prevention**: Steps to prevent this condition
|**Treatment / Cure**: How this condition is typically treated
|**Medications**: Common medications used for this condition

For follow-up questions, respond conversationally.
Always end with: "⚠️ Educational purposes only — consult a qualified physician for diagnosis and treatment."`;

    const firstUserText = chatHistory.length === 0
      ? "Please analyze this medical image. Tell me what condition is visible, how to prevent it, how to treat it, and what medications are commonly used."
      : chatHistory[0].content;

    // Optional NVIDIA NIM fallback for users who still have a key configured.
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    if (nvidiaKey && nvidiaKey.startsWith("nvapi-")) {
      try {
        console.log("Using NVIDIA NIM Vision API for image assistant...");
        const response = await axios.post(
          "https://integrate.api.nvidia.com/v1/chat/completions",
          {
            model: "google/gemma-4-31b-it",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: `${systemPrompt}\n\nUser Question: ${question.trim() || firstUserText}` },
                  { type: "image_url", image_url: { url: `data:${mediaType};base64,${imageB64}` } }
                ]
              }
            ],
            max_tokens: 1024,
            temperature: 0.2
          },
          { headers: { Authorization: `Bearer ${nvidiaKey}`, "Content-Type": "application/json" }, timeout: 90000 }
        );
        const reply = response.data?.choices?.[0]?.message?.content;
        if (reply) {
          console.log("Successfully generated assistant response using NVIDIA NIM!");
          return res.json({ reply: reply.trim() });
        }
      } catch (nvidiaErr) {
        console.error("NVIDIA NIM assistant failed:", nvidiaErr.message || (nvidiaErr.response && nvidiaErr.response.data));
      }
    }

    // Primary path: Ollama (local or cloud, OLLAMA_API_KEY auth if configured).
    try {
      const { reply, model } = await chatVision({
        prompt: `${systemPrompt}\n\nUser Question: ${question.trim() || firstUserText}`,
        system: systemPrompt,
        imageB64,
        mediaType,
        maxTokens: 1024,
      });
      return res.json({ reply: reply.trim() });
    } catch (err) {
      if (err instanceof OllamaUnavailableError) {
        console.error("Ollama assistant unavailable:", err.message);
        return res.status(502).json({
          error: "Ollama assistant unavailable — verify OLLAMA_URL is reachable and OLLAMA_API_KEY (if any) is valid.",
        });
      }
      return next(err);
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/media/gradcam/:fileId  — Grad-CAM heatmap for a stored image
router.post("/gradcam/:fileId", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.fileId))
      return res.status(400).json({ error: "Invalid file ID" });

    const media = await PatientMedia.findOne({ gridfs_id: new mongoose.Types.ObjectId(req.params.fileId) });
    if (!media) return res.status(404).json({ error: "File not found" });

    const bucket = getBucket();
    const chunks = [];
    const dl = bucket.openDownloadStream(media.gridfs_id);
    await new Promise((resolve, reject) => {
      dl.on("data", (c) => chunks.push(c));
      dl.on("end", resolve);
      dl.on("error", reject);
    });

    const imageB64 = Buffer.concat(chunks).toString("base64");
    const { model_name = "densenet121-res224-chex", target_label } = req.body;

    const r = await axios.post(
      `${ML_ENGINE_URL}/gradcam`,
      { image_b64: imageB64, model_name, target_label, filename: media.original_name },
      { timeout: 60_000 }
    );
    res.json(r.data);
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
