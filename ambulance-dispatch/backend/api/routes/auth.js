const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate, authValidation } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimiter');
const { generateToken, verifyToken, blacklistToken } = require('../middleware/auth');
const { successResponse } = require('../utils/response');
const { AuthenticationError, ConflictError, ValidationError } = require('../utils/errors');
const User = require('../models/User');
const redis = require('../config/redis');
const config = require('../config/config');
const logger = require('../utils/logger');

const VALID_ROLES = new Set(['CITIZEN', 'DISPATCHER', 'DRIVER', 'HOSPITAL_STAFF', 'ADMIN']);

router.post('/register', authLimiter, validate(authValidation.register), asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, phoneNumber, role } = req.body;
  const normalizedRole = role ? String(role).trim().toUpperCase() : 'CITIZEN';
  if (!VALID_ROLES.has(normalizedRole)) throw new ValidationError('Invalid role supplied');

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw new ConflictError('Email already registered');

  const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);
  const user = await User.create({ email: email.toLowerCase(), passwordHash, firstName, lastName, phoneNumber, role: normalizedRole });

  const token = generateToken({ userId: user._id, email: user.email, role: user.role });
  logger.info('User registered', { userId: user._id, email: user.email });
  successResponse(res, { user: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role }, token }, 'Registration successful', 201);
}));

router.post('/login', authLimiter, validate(authValidation.login), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new AuthenticationError('Invalid email or password');

  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    throw new AuthenticationError('Account is temporarily locked due to repeated failed logins');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 5) user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    throw new AuthenticationError('Invalid email or password');
  }

  if (!user.isActive) throw new AuthenticationError('Account is disabled');

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  await user.save();

  const token = generateToken({ userId: user._id, email: user.email, role: user.role });
  const refreshToken = generateToken({ userId: user._id }, config.security.jwtRefreshExpiresIn);

  await redis.set(`user:${user._id}`, { id: user._id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName }, 86400);

  logger.info('User logged in', { userId: user._id, email: user.email });
  successResponse(res, { user: { id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role }, token, refreshToken }, 'Login successful');
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) await blacklistToken(token, 86400);
  successResponse(res, null, 'Logout successful');
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new AuthenticationError('Refresh token required');
  const decoded = verifyToken(refreshToken);
  const user = await User.findOne({ _id: decoded.userId, isActive: true });
  if (!user) throw new AuthenticationError('Invalid refresh token');
  const newToken = generateToken({ userId: user._id, email: user.email, role: user.role });
  successResponse(res, { token: newToken }, 'Token refreshed successfully');
}));

module.exports = router;
