const mongoose = require("mongoose");

const HospitalSchema = new mongoose.Schema(
  {
    hospitalId:     { type: String, required: true, unique: true },
    name:           { type: String, required: true },
    trauma_level:   { type: Number, min: 1, max: 5, required: true },
    specialty:      { type: [String], default: [] },
    available_beds: { type: Number, default: 0 },
    location: {
      lat:         { type: Number, required: true },
      lng:         { type: Number, required: true },
      description: { type: String, default: "" },
    },
    phone:          { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Hospital", HospitalSchema);
