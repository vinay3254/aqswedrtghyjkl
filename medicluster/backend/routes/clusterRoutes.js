/**
 * backend/routes/clusterRoutes.js
 * Routes for triggering clustering and fetching results.
 */

const express = require("express");
const axios = require("axios");
const Dataset = require("../models/Dataset");
const ClusterResult = require("../models/ClusterResult");

const router = express.Router();
const ML_ENGINE_URL = process.env.ML_ENGINE_URL || "http://localhost:8000";

// ── POST /api/cluster ──────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { datasetId, algorithm = "kmeans", params = {} } = req.body;

  if (!datasetId) return res.status(400).json({ error: "datasetId is required" });

  try {
    // Fetch dataset from MongoDB
    const dataset = await Dataset.findById(datasetId).lean();
    if (!dataset) return res.status(404).json({ error: "Dataset not found" });

    // Forward to Python ML engine
    const mlResponse = await axios.post(
      `${ML_ENGINE_URL}/cluster`,
      { data: dataset.rawData, algorithm, params },
      { timeout: 120_000 }  // 2-minute timeout for large datasets
    );

    const mlData = mlResponse.data;

    // Persist result to MongoDB
    const saved = await ClusterResult.create({
      datasetId,
      algorithm,
      params,
      patients: mlData.patients || [],
      metrics: mlData.metrics || {},
      riskDistribution: mlData.risk_distribution || {},
      clusterProfiles: mlData.cluster_profiles || [],
      featureNames: mlData.feature_names || [],
      linkageMatrix: mlData.linkage_matrix || null,
    });

    return res.status(201).json({
      resultId: saved._id,
      ...mlData,
    });
  } catch (err) {
    console.error("Cluster route error:", err.message);
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/cluster/:id ───────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const result = await ClusterResult.findById(req.params.id).lean();
    if (!result) return res.status(404).json({ error: "Result not found" });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/cluster/history/:datasetId ───────────────────────────────────
router.get("/history/:datasetId", async (req, res) => {
  try {
    const results = await ClusterResult.find(
      { datasetId: req.params.datasetId },
      { patients: 0, linkageMatrix: 0 }  // exclude heavy arrays
    )
      .sort({ createdAt: -1 })
      .lean();
    return res.json(results);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
