const Assignment = require('../../models/Assignment');

const createAssignment = async (data) => Assignment.create(data);

const findById = async (id) => Assignment.findById(id);

const findByIncidentId = async (incidentId) => Assignment.find({ incidentId });

const findByDriverId = async (driverId) => Assignment.find({ 'ambulance.driverId': driverId });

const getActiveAssignments = async () => Assignment.find({ status: { $in: ['PENDING', 'ACCEPTED', 'EN_ROUTE', 'AT_SCENE', 'AT_HOSPITAL'] } }).sort({ createdAt: -1 });

const updateStatus = async (id, status) => Assignment.findByIdAndUpdate(id, { status }, { new: true });

const getMetrics = async () => {
  const [total, active, completed, cancelled] = await Promise.all([
    Assignment.countDocuments(),
    Assignment.countDocuments({ status: { $in: ['PENDING', 'ACCEPTED', 'EN_ROUTE', 'AT_SCENE', 'AT_HOSPITAL'] } }),
    Assignment.countDocuments({ status: 'COMPLETED' }),
    Assignment.countDocuments({ status: 'CANCELLED' }),
  ]);
  return { total, active, completed, cancelled };
};

module.exports = { createAssignment, findById, findByIncidentId, findByDriverId, getActiveAssignments, updateStatus, getMetrics };
