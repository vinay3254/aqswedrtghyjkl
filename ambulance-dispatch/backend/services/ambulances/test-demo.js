/**
 * Ambulance Service Test & Demo Script
 * 
 * This script demonstrates the complete ambulance management system functionality.
 * Run this after initializing the database to verify everything works.
 */

const { 
  ambulanceService, 
  driverService, 
  availabilityService, 
  geospatialService,
  AMBULANCE_TYPES,
  AMBULANCE_STATUS,
  createTables 
} = require('./index');
const logger = require('../../api/utils/logger');

async function runTests() {
  try {
    console.log('\n🚑 Ambulance Management System - Demo & Test\n');

    // 1. Initialize database
    console.log('1️⃣  Initializing database tables...');
    await createTables();
    console.log('   ✅ Database tables created\n');

    // 2. Create test ambulances
    console.log('2️⃣  Creating test ambulances...');
    
    const amb1 = await ambulanceService.create({
      callSign: 'AMB-01',
      type: AMBULANCE_TYPES.ALS,
      baseStation: 'Central Station',
      latitude: 40.7128,
      longitude: -74.0060,
      equipment: ['defibrillator', 'ventilator', 'oxygen', 'medications'],
      metadata: { vehicle: 'Ford F-450', year: 2023 },
    });
    console.log(`   ✅ Created ALS ambulance: ${amb1.callSign}`);

    const amb2 = await ambulanceService.create({
      callSign: 'AMB-02',
      type: AMBULANCE_TYPES.BLS,
      baseStation: 'North Station',
      latitude: 40.7580,
      longitude: -73.9855,
      equipment: ['oxygen', 'stretcher', 'basic_kit'],
      metadata: { vehicle: 'Chevy Express', year: 2022 },
    });
    console.log(`   ✅ Created BLS ambulance: ${amb2.callSign}`);

    const amb3 = await ambulanceService.create({
      callSign: 'AMB-03',
      type: AMBULANCE_TYPES.NEONATAL,
      baseStation: 'East Station',
      latitude: 40.7489,
      longitude: -73.9680,
      equipment: ['incubator', 'neonatal_ventilator', 'warming_system'],
      metadata: { vehicle: 'Mercedes Sprinter', year: 2024 },
    });
    console.log(`   ✅ Created NEONATAL ambulance: ${amb3.callSign}\n`);

    // 3. Create test drivers
    console.log('3️⃣  Creating test drivers...');
    
    const driver1 = await driverService.create({
      userId: 'user-123',
      licenseNumber: 'DL-001-2024',
      licenseExpiry: '2025-12-31',
      certifications: ['EMT-P', 'ACLS', 'PALS'],
    });
    console.log(`   ✅ Created driver: ${driver1.licenseNumber}`);

    const driver2 = await driverService.create({
      userId: 'user-456',
      licenseNumber: 'DL-002-2024',
      licenseExpiry: '2026-06-30',
      certifications: ['EMT-B', 'CPR'],
    });
    console.log(`   ✅ Created driver: ${driver2.licenseNumber}\n`);

    // 4. Start driver shifts and assign to ambulances
    console.log('4️⃣  Starting driver shifts...');
    
    await driverService.startShift(driver1.id, amb1.id);
    console.log(`   ✅ Driver ${driver1.licenseNumber} assigned to ${amb1.callSign}`);

    await driverService.startShift(driver2.id, amb2.id);
    console.log(`   ✅ Driver ${driver2.licenseNumber} assigned to ${amb2.callSign}\n`);

    // 5. Mark ambulances as available
    console.log('5️⃣  Marking ambulances as available...');
    
    await availabilityService.markAsAvailable(amb1.id);
    console.log(`   ✅ ${amb1.callSign} is now AVAILABLE`);

    await availabilityService.markAsAvailable(amb2.id);
    console.log(`   ✅ ${amb2.callSign} is now AVAILABLE\n`);

    // 6. Test geospatial search
    console.log('6️⃣  Testing geospatial search...');
    
    const incidentLocation = {
      latitude: 40.7489,
      longitude: -73.9680,
    };
    console.log(`   📍 Incident location: ${incidentLocation.latitude}, ${incidentLocation.longitude}`);

    const nearest = await geospatialService.findNearestAmbulances(
      incidentLocation.latitude,
      incidentLocation.longitude,
      {
        type: AMBULANCE_TYPES.ALS,
        status: AMBULANCE_STATUS.AVAILABLE,
        limit: 3,
      }
    );

    console.log(`   ✅ Found ${nearest.length} nearest ALS ambulances:`);
    nearest.forEach((amb, idx) => {
      console.log(`      ${idx + 1}. ${amb.callSign} - ${amb.distance.toFixed(2)} km away`);
    });
    console.log('');

    // 7. Find optimal ambulance
    console.log('7️⃣  Finding optimal ambulance for incident...');
    
    const optimal = await geospatialService.findOptimalAmbulance(
      incidentLocation,
      {
        type: AMBULANCE_TYPES.ALS,
        requiredEquipment: ['defibrillator'],
        minFuelLevel: 25,
        maxResponseTime: 15,
      }
    );

    if (optimal) {
      console.log(`   ✅ Optimal unit: ${optimal.callSign}`);
      console.log(`      - Distance: ${optimal.distance.toFixed(2)} km`);
      console.log(`      - ETA: ~${optimal.estimatedResponseTime} minutes`);
      console.log(`      - Priority Score: ${optimal.priorityScore.toFixed(1)}\n`);
    }

    // 8. Simulate dispatch workflow
    console.log('8️⃣  Simulating dispatch workflow...');
    
    await availabilityService.markAsDispatched(amb1.id, 'incident-123', 'dispatcher-1');
    console.log(`   ✅ ${amb1.callSign} dispatched to incident`);

    await ambulanceService.updateLocation(amb1.id, 40.7300, -74.0000);
    console.log(`   ✅ ${amb1.callSign} location updated (en route)`);

    await availabilityService.markAsBusy(amb1.id, 'On scene');
    console.log(`   ✅ ${amb1.callSign} marked as BUSY (on scene)`);

    await ambulanceService.updateFuelLevel(amb1.id, 75);
    console.log(`   ✅ ${amb1.callSign} fuel level updated to 75%\n`);

    // 9. Get availability stats
    console.log('9️⃣  Getting fleet statistics...');
    
    const stats = await availabilityService.getAvailabilityStats();
    console.log(`   📊 Fleet Statistics:`);
    console.log(`      - Total Ambulances: ${stats.total}`);
    console.log(`      - Available: ${stats.byStatus.AVAILABLE || 0}`);
    console.log(`      - Dispatched: ${stats.byStatus.DISPATCHED || 0}`);
    console.log(`      - Busy: ${stats.byStatus.BUSY || 0}`);
    console.log(`      - Offline: ${stats.byStatus.OFFLINE || 0}\n`);

    console.log('   By Type:');
    Object.keys(stats.byType).forEach(type => {
      const typeStats = stats.byType[type];
      console.log(`      ${type}: ${typeStats.total} total, ${typeStats.available} available`);
    });
    console.log('');

    // 10. Complete incident and return to service
    console.log('🔟 Completing incident...');
    
    await availabilityService.markAsAvailable(amb1.id);
    console.log(`   ✅ ${amb1.callSign} returned to AVAILABLE status\n`);

    // 11. Get status history
    console.log('1️⃣1️⃣ Getting status history...');
    
    const history = await ambulanceService.getStatusHistory(amb1.id, 10);
    console.log(`   📜 ${amb1.callSign} status history (${history.length} changes):`);
    history.slice(0, 5).forEach((h, idx) => {
      console.log(`      ${idx + 1}. ${h.previousStatus} → ${h.newStatus} (${h.reason || 'No reason'})`);
    });
    console.log('');

    // 12. Test radius search
    console.log('1️⃣2️⃣ Testing radius search...');
    
    const inRadius = await geospatialService.findAmbulancesInRadius(
      40.7128,
      -74.0060,
      10,
      { status: AMBULANCE_STATUS.AVAILABLE }
    );
    console.log(`   ✅ Found ${inRadius.length} ambulances within 10 km radius\n`);

    // 13. Test low fuel monitoring
    console.log('1️⃣3️⃣ Testing low fuel monitoring...');
    
    await ambulanceService.updateFuelLevel(amb2.id, 20);
    const lowFuel = await availabilityService.checkLowFuelAmbulances(25);
    console.log(`   ⚠️  Low fuel alerts: ${lowFuel.length} ambulances`);
    lowFuel.forEach(amb => {
      console.log(`      - ${amb.callSign}: ${amb.fuelLevel}% fuel remaining`);
    });
    console.log('');

    // 14. End driver shift
    console.log('1️⃣4️⃣ Ending driver shifts...');
    
    await driverService.endShift(driver1.id);
    console.log(`   ✅ Driver ${driver1.licenseNumber} shift ended`);
    
    await availabilityService.markAsOffline(amb1.id, 'End of shift');
    console.log(`   ✅ ${amb1.callSign} marked as OFFLINE\n`);

    // Final stats
    console.log('📈 Final Fleet Status:');
    const finalStats = await availabilityService.getAvailabilityStats();
    console.log(`   - Available: ${finalStats.byStatus.AVAILABLE || 0}`);
    console.log(`   - Dispatched: ${finalStats.byStatus.DISPATCHED || 0}`);
    console.log(`   - Busy: ${finalStats.byStatus.BUSY || 0}`);
    console.log(`   - Offline: ${finalStats.byStatus.OFFLINE || 0}`);
    console.log(`   - Out of Service: ${finalStats.byStatus.OUT_OF_SERVICE || 0}\n`);

    console.log('✅ All tests completed successfully!\n');
    
    return true;
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    throw error;
  }
}

if (require.main === module) {
  runTests()
    .then(() => {
      console.log('🎉 Demo completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Demo failed:', error);
      process.exit(1);
    });
}

module.exports = { runTests };
