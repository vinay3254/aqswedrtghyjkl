const { createTables } = require('./model');
const logger = require('../../api/utils/logger');

async function initializeAmbulanceService() {
  try {
    logger.info('Initializing ambulance service...');
    
    await createTables();
    
    logger.info('Ambulance service initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize ambulance service:', error);
    throw error;
  }
}

if (require.main === module) {
  initializeAmbulanceService()
    .then(() => {
      console.log('✅ Ambulance service initialization complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Ambulance service initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeAmbulanceService };
