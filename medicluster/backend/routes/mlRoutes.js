/**
 * routes/mlRoutes.js
 * Proxy routes for all new ML / NLP endpoints.
 * Forwards requests to the Python ML engine at ML_ENGINE_URL (default :8000).
 */

const express = require("express");
const axios   = require("axios");

const router = express.Router();
const ML = process.env.ML_ENGINE_URL || "http://localhost:8000";
const TIMEOUT = 120_000;

const proxy = async (req, res, path, body) => {
  try {
    const r = await axios.post(`${ML}${path}`, body ?? req.body, { timeout: TIMEOUT });
    res.json(r.data);
  } catch (err) {
    const status = err.response?.status || 502;
    res.status(status).json({ error: err.response?.data?.error || err.message });
  }
};

// NLP
router.post("/analyze-notes",    (req, res) => proxy(req, res, "/analyze-notes"));
router.post("/drug-interactions",(req, res) => proxy(req, res, "/drug-interactions"));

// MEWS + Forecasting
router.post("/mews",             (req, res) => proxy(req, res, "/mews"));
router.post("/forecast-vitals",  (req, res) => proxy(req, res, "/forecast-vitals"));

// AutoML
router.post("/optimal-k",        (req, res) => proxy(req, res, "/optimal-k"));
router.post("/feature-importance",(req, res)=> proxy(req, res, "/feature-importance"));
router.post("/reduce-dimensions",(req, res) => proxy(req, res, "/reduce-dimensions"));

// Anomaly + SHAP
router.post("/detect-anomalies", (req, res) => proxy(req, res, "/detect-anomalies"));
router.post("/explain",          (req, res) => proxy(req, res, "/explain"));

// RAG Chatbot
router.post("/ask",              (req, res) => proxy(req, res, "/ask"));

module.exports = router;
