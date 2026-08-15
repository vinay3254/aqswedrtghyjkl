const mongoose = require("mongoose");

const SystemConfigSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("SystemConfig", SystemConfigSchema);
