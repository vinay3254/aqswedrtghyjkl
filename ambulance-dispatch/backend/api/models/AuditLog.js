const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  incidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident' },
  action: String,
  performedBy: String,
  oldValue: mongoose.Schema.Types.Mixed,
  newValue: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
