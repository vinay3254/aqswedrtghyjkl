const User = require('./models/User');
const { hashPassword, comparePassword, validatePasswordStrength, generateRandomToken } = require('./utils/password');
const { generateTokenPair, verifyRefreshToken } = require('./utils/jwt');
const { ROLES } = require('./config/roles');

class AuthService {
  constructor(db) {
    this.db = db;
  }

  async register(userData) {
    const { email, password, firstName, lastName, role, phoneNumber } = userData;

    const existingUser = await User.findByEmail(this.db, email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.errors.join(', '));
    }

    if (role && !Object.values(ROLES).includes(role)) {
      throw new Error('Invalid role');
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create(this.db, {
      email,
      passwordHash,
      firstName,
      lastName,
      role: role || ROLES.CITIZEN,
      phoneNumber,
      isVerified: false
    });

    await this.logAuthEvent(user.id, 'register', { email });

    return {
      user: user.toJSON(),
      tokens: generateTokenPair(user)
    };
  }

  async login(email, password) {
    const user = await User.findByEmail(this.db, email);
    
    if (!user) {
      await this.logAuthEvent(null, 'login_failed', { email, reason: 'user_not_found' });
      throw new Error('Invalid email or password');
    }

    if (user.isLocked()) {
      await this.logAuthEvent(user.id, 'login_failed', { reason: 'account_locked' });
      throw new Error('Account is locked due to too many failed login attempts. Please try again later.');
    }

    if (!user.isActive) {
      await this.logAuthEvent(user.id, 'login_failed', { reason: 'account_inactive' });
      throw new Error('Account is inactive. Please contact support.');
    }

    const isValidPassword = await comparePassword(password, user.passwordHash);
    
    if (!isValidPassword) {
      await User.incrementFailedAttempts(this.db, user.id);
      await this.logAuthEvent(user.id, 'login_failed', { reason: 'invalid_password' });
      throw new Error('Invalid email or password');
    }

    await User.resetFailedAttempts(this.db, user.id);
    await this.logAuthEvent(user.id, 'login_success', {});

    return {
      user: user.toJSON(),
      tokens: generateTokenPair(user)
    };
  }

  async refreshToken(refreshToken) {
    const verification = verifyRefreshToken(refreshToken);
    
    if (!verification.valid) {
      throw new Error('Invalid or expired refresh token');
    }

    const user = await User.findById(this.db, verification.decoded.userId);
    
    if (!user || !user.isActive) {
      throw new Error('User not found or inactive');
    }

    await this.logAuthEvent(user.id, 'token_refresh', {});

    return {
      user: user.toJSON(),
      tokens: generateTokenPair(user)
    };
  }

  async logout(userId, sessionId) {
    if (sessionId) {
      await this.db.query(
        'DELETE FROM refresh_tokens WHERE session_id = $1',
        [sessionId]
      );
    }

    await this.logAuthEvent(userId, 'logout', {});
    
    return { success: true };
  }

  async forgotPassword(email) {
    const user = await User.findByEmail(this.db, email);
    
    if (!user) {
      return { success: true };
    }

    const resetToken = generateRandomToken(32);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.db.query(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE 
       SET token = $2, expires_at = $3, used = false, created_at = NOW()`,
      [user.id, resetToken, expiresAt]
    );

    await this.logAuthEvent(user.id, 'password_reset_requested', {});

    return {
      success: true,
      resetToken,
      email: user.email
    };
  }

  async resetPassword(token, newPassword) {
    const result = await this.db.query(
      `SELECT user_id, expires_at, used 
       FROM password_reset_tokens 
       WHERE token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid reset token');
    }

    const resetRecord = result.rows[0];

    if (resetRecord.used) {
      throw new Error('Reset token has already been used');
    }

    if (new Date(resetRecord.expires_at) < new Date()) {
      throw new Error('Reset token has expired');
    }

    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.errors.join(', '));
    }

    const passwordHash = await hashPassword(newPassword);
    await User.updatePassword(this.db, resetRecord.user_id, passwordHash);

    await this.db.query(
      'UPDATE password_reset_tokens SET used = true WHERE token = $1',
      [token]
    );

    await this.logAuthEvent(resetRecord.user_id, 'password_reset_completed', {});

    return { success: true };
  }

  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(this.db, userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    const isValidPassword = await comparePassword(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      await this.logAuthEvent(userId, 'password_change_failed', { reason: 'invalid_current_password' });
      throw new Error('Current password is incorrect');
    }

    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(passwordValidation.errors.join(', '));
    }

    const passwordHash = await hashPassword(newPassword);
    await User.updatePassword(this.db, userId, passwordHash);

    await this.logAuthEvent(userId, 'password_changed', {});

    return { success: true };
  }

  async getCurrentUser(userId) {
    const user = await User.findById(this.db, userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    return user.toJSON();
  }

  async logAuthEvent(userId, event, metadata) {
    try {
      await this.db.query(
        `INSERT INTO auth_audit_log (user_id, event, metadata, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, event, JSON.stringify(metadata), metadata.ip || null, metadata.userAgent || null]
      );
    } catch (error) {
      console.error('Failed to log auth event:', error);
    }
  }
}

module.exports = AuthService;
