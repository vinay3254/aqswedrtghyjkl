const Hospital = require('../../models/Hospital');

const getAllHospitals = async () => Hospital.find({ status: { $in: ['active', 'operational'] } });

module.exports = { getAllHospitals };
