const mongoose = require("mongoose");

const FindingSchema = new mongoose.Schema(
  { label: String, confidence: Number },
  { _id: false }
);

const PatientMediaSchema = new mongoose.Schema(
  {
    patient_id: { type: String, required: true, index: true },
    original_name: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number },
    file_type: { type: String, enum: ["image", "document"], required: true },
    gridfs_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    analysis: {
      findings: [FindingSchema],
      model: String,
      analyzedAt: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PatientMedia", PatientMediaSchema);
