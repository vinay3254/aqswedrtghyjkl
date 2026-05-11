const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: String,
  status: { type: String, default: 'active' },
  lat: Number,
  lng: Number,
  specialties: [String],
  bedCount: Number,
  availableBeds: Number,
}, { timestamps: true });

module.exports = mongoose.model('Hospital', hospitalSchema);
