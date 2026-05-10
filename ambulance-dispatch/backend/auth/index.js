const AuthService = require('./service');
const AuthController = require('./controller');
const createAuthRoutes = require('./routes');
const {
  requireAuth,
  requireRole,
  requirePermission,
  requireAnyPermission,
  checkOwnership,
  optionalAuth,
  rateLimiter
} = require('./middleware');
const {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  isRoleHigherOrEqual
} = require('./config/roles');
const User = require('./models/User');
const { generateTokenPair, verifyAccessToken, verifyRefreshToken } = require('./utils/jwt');
const { hashPassword, comparePassword, validatePasswordStrength } = require('./utils/password');

module.exports = {
  AuthService,
  AuthController,
  createAuthRoutes,
  
  middleware: {
    requireAuth,
    requireRole,
    requirePermission,
    requireAnyPermission,
    checkOwnership,
    optionalAuth,
    rateLimiter
  },
  
  roles: {
    ROLES,
    PERMISSIONS,
    ROLE_PERMISSIONS,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isRoleHigherOrEqual
  },
  
  models: {
    User
  },
  
  utils: {
    jwt: {
      generateTokenPair,
      verifyAccessToken,
      verifyRefreshToken
    },
    password: {
      hashPassword,
      comparePassword,
      validatePasswordStrength
    }
  }
};
