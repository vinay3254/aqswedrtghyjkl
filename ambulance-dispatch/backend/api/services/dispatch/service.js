const assignmentManager = require('./assignment-manager');
const ambulanceSelector = require('./ambulance-selector');
const hospitalScorer = require('./hospital-scorer');
const Incident = require('../../models/Incident');
const { NotFoundError, ValidationError } = require('../../utils/errors');

const createAssignment = async ({ incidentId, ambulanceId, hospitalId, notes }, assignedBy) => {
  const incident = await Incident.findById(incidentId);
  if (!incident) throw new NotFoundError('Incident not found');

  const ambulances = await ambulanceSelector.getAvailableAmbulances();
  const ambulance = ambulances.find(a => String(a._id) === String(ambulanceId)) || ambulances[0];

  const hospitals = await hospitalScorer.getAllHospitals();
  const hospital = hospitals.find(h => String(h._id) === String(hospitalId)) || hospitals[0];

  const assignment = await assignmentManager.createAssignment({
    incidentId,
    ambulance: ambulance ? ambulance.toObject() : { id: ambulanceId },
    hospital: hospital ? hospital.toObject() : { id: hospitalId },
    status: 'PENDING',
    assignedBy,
    notes,
  });

  if (ambulance) {
    ambulance.status = 'DISPATCHED';
    await ambulance.save();
  }

  incident.status = 'DISPATCHED';
  incident.assignedAmbulanceId = ambulanceId;
  incident.assignedHospitalId = hospitalId;
  await incident.save();

  return assignment;
};

const acceptAssignment = async (id, driverId) => {
  const assignment = await assignmentManager.findById(id);
  if (!assignment) throw new NotFoundError('Assignment not found');
  if (assignment.status !== 'PENDING') throw new ValidationError('Assignment is not pending');
  return assignmentManager.updateStatus(id, 'ACCEPTED');
};

const rejectAssignment = async (id, driverId) => {
  const assignment = await assignmentManager.findById(id);
  if (!assignment) throw new NotFoundError('Assignment not found');
  return assignmentManager.updateStatus(id, 'CANCELLED');
};

const reassignAmbulance = async (id, ambulanceId) => {
  const assignment = await assignmentManager.findById(id);
  if (!assignment) throw new NotFoundError('Assignment not found');
  const ambulances = await ambulanceSelector.getAvailableAmbulances();
  const ambulance = ambulances.find(a => String(a._id) === String(ambulanceId));
  if (ambulance) {
    assignment.ambulance = ambulance.toObject();
    await assignment.save();
    ambulance.status = 'DISPATCHED';
    await ambulance.save();
  }
  return assignment;
};

const reassignHospital = async (id, hospitalId) => {
  const assignment = await assignmentManager.findById(id);
  if (!assignment) throw new NotFoundError('Assignment not found');
  const hospitals = await hospitalScorer.getAllHospitals();
  const hospital = hospitals.find(h => String(h._id) === String(hospitalId));
  if (hospital) {
    assignment.hospital = hospital.toObject();
    await assignment.save();
  }
  return assignment;
};

module.exports = { createAssignment, acceptAssignment, rejectAssignment, reassignAmbulance, reassignHospital };
