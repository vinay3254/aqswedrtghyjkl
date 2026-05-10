const { verifyAccessToken } = require('./utils/jwt');
const { hasPermission, hasAnyPermission, isRoleHigherOrEqual, ROLES } = require('./config/roles');

function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const verification = verifyAccessToken(token);

    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    req.user = verification.decoded;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      success: false,
      error: 'Authentication failed'
    });
  }
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(req.user.role) && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!hasPermission(req.user.role, permission)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
}

function requireAnyPermission(permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!hasAnyPermission(req.user.role, permissions)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
}

function checkOwnership(resourceUserIdField = 'userId') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    const resourceUserId = req.params[resourceUserIdField] || 
                          req.body[resourceUserIdField] || 
                          req.query[resourceUserIdField];

    if (!resourceUserId) {
      return res.status(400).json({
        success: false,
        error: 'Resource user ID not found'
      });
    }

    if (req.user.userId !== resourceUserId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: You can only access your own resources'
      });
    }

    next();
  };
}

function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const verification = verifyAccessToken(token);

    if (verification.valid) {
      req.user = verification.decoded;
    }

    next();
  } catch (error) {
    next();
  }
}

function rateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000,
    maxRequests = 100,
    message = 'Too many requests, please try again later'
  } = options;

  const requests = new Map();

  return (req, res, next) => {
    const identifier = req.user?.userId || req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!requests.has(identifier)) {
      requests.set(identifier, []);
    }

    const userRequests = requests.get(identifier);
    const recentRequests = userRequests.filter(timestamp => timestamp > windowStart);

    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: message
      });
    }

    recentRequests.push(now);
    requests.set(identifier, recentRequests);

    setTimeout(() => {
      const current = requests.get(identifier);
      if (current) {
        const filtered = current.filter(timestamp => timestamp > Date.now() - windowMs);
        if (filtered.length === 0) {
          requests.delete(identifier);
        } else {
          requests.set(identifier, filtered);
        }
      }
    }, windowMs);

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
  requirePermission,
  requireAnyPermission,
  checkOwnership,
  optionalAuth,
  rateLimiter
};
