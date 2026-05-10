const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate, authValidation } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimiter');
const { generateToken, verifyToken, blacklistToken } = require('../middleware/auth');
const { successResponse } = require('../utils/response');
const { AuthenticationError, ConflictError, ValidationError } = require('../utils/errors');
const db = require('../config/database');
const redis = require('../config/redis');
const config = require('../config/config');
const logger = require('../utils/logger');

const VALID_ROLES = new Set(['CITIZEN', 'DISPATCHER', 'DRIVER', 'HOSPITAL_STAFF', 'ADMIN']);

const normalizeRole = (role) => {
  if (!role) {
    return 'CITIZEN';
  }

  return String(role).trim().toUpperCase();
};

const incrementFailedLoginAttempts = async (userId) => {
  await db.query(
    `UPDATE users
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = CASE
           WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '30 minutes'
           ELSE locked_until
         END,
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
};

const resetFailedLoginAttempts = async (userId) => {
  await db.query(
    `UPDATE users
     SET failed_login_attempts = 0,
         locked_until = NULL,
         last_login_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );
};

router.post(
  '/register',
  authLimiter,
  validate(authValidation.register),
  asyncHandler(async (req, res) => {
    const { email, password, firstName, lastName, phoneNumber, role } = req.body;
    const normalizedRole = normalizeRole(role);

    if (!VALID_ROLES.has(normalizedRole)) {
      throw new ValidationError('Invalid role supplied');
    }

    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      throw new ConflictError('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(password, config.security.bcryptRounds);

    const result = await db.query(
      `INSERT INTO users (
         email,
         password_hash,
         first_name,
         last_name,
         phone_number,
         role,
         is_active,
         is_verified,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, true, false, NOW(), NOW())
       RETURNING id, email, first_name, last_name, role, created_at`,
      [email.toLowerCase(), hashedPassword, firstName, lastName, phoneNumber, normalizedRole]
    );

    const user = result.rows[0];

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    logger.info('User registered', { userId: user.id, email: user.email, role: user.role });

    successResponse(
      res,
      {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
        },
        token,
      },
      'Registration successful',
      201
    );
  })
);

router.post(
  '/login',
  authLimiter,
  validate(authValidation.login),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new AuthenticationError('Invalid email or password');
    }

    const user = result.rows[0];

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new AuthenticationError('Account is temporarily locked due to repeated failed logins');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      await incrementFailedLoginAttempts(user.id);
      throw new AuthenticationError('Invalid email or password');
    }

    if (!user.is_active) {
      throw new AuthenticationError('Account is disabled');
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateToken(
      { userId: user.id },
      config.security.jwtRefreshExpiresIn
    );

    await resetFailedLoginAttempts(user.id);

    await redis.set(`user:${user.id}`, {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
    }, 86400);

    logger.info('User logged in', { userId: user.id, email: user.email, role: user.role });

    successResponse(res, {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
      },
      token,
      refreshToken,
    }, 'Login successful');
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      await blacklistToken(token, 86400);
      logger.info('User logged out');
    }

    successResponse(res, null, 'Logout successful');
  })
);

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AuthenticationError('Refresh token required');
    }

    const decoded = verifyToken(refreshToken);

    const result = await db.query(
      `SELECT id, email, role, first_name, last_name
       FROM users
       WHERE id = $1 AND is_active = true`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      throw new AuthenticationError('Invalid refresh token');
    }

    const user = result.rows[0];

    const newToken = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    successResponse(res, { token: newToken }, 'Token refreshed successfully');
  })
);

module.exports = router;
