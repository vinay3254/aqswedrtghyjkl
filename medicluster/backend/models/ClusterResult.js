/**
 * backend/models/ClusterResult.js
 * Mongoose schema for clustering run results.
 */

const mongoose = require("mongoose");

const ClusterParamsSchema = new mongoose.Schema(
  {
    k: Number,
    kmeans_init: String,
    eps: Number,
    min_samples: Number,
    n_clusters: Number,
    linkage: String,
    n_components: Number,
    covariance_type: String,
    risk_feature_weights: { type: Map, of: Number, default: undefined },
  },
  { _id: false }
);

const PatientResultSchema = new mongoose.Schema(
  {
    patient_id: String,
    gender: String,
    age: Number,
    bmi: Number,
    systolic_bp: Number,
    diastolic_bp: Number,
    glucose: Number,
    hba1c: Number,
    cholesterol: Number,
    hdl: Number,
    ldl: Number,
    triglycerides: Number,
    heart_rate: Number,
    spo2: Number,
    num_medications: Number,
    cluster_id: Number,
    risk_tier: String,
    pca_x: Number,
    pca_y: Number,
    gmm_probabilities: [{ type: Number }],
    numericFeatures: { type: Map, of: Number, default: {} },
    textFeatures: { type: Map, of: String, default: {} },
  },
  { _id: false }
);

const RiskDistributionSchema = new mongoose.Schema(
  {
    Low: { type: Number, default: 0 },
    Moderate: { type: Number, default: 0 },
    High: { type: Number, default: 0 },
    Critical: { type: Number, default: 0 },
    Noise: { type: Number, default: 0 },
    Unknown: { type: Number, default: 0 },
  },
  { _id: false }
);

const ClusterProfileSchema = new mongoose.Schema(
  {
    cluster_id: Number,
    risk_tier: String,
    size: Number,
    centroidFeatures: { type: Map, of: Number, default: {} },
  },
  { _id: false }
);

const PreprocessingSchema = new mongoose.Schema(
  {
    rows_before: Number,
    rows_after: Number,
    dropped_rows: Number,
    dropped_non_numeric_columns: [{ type: String }],
    feature_names: [{ type: String }],
  },
  { _id: false }
);

const ClusterResultSchema = new mongoose.Schema(
  {
    datasetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dataset",
      required: true,
    },
    algorithm: { type: String, required: true },
    params: { type: ClusterParamsSchema, default: {} },
    patients: [PatientResultSchema],
    metrics: {
      silhouette: Number,
      davies_bouldin: Number,
      calinski_harabasz: Number,
    },
    riskDistribution: { type: RiskDistributionSchema, default: {} },
    clusterProfiles: [ClusterProfileSchema],
    featureNames: [{ type: String }],
    linkageMatrix: [[Number]],
    preprocessing: { type: PreprocessingSchema, default: undefined },
    warnings: [{ type: String }],
  },
  { timestamps: true }
);

ClusterResultSchema.index({ datasetId: 1, createdAt: -1 });

module.exports = mongoose.model("ClusterResult", ClusterResultSchema);
