/**
 * backend/models/Dataset.js
 * Mongoose schema for uploaded patient datasets.
 */

const mongoose = require("mongoose");

const DatasetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    rowCount: { type: Number, required: true },
    featureNames: [{ type: String }],
    rawData: [{ type: mongoose.Schema.Types.Mixed }], // array of patient row objects
  },
  { timestamps: true }
);

module.exports = mongoose.model("Dataset", DatasetSchema);
