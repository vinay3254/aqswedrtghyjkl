const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phoneNumber: String,
  role: { type: String, enum: ['CITIZEN', 'DISPATCHER', 'DRIVER', 'HOSPITAL_STAFF', 'ADMIN'], default: 'CITIZEN' },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  failedLoginAttempts: { type: Number, default: 0 },
  lockedUntil: Date,
  lastLoginAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
