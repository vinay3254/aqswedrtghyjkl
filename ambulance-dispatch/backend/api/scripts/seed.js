require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Ambulance = require('../models/Ambulance');
const Hospital = require('../models/Hospital');
const User = require('../models/User');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ambulance_dispatch');

  // Clear existing
  await Promise.all([User.deleteMany(), Ambulance.deleteMany(), Hospital.deleteMany()]);

  // Seed admin user
  const passwordHash = await bcrypt.hash('admin123', 10);
  await User.create([
    { email: 'admin@medicluster.com', passwordHash, firstName: 'Admin', lastName: 'User', role: 'ADMIN', isActive: true, isVerified: true },
    { email: 'dispatcher@medicluster.com', passwordHash, firstName: 'Dispatch', lastName: 'User', role: 'DISPATCHER', isActive: true, isVerified: true },
    { email: 'driver@medicluster.com', passwordHash, firstName: 'Driver', lastName: 'One', role: 'DRIVER', isActive: true, isVerified: true },
  ]);

  // Seed ambulances
  await Ambulance.create([
    { callSign: 'AMB-001', vehicleType: 'ALS', status: 'AVAILABLE', currentLat: 12.9716, currentLng: 77.5946 },
    { callSign: 'AMB-002', vehicleType: 'BLS', status: 'AVAILABLE', currentLat: 12.9352, currentLng: 77.6245 },
    { callSign: 'AMB-003', vehicleType: 'ALS', status: 'AVAILABLE', currentLat: 13.0827, currentLng: 77.5977 },
  ]);

  // Seed hospitals
  await Hospital.create([
    { name: 'Apollo Hospital', address: 'Bannerghatta Rd, Bangalore', status: 'active', lat: 12.8933, lng: 77.5984, specialties: ['Trauma', 'Cardiac'], bedCount: 500, availableBeds: 120 },
    { name: 'Fortis Hospital', address: 'Cunningham Rd, Bangalore', status: 'active', lat: 12.9975, lng: 77.5937, specialties: ['Neuro', 'Ortho'], bedCount: 300, availableBeds: 80 },
    { name: 'Manipal Hospital', address: 'HAL Airport Rd, Bangalore', status: 'active', lat: 12.9550, lng: 77.6445, specialties: ['Trauma', 'Pediatrics'], bedCount: 600, availableBeds: 200 },
  ]);

  console.log('Seed complete');
  await mongoose.disconnect();
};

seed().catch(console.error);
