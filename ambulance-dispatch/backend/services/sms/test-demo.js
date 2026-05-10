/**
 * SMS/USSD System Demo
 * Interactive demonstration of all SMS features
 */

const SMSService = require('./service');

async function runDemo() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   SMS/USSD Emergency Dispatch System - DEMO               ║');
  console.log('║   Rural Area Coverage Solution                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const smsService = new SMSService({
    gatewayType: 'mock',
    googleMapsApiKey: 'mock'
  });

  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('SCENARIO 1: Emergency Request via SMS\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  await delay(1000);

  // Simulate user sending emergency SMS
  console.log('👤 User sends SMS: "AMBULANCE Gandhi Chowk, Patna"\n');
  await delay(500);

  const result1 = await smsService.processIncomingSMS(
    '+91-9876543210',
    'AMBULANCE Gandhi Chowk, Patna'
  );

  await delay(2000);

  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('SCENARIO 2: Status Update - Ambulance En Route\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  await delay(1000);

  console.log('🚑 Ambulance is on the way...\n');
  await smsService.sendStatusUpdate('+91-9876543210', 'en_route', { eta: 10 });

  await delay(2000);

  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('SCENARIO 3: Status Update - Ambulance Arrived\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  await delay(1000);

  console.log('✅ Ambulance has arrived!\n');
  await smsService.sendStatusUpdate('+91-9876543210', 'arrived');

  await delay(2000);

  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('SCENARIO 4: Driver Assignment\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  await delay(1000);

  // Simulate driver receiving assignment
  console.log('👨‍⚕️ Driver receives assignment via SMS\n');
  await delay(1000);

  // Simulate driver accepting
  console.log('👨‍⚕️ Driver replies: "YES"\n');
  await delay(500);

  const result2 = await smsService.processIncomingSMS(
    '+91-9876543211',
    'YES'
  );

  await delay(2000);

  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('SCENARIO 5: Status Check via SMS\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  await delay(1000);

  console.log('👤 User sends: "STATUS"\n');
  await delay(500);

  const result3 = await smsService.processIncomingSMS(
    '+91-9876543210',
    'STATUS'
  );

  await delay(2000);

  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('SCENARIO 6: USSD Interactive Menu (*108#)\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  await delay(1000);

  const sessionId = `USSD-DEMO-${Date.now()}`;
  const userPhone = '+91-8888888888';

  console.log('📞 User dials *108#\n');
  await delay(500);

  // Step 1: Show main menu
  let ussdResponse = smsService.handleUSSD(sessionId, userPhone, '');
  console.log(ussdResponse.message);
  console.log('\n─────────────────────────────────────────────────────────\n');
  await delay(1500);

  // Step 2: Select option 1 (Request Ambulance)
  console.log('👤 User enters: 1\n');
  await delay(500);
  
  ussdResponse = smsService.handleUSSD(sessionId, userPhone, '1');
  console.log(ussdResponse.message);
  console.log('\n─────────────────────────────────────────────────────────\n');
  await delay(1500);

  // Step 3: Enter location
  console.log('👤 User enters: Connaught Place, Delhi\n');
  await delay(500);
  
  ussdResponse = smsService.handleUSSD(sessionId, userPhone, 'Connaught Place, Delhi');
  console.log(ussdResponse.message);
  console.log('\n─────────────────────────────────────────────────────────\n');
  await delay(1500);

  // Step 4: Confirm
  console.log('👤 User enters: 1 (Confirm)\n');
  await delay(500);
  
  ussdResponse = smsService.handleUSSD(sessionId, userPhone, '1');
  console.log(ussdResponse.message);
  console.log('\n─────────────────────────────────────────────────────────\n');

  await delay(2000);

  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('SCENARIO 7: Help Command\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  await delay(1000);

  console.log('👤 User sends: "HELP"\n');
  await delay(500);

  const result4 = await smsService.processIncomingSMS(
    '+91-9999999999',
    'HELP'
  );

  await delay(2000);

  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('SCENARIO 8: Patient Loaded & Going to Hospital\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  await delay(1000);

  console.log('🏥 Patient loaded, heading to hospital...\n');
  await smsService.sendStatusUpdate('+91-9876543210', 'patient_loaded', {
    hospital: 'City General Hospital'
  });

  await delay(2000);

  console.log('\n═══════════════════════════════════════════════════════════\n');
  console.log('SCENARIO 9: Arrived at Hospital\n');
  console.log('═══════════════════════════════════════════════════════════\n');

  await delay(1000);

  console.log('🏥 Arrived at hospital!\n');
  await smsService.sendStatusUpdate('+91-9876543210', 'at_hospital');

  await delay(2000);

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                     DEMO COMPLETE                          ║');
  console.log('║                                                            ║');
  console.log('║  Key Features Demonstrated:                                ║');
  console.log('║  ✓ SMS Emergency Request                                   ║');
  console.log('║  ✓ Automatic Geocoding                                     ║');
  console.log('║  ✓ Ambulance Dispatch                                      ║');
  console.log('║  ✓ Real-time Status Updates                                ║');
  console.log('║  ✓ Driver Assignment & Response                            ║');
  console.log('║  ✓ USSD Interactive Menu                                   ║');
  console.log('║  ✓ Status Checking                                         ║');
  console.log('║  ✓ Help System                                             ║');
  console.log('║  ✓ Complete Patient Journey Tracking                       ║');
  console.log('║                                                            ║');
  console.log('║  System ready for rural deployment! 🚀                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Show summary
  console.log('📊 SUMMARY\n');
  console.log(`Total SMS Sent: ${smsService.getSentMessages().length}`);
  console.log(`Active USSD Sessions: ${smsService.ussdHandler.getActiveSessionCount()}`);
  console.log('\nAll systems operational! ✅\n');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run demo if executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = runDemo;
