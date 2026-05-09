/**
 * backend/models/ClusterResult.js
 * Mongoose schema for clustering run results.
 */

const mongoose = require("mongoose");

const ClusterResultSchema = new mongoose.Schema(
  {
    datasetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dataset",
      required: true,
    },
    algorithm: { type: String, required: true },
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    patients: [{ type: mongoose.Schema.Types.Mixed }],
    metrics: {
      silhouette: Number,
      davies_bouldin: Number,
      calinski_harabasz: Number,
    },
    riskDistribution: { type: mongoose.Schema.Types.Mixed, default: {} },
    clusterProfiles: [{ type: mongoose.Schema.Types.Mixed }],
    featureNames: [{ type: String }],
    linkageMatrix: { type: mongoose.Schema.Types.Mixed }, // hierarchical only
  },
  { timestamps: true }
);

module.exports = mongoose.model("ClusterResult", ClusterResultSchema);
