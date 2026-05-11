const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
  incidentType: { type: String, required: true },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
  status: { type: String, enum: ['REPORTED', 'DISPATCHED', 'EN_ROUTE', 'AT_SCENE', 'RESOLVED', 'CANCELLED'], default: 'REPORTED' },
  locationLat: Number,
  locationLng: Number,
  locationAddress: String,
  callerName: String,
  callerPhone: String,
  patientsCount: { type: Number, default: 1 },
  description: String,
  isSos: { type: Boolean, default: false },
  assignedAmbulanceId: String,
  assignedHospitalId: String,
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Incident', incidentSchema);
