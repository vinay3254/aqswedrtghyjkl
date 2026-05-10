# Authentication & Authorization System

## Overview

Complete authentication and authorization system for the Ambulance Dispatch System with JWT-based authentication, role-based access control (RBAC), and comprehensive security features.

## Features

### Authentication
- User registration with email/password
- Secure login with JWT tokens
- Password hashing using bcrypt (12 rounds)
- JWT token generation (access + refresh)
- Token refresh mechanism
- Password reset flow with secure tokens
- Account lockout after 5 failed attempts (30 min)
- Session management
- Audit logging for all auth events

### Authorization (RBAC)
- 5 roles: CITIZEN, DISPATCHER, DRIVER, HOSPITAL_STAFF, ADMIN
- Permission-based access control
- Role hierarchy (ADMIN has all permissions)
- Middleware for route protection
- Resource ownership checks

### Security Features
- Password strength validation (8+ chars, uppercase, lowercase, numbers, special chars)
- Account lockout after failed login attempts
- JWT expiration (15 min access, 7 day refresh tokens)
- Secure password reset tokens (1 hour expiry)
- Rate limiting on auth endpoints
- Audit logging for security events
- Bcrypt password hashing with salt rounds

## API Endpoints

### POST /api/auth/register
Register a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+1234567890",
  "role": "CITIZEN"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "CITIZEN",
      "isActive": true,
      "isVerified": false
    },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc...",
      "expiresIn": "15m"
    }
  }
}
```

### POST /api/auth/login
Authenticate and receive JWT tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc...",
      "expiresIn": "15m"
    }
  }
}
```

### POST /api/auth/refresh-token
Get new access token using refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGc..."
}
```

### POST /api/auth/logout
Logout and invalidate session.

**Headers:**
```
Authorization: Bearer <access_token>
```

### POST /api/auth/forgot-password
Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

### POST /api/auth/reset-password
Reset password using token.

**Request:**
```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewSecurePass123!"
}
```

### PUT /api/auth/change-password
Change password (requires authentication).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass123!"
}
```

### GET /api/auth/me
Get current authenticated user info.

**Headers:**
```
Authorization: Bearer <access_token>
```

## Roles & Permissions

### CITIZEN
- Create incident
- Track own incident

### DISPATCHER
- View all incidents
- Assign ambulances
- Override assignments
- View analytics
- View incoming patients

### DRIVER
- View own assignments
- Update location
- Update driver status
- Update ambulance status

### HOSPITAL_STAFF
- View incoming patients
- Update bed availability
- Confirm arrivals
- View ambulances

### ADMIN
- Full access to all permissions
- Manage users
- System configuration

## Middleware Usage

### requireAuth
Protect routes that require authentication.

```javascript
const { requireAuth } = require('./auth/middleware');

router.get('/protected', requireAuth, (req, res) => {
  // req.user contains: { userId, email, role, type }
  res.json({ user: req.user });
});
```

### requireRole
Restrict access to specific roles.

```javascript
const { requireAuth, requireRole } = require('./auth/middleware');
const { ROLES } = require('./auth/config/roles');

router.post('/dispatch',
  requireAuth,
  requireRole([ROLES.DISPATCHER, ROLES.ADMIN]),
  dispatchController.assignAmbulance
);
```

### requirePermission
Check specific permissions.

```javascript
const { requireAuth, requirePermission } = require('./auth/middleware');
const { PERMISSIONS } = require('./auth/config/roles');

router.get('/analytics',
  requireAuth,
  requirePermission(PERMISSIONS.VIEW_ANALYTICS),
  analyticsController.getStats
);
```

### checkOwnership
Ensure users can only access their own resources.

```javascript
const { requireAuth, checkOwnership } = require('./auth/middleware');

router.get('/incidents/:userId',
  requireAuth,
  checkOwnership('userId'),
  incidentController.getUserIncidents
);
```

### rateLimiter
Rate limit endpoints to prevent abuse.

```javascript
const { rateLimiter } = require('./auth/middleware');

router.post('/sensitive-action',
  rateLimiter({ windowMs: 60000, maxRequests: 5 }),
  controller.action
);
```

## Database Schema

### users table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'CITIZEN',
  phone_number VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### password_reset_tokens table
```sql
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);
```

### refresh_tokens table (optional)
```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id VARCHAR(255),
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### auth_audit_log table
```sql
CREATE TABLE auth_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event VARCHAR(100) NOT NULL,
  metadata JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Environment Variables

Required environment variables:

```env
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production
```

## Security Best Practices

1. **JWT Secrets**: Change default JWT secrets in production
2. **HTTPS**: Always use HTTPS in production
3. **Rate Limiting**: Implement rate limiting on all auth endpoints
4. **Password Policy**: Enforce strong password requirements
5. **Account Lockout**: Lock accounts after failed attempts
6. **Audit Logging**: Log all authentication events
7. **Token Expiry**: Use short-lived access tokens (15 min)
8. **Refresh Tokens**: Store refresh tokens securely
9. **CORS**: Configure CORS properly for your frontend
10. **Input Validation**: Validate all user inputs

## Usage Example

```javascript
// app.js or server.js
const express = require('express');
const createAuthRoutes = require('./auth/routes');
const { requireAuth, requireRole } = require('./auth/middleware');
const { ROLES } = require('./auth/config/roles');

const app = express();
const db = require('./db'); // Your database connection

// Mount auth routes
app.use('/api/auth', createAuthRoutes(db));

// Protected routes
app.get('/api/incidents', 
  requireAuth,
  incidentController.list
);

app.post('/api/ambulances/assign',
  requireAuth,
  requireRole([ROLES.DISPATCHER, ROLES.ADMIN]),
  ambulanceController.assign
);
```

## Error Handling

All auth endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Common error codes:
- `400`: Bad request (validation error)
- `401`: Unauthorized (invalid credentials or token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not found
- `429`: Too many requests (rate limit)
- `500`: Internal server error

## Testing

Test user accounts for each role:

```javascript
// Create test users
const testUsers = [
  { email: 'citizen@test.com', role: 'CITIZEN' },
  { email: 'dispatcher@test.com', role: 'DISPATCHER' },
  { email: 'driver@test.com', role: 'DRIVER' },
  { email: 'hospital@test.com', role: 'HOSPITAL_STAFF' },
  { email: 'admin@test.com', role: 'ADMIN' }
];
```

## Maintenance

### Cleanup expired tokens
```sql
DELETE FROM password_reset_tokens WHERE expires_at < NOW() OR used = true;
DELETE FROM refresh_tokens WHERE expires_at < NOW();
```

### Unlock accounts manually
```sql
UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = 'user_id';
```

### View audit logs
```sql
SELECT * FROM auth_audit_log 
WHERE user_id = 'user_id' 
ORDER BY created_at DESC 
LIMIT 100;
```
