/**
 * SMS/USSD Routes
 * Express routes for SMS and USSD endpoints
 */

const express = require('express');
const SMSController = require('./controller');

function createSMSRoutes(config = {}) {
  const router = express.Router();
  const controller = new SMSController(config);

  // SMS Routes
  router.post('/sms/receive', (req, res) => controller.receiveSMS(req, res));
  router.post('/sms/send', (req, res) => controller.sendSMS(req, res));
  router.get('/sms/status/:messageId', (req, res) => controller.getSMSStatus(req, res));
  router.get('/sms/messages', (req, res) => controller.getSentMessages(req, res));
  router.post('/sms/status-update', (req, res) => controller.sendStatusUpdate(req, res));
  
  // Testing/Simulation Routes
  router.post('/sms/simulate', (req, res) => controller.simulateIncomingSMS(req, res));
  router.post('/ussd/simulate', (req, res) => controller.simulateUSSD(req, res));
  
  // USSD Routes
  router.post('/ussd/session', (req, res) => controller.handleUSSD(req, res));
  
  // Health Check
  router.get('/sms/health', (req, res) => controller.getHealth(req, res));

  return router;
}

module.exports = createSMSRoutes;
