const mongoose = require('mongoose');

const ambulanceSchema = new mongoose.Schema({
  callSign: { type: String, required: true },
  vehicleType: { type: String, default: 'ALS' },
  status: { type: String, enum: ['AVAILABLE', 'DISPATCHED', 'ON_SCENE', 'RETURNING', 'OFFLINE'], default: 'AVAILABLE' },
  currentLat: Number,
  currentLng: Number,
  driverId: String,
  baseHospitalId: String,
  etaMinutes: Number,
}, { timestamps: true });

module.exports = mongoose.model('Ambulance', ambulanceSchema);
