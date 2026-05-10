const { AuthorizationError } = require('../utils/errors');
const logger = require('../utils/logger');

const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  DISPATCHER: 'DISPATCHER',
  DRIVER: 'DRIVER',
  PARAMEDIC: 'PARAMEDIC',
  HOSPITAL_STAFF: 'HOSPITAL_STAFF',
  CITIZEN: 'CITIZEN',
};

const ROLE_HIERARCHY = {
  [ROLES.SUPER_ADMIN]: 6,
  [ROLES.ADMIN]: 5,
  [ROLES.DISPATCHER]: 4,
  [ROLES.HOSPITAL_STAFF]: 3,
  [ROLES.PARAMEDIC]: 2,
  [ROLES.DRIVER]: 2,
  [ROLES.CITIZEN]: 1,
};

const ROLE_ALIASES = {
  USER: ROLES.CITIZEN,
  HOSPITAL: ROLES.HOSPITAL_STAFF,
};

const normalizeRole = (role) => {
  if (typeof role !== 'string') {
    return '';
  }

  const normalized = role.trim().toUpperCase();
  return ROLE_ALIASES[normalized] || normalized;
};

const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('Authentication required');
      }

      const userRole = normalizeRole(req.user.role);
      const normalizedAllowedRoles = allowedRoles.map(normalizeRole);

      if (!userRole) {
        throw new AuthorizationError('User role not found');
      }

      const hasPermission = normalizedAllowedRoles.some((role) => {
        if (role === userRole) return true;

        const userLevel = ROLE_HIERARCHY[userRole] || 0;
        const requiredLevel = ROLE_HIERARCHY[role] || 0;

        return userLevel >= requiredLevel;
      });

      if (!hasPermission) {
        logger.warn('Access denied', {
          userId: req.user.userId,
          userRole,
          requiredRoles: normalizedAllowedRoles,
        });
        throw new AuthorizationError(
          `Access denied. Required role: ${normalizedAllowedRoles.join(' or ')}`
        );
      }

      logger.debug('Role authorization passed', {
        userId: req.user.userId,
        role: userRole,
      });

      next();
    } catch (error) {
      next(error);
    }
  };
};

const checkPermission = (...permissions) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('Authentication required');
      }

      const userPermissions = req.user.permissions || [];

      const hasPermission = permissions.every((permission) =>
        userPermissions.includes(permission)
      );

      if (!hasPermission) {
        logger.warn('Permission denied', {
          userId: req.user.userId,
          requiredPermissions: permissions,
          userPermissions,
        });
        throw new AuthorizationError('Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

const checkOwnership = (resourceParam = 'id', userField = 'userId') => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AuthorizationError('Authentication required');
      }

      const userRole = normalizeRole(req.user.role);
      if (userRole === ROLES.SUPER_ADMIN || userRole === ROLES.ADMIN) {
        return next();
      }

      const resourceId = req.params[resourceParam] || req.body[resourceParam];
      const userId = req.user[userField];

      if (resourceId !== userId && resourceId !== String(userId)) {
        logger.warn('Ownership check failed', {
          userId,
          resourceId,
          userRole,
        });
        throw new AuthorizationError('You can only access your own resources');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  normalizeRole,
  checkRole,
  checkPermission,
  checkOwnership,
};
