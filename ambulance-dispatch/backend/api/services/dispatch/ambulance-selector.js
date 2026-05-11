const Ambulance = require('../../models/Ambulance');

const getAvailableAmbulances = async () => Ambulance.find({ status: 'AVAILABLE' });

module.exports = { getAvailableAmbulances };
