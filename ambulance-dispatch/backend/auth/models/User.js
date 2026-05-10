const { ROLES } = require('../config/roles');

class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email;
    this.passwordHash = data.password_hash;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.role = data.role;
    this.phoneNumber = data.phone_number;
    this.isActive = data.is_active !== false;
    this.isVerified = data.is_verified || false;
    this.failedLoginAttempts = data.failed_login_attempts || 0;
    this.lockedUntil = data.locked_until;
    this.lastLoginAt = data.last_login_at;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  toJSON() {
    return {
      id: this.id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      role: this.role,
      phoneNumber: this.phoneNumber,
      isActive: this.isActive,
      isVerified: this.isVerified,
      lastLoginAt: this.lastLoginAt,
      createdAt: this.createdAt
    };
  }

  isLocked() {
    if (!this.lockedUntil) return false;
    return new Date(this.lockedUntil) > new Date();
  }

  static async findById(db, id) {
    const result = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  static async findByEmail(db, email) {
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  static async create(db, userData) {
    const result = await db.query(
      `INSERT INTO users (
        email, password_hash, first_name, last_name, role, phone_number, is_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        userData.email.toLowerCase(),
        userData.passwordHash,
        userData.firstName,
        userData.lastName,
        userData.role || ROLES.CITIZEN,
        userData.phoneNumber,
        userData.isVerified || false
      ]
    );
    return new User(result.rows[0]);
  }

  static async updatePassword(db, userId, passwordHash) {
    const result = await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [passwordHash, userId]
    );
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  static async incrementFailedAttempts(db, userId) {
    const result = await db.query(
      `UPDATE users 
       SET failed_login_attempts = failed_login_attempts + 1,
           locked_until = CASE 
             WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '30 minutes'
             ELSE locked_until
           END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [userId]
    );
    return result.rows[0] ? new User(result.rows[0]) : null;
  }

  static async resetFailedAttempts(db, userId) {
    const result = await db.query(
      `UPDATE users 
       SET failed_login_attempts = 0,
           locked_until = NULL,
           last_login_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [userId]
    );
    return result.rows[0] ? new User(result.rows[0]) : null;
  }
}

module.exports = User;
