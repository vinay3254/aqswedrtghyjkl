const mongoose = require("mongoose");

const AmbulanceSchema = new mongoose.Schema(
  {
    ambulanceId:  { type: String, required: true, unique: true },
    name:         { type: String, required: true },
    type:         { type: String, enum: ["BLS", "ALS", "ICU"], required: true },
    status:       { type: String, enum: ["available", "en_route", "at_scene"], default: "available" },
    location: {
      lat:         { type: Number, required: true },
      lng:         { type: Number, required: true },
      description: { type: String, default: "" },
    },
    crew:         { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ambulance", AmbulanceSchema);
