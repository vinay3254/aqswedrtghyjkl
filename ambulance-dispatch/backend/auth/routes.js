const express = require('express');
const AuthController = require('./controller');
const { requireAuth, rateLimiter } = require('./middleware');

function createAuthRoutes(db) {
  const router = express.Router();
  const authController = new AuthController(db);

  const authRateLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    message: 'Too many authentication attempts, please try again later'
  });

  router.post('/register', 
    rateLimiter({ maxRequests: 10 }),
    (req, res) => authController.register(req, res)
  );

  router.post('/login',
    authRateLimiter,
    (req, res) => authController.login(req, res)
  );

  router.post('/refresh-token',
    rateLimiter({ maxRequests: 20 }),
    (req, res) => authController.refreshToken(req, res)
  );

  router.post('/logout',
    requireAuth,
    (req, res) => authController.logout(req, res)
  );

  router.post('/forgot-password',
    rateLimiter({ maxRequests: 3 }),
    (req, res) => authController.forgotPassword(req, res)
  );

  router.post('/reset-password',
    rateLimiter({ maxRequests: 5 }),
    (req, res) => authController.resetPassword(req, res)
  );

  router.put('/change-password',
    requireAuth,
    (req, res) => authController.changePassword(req, res)
  );

  router.get('/me',
    requireAuth,
    (req, res) => authController.getCurrentUser(req, res)
  );

  return router;
}

module.exports = createAuthRoutes;
