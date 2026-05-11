const Incident = require('../../models/Incident');
const AuditLog = require('../../models/AuditLog');

const create = async (data) => Incident.create(data);

const findById = async (id) => Incident.findById(id);

const findAll = async ({ page = 1, limit = 20, status, severity } = {}) => {
  const filter = {};
  if (status) filter.status = status;
  if (severity) filter.severity = severity;
  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    Incident.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Incident.countDocuments(filter),
  ]);
  return { rows, total, page: Number(page), limit: Number(limit) };
};

const updateStatus = async (id, status, performedBy) => {
  const incident = await Incident.findById(id);
  if (!incident) return null;
  const old = incident.status;
  incident.status = status;
  await incident.save();
  await AuditLog.create({ incidentId: id, action: 'STATUS_CHANGE', performedBy, oldValue: old, newValue: status });
  return incident;
};

const updateSeverity = async (id, severity) => Incident.findByIdAndUpdate(id, { severity }, { new: true });

const assignHospital = async (id, hospitalId) => Incident.findByIdAndUpdate(id, { assignedHospitalId: hospitalId }, { new: true });

const getActiveIncidents = async () => Incident.find({ status: { $in: ['REPORTED', 'DISPATCHED', 'EN_ROUTE', 'AT_SCENE'] } }).sort({ createdAt: -1 });

const getPendingEscalations = async () => {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  return Incident.find({ status: 'REPORTED', severity: { $in: ['HIGH', 'CRITICAL'] }, createdAt: { $lt: cutoff } });
};

const getMetrics = async () => {
  const [total, active, resolved, byStatus] = await Promise.all([
    Incident.countDocuments(),
    Incident.countDocuments({ status: { $in: ['REPORTED', 'DISPATCHED', 'EN_ROUTE', 'AT_SCENE'] } }),
    Incident.countDocuments({ status: 'RESOLVED' }),
    Incident.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  return { total, active, resolved, byStatus };
};

const getAuditLog = async (incidentId) => AuditLog.find({ incidentId }).sort({ createdAt: -1 });

module.exports = { create, findById, findAll, updateStatus, updateSeverity, assignHospital, getActiveIncidents, getPendingEscalations, getMetrics, getAuditLog };
