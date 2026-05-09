/**
 * backend/routes/clusterRoutes.js
 * Routes for triggering clustering and fetching results.
 */

const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const Dataset = require("../models/Dataset");
const ClusterResult = require("../models/ClusterResult");
const {
  denormalizePatientRows,
  normalizeResultPatients,
  normalizeClusterProfiles,
  denormalizeClusterProfiles,
} = require("../utils/rowSerializer");

const router = express.Router();
const ML_ENGINE_URL = process.env.ML_ENGINE_URL || "http://localhost:8000";
const SAMPLE_DATASET_ID = "__sample__";

function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function normalizeParamsForStorage(params = {}) {
  const { init, ...rest } = params;
  return {
    ...rest,
    kmeans_init: init ?? params.kmeans_init,
  };
}

function formatClusterResult(result) {
  if (!result) return result;

  return {
    ...result,
    patients: denormalizePatientRows(result.patients || []),
    clusterProfiles: denormalizeClusterProfiles(result.clusterProfiles || []),
  };
}

// ── POST /api/cluster ──────────────────────────────────────────────────────
router.post("/", async (req, res, next) => {
  const { datasetId, algorithm = "kmeans", params = {}, data } = req.body;

  if (!datasetId) return res.status(400).json({ error: "datasetId is required" });
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return res.status(400).json({ error: "params must be an object" });
  }
  if (datasetId !== SAMPLE_DATASET_ID && !mongoose.isValidObjectId(datasetId)) {
    return res.status(400).json({ error: "Invalid datasetId" });
  }

  try {
    let patientRows;

    if (datasetId === SAMPLE_DATASET_ID) {
      if (!Array.isArray(data) || data.length === 0) {
        throw badRequest("Sample dataset requests must include inline patient data");
      }
      patientRows = data;
    } else {
      // Fetch dataset from MongoDB
      const dataset = await Dataset.findById(datasetId).lean();
      if (!dataset) return res.status(404).json({ error: "Dataset not found" });
      patientRows = denormalizePatientRows(dataset.rawData || []);
    }

    // Forward to Python ML engine
    const mlResponse = await axios.post(
      `${ML_ENGINE_URL}/cluster`,
      { data: patientRows, algorithm, params },
      { timeout: 120_000 }  // 2-minute timeout for large datasets
    );

    const mlData = mlResponse.data;

    if (datasetId === SAMPLE_DATASET_ID) {
      return res.status(200).json({
        resultId: null,
        datasetId: SAMPLE_DATASET_ID,
        ...mlData,
      });
    }

    // Persist result to MongoDB
    const saved = await ClusterResult.create({
      datasetId,
      algorithm,
      params: normalizeParamsForStorage(params),
      patients: normalizeResultPatients(mlData.patients || []),
      metrics: mlData.metrics || {},
      riskDistribution: mlData.risk_distribution || {},
      clusterProfiles: normalizeClusterProfiles(mlData.cluster_profiles || []),
      featureNames: mlData.feature_names || [],
      linkageMatrix: mlData.linkage_matrix || undefined,
      preprocessing: mlData.preprocessing,
      warnings: mlData.warnings || [],
    });

    return res.status(201).json({
      resultId: saved._id,
      ...mlData,
    });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    return next(err);
  }
});

// ── GET /api/cluster/history/:datasetId ───────────────────────────────────
router.get("/history/:datasetId", async (req, res, next) => {
  try {
    if (req.params.datasetId === SAMPLE_DATASET_ID) return res.json([]);
    if (!mongoose.isValidObjectId(req.params.datasetId)) {
      return res.status(400).json({ error: "Invalid datasetId" });
    }

    const results = await ClusterResult.find(
      { datasetId: req.params.datasetId },
      { patients: 0, linkageMatrix: 0 }  // exclude heavy arrays
    )
      .sort({ createdAt: -1 })
      .lean();
    return res.json(results);
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/cluster/:id ───────────────────────────────────────────────────
router.get("/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid result id" });
    }

    const result = await ClusterResult.findById(req.params.id).lean();
    if (!result) return res.status(404).json({ error: "Result not found" });
    return res.json(formatClusterResult(result));
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
