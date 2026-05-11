const mongoose = require('mongoose');
const config = require('./config');
const logger = require('../utils/logger');

const connect = async () => {
  await mongoose.connect(config.database.uri);
  logger.info('MongoDB connection established');
};

const healthCheck = async () => {
  const state = mongoose.connection.readyState;
  // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  return { healthy: state === 1, state };
};

module.exports = { connect, healthCheck };
