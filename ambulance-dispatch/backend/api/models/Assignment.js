const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema({
  incidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', required: true },
  ambulance: { type: mongoose.Schema.Types.Mixed },
  hospital: { type: mongoose.Schema.Types.Mixed },
  status: { type: String, enum: ['PENDING', 'ACCEPTED', 'EN_ROUTE', 'AT_SCENE', 'AT_HOSPITAL', 'COMPLETED', 'CANCELLED'], default: 'PENDING' },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: String,
}, { timestamps: true });

module.exports = mongoose.model('Assignment', assignmentSchema);
