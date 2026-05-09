/**
 * backend/models/Dataset.js
 * Mongoose schema for uploaded patient datasets.
 */

const mongoose = require("mongoose");

const PatientDataRowSchema = new mongoose.Schema(
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
    numericFeatures: { type: Map, of: Number, default: {} },
    textFeatures: { type: Map, of: String, default: {} },
  },
  { _id: false }
);

const DatasetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    rowCount: { type: Number, required: true },
    featureNames: [{ type: String }],
    rawData: [PatientDataRowSchema],
  },
  { timestamps: true }
);

DatasetSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Dataset", DatasetSchema);
