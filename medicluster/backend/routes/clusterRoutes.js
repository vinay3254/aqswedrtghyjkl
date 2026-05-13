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

// ── POST /api/cluster/predict ──────────────────────────────────────────────
router.post("/predict", async (req, res, next) => {
  const { resultId, vitals } = req.body;

  if (!resultId || !mongoose.isValidObjectId(resultId)) {
    return res.status(400).json({ error: "resultId must be a valid MongoDB ObjectId" });
  }
  if (!vitals || typeof vitals !== "object" || Array.isArray(vitals)) {
    return res.status(400).json({ error: "vitals must be a non-empty object" });
  }

  try {
    const result = await ClusterResult.findById(resultId).lean();
    if (!result) return res.status(404).json({ error: "ClusterResult not found" });

    const profiles = denormalizeClusterProfiles(result.clusterProfiles || []);

    if (profiles.length === 0) {
      return res.status(400).json({ error: "This result has no cluster profiles to compare against" });
    }

    const distances = profiles.map((profile) => {
      const centroid = profile.centroid_features || {};
      const sharedFeatures = Object.keys(centroid).filter(
        (f) => vitals[f] !== undefined && vitals[f] !== null && !isNaN(Number(vitals[f]))
      );
      if (sharedFeatures.length === 0) {
        return { cluster_id: profile.cluster_id, risk_tier: profile.risk_tier, distance: Infinity, sharedCount: 0 };
      }
      const sumSq = sharedFeatures.reduce((acc, f) => {
        const diff = Number(vitals[f]) - Number(centroid[f]);
        return acc + diff * diff;
      }, 0);
      return {
        cluster_id: profile.cluster_id,
        risk_tier: profile.risk_tier,
        distance: Math.sqrt(sumSq),
        sharedCount: sharedFeatures.length,
      };
    });

    distances.sort((a, b) => a.distance - b.distance);
    const nearest = distances[0];
    const nearestProfile = profiles.find((p) => p.cluster_id === nearest.cluster_id);
    const centroid = nearestProfile?.centroid_features || {};

    const deviationFeatures = Object.keys(centroid).filter(
      (f) => vitals[f] !== undefined && !isNaN(Number(vitals[f]))
    );
    const featureDeviations = deviationFeatures
      .map((f) => ({
        feature: f,
        patient_value: Number(vitals[f]),
        centroid_value: Number(centroid[f]),
        deviation: Number(vitals[f]) - Number(centroid[f]),
      }))
      .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation))
      .slice(0, 5);

    const finiteDists = distances.filter((d) => isFinite(d.distance));
    const totalDist = finiteDists.reduce((a, d) => a + d.distance, 0);
    const confidence = totalDist > 0 ? 1 - nearest.distance / totalDist : 1;

    return res.json({
      risk_tier: nearest.risk_tier,
      cluster_id: nearest.cluster_id,
      confidence: Math.max(0, Math.min(1, confidence)),
      cluster_profile: {
        size: nearestProfile?.size ?? 0,
        centroid_features: centroid,
      },
      feature_deviations: featureDeviations,
      algorithm: result.algorithm,
      all_distances: distances.map(({ cluster_id, risk_tier, distance }) => ({
        cluster_id,
        risk_tier,
        distance: isFinite(distance) ? Math.round(distance * 100) / 100 : null,
      })),
    });
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/cluster/results ───────────────────────────────────────────────
router.get("/results", async (req, res, next) => {
  try {
    const results = await ClusterResult.find(
      {},
      { patients: 0, linkageMatrix: 0, clusterProfiles: 0, warnings: 0 }
    )
      .sort({ createdAt: -1 })
      .lean();
    return res.json(results);
  } catch (err) {
    return next(err);
  }
});

// ── GET /api/cluster/patient/:patientId ───────────────────────────────────
router.get("/patient/:patientId", async (req, res, next) => {
  const { patientId } = req.params;
  if (!patientId || patientId.trim() === "") {
    return res.status(400).json({ error: "patientId is required" });
  }

  try {
    const results = await ClusterResult.find(
      { "patients.patient_id": patientId },
      {
        algorithm: 1,
        createdAt: 1,
        "patients.$": 1,
      }
    )
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const history = results.map((r) => {
      const p = (r.patients || [])[0];
      return {
        resultId: r._id,
        algorithm: r.algorithm,
        createdAt: r.createdAt,
        cluster_id: p?.cluster_id ?? null,
        risk_tier: p?.risk_tier ?? null,
        pca_x: p?.pca_x ?? null,
        pca_y: p?.pca_y ?? null,
      };
    });

    return res.json(history);
  } catch (err) {
    return next(err);
  }
});

// ── POST /api/cluster/optimal-k ───────────────────────────────────────────
router.post("/optimal-k", async (req, res, next) => {
  try {
    const r = await axios.post(`${ML_ENGINE_URL}/optimal-k`, req.body, { timeout: 60_000 });
    res.json(r.data);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/cluster/detect-anomalies ────────────────────────────────────
router.post("/detect-anomalies", async (req, res, next) => {
  try {
    const r = await axios.post(`${ML_ENGINE_URL}/detect-anomalies`, req.body, { timeout: 60_000 });
    res.json(r.data);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/cluster/explain ─────────────────────────────────────────────
router.post("/explain", async (req, res, next) => {
  try {
    const r = await axios.post(`${ML_ENGINE_URL}/explain`, req.body, { timeout: 60_000 });
    res.json(r.data);
  } catch (err) {
    next(err);
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
