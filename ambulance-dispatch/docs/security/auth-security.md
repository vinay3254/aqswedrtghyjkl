# Authentication & Authorization Security

**Project:** Ambulance Dispatch System  
**Last Updated:** 2024  

---

## Overview

This document details authentication and authorization mechanisms for the Ambulance Dispatch System.

---

## 1. JWT (JSON Web Token) Security

### JWT Structure & Format

**Three Parts:** Header.Payload.Signature

**Header:**
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

**Payload (Claims):**
```json
{
  "sub": "user-id-12345",
  "iss": "ambulance-dispatch-system",
  "aud": "api.ambulance-dispatch.com",
  "iat": 1609459200,
  "exp": 1609462800,
  "role": "dispatcher",
  "permissions": ["call:read", "call:create"]
}
```

**Signature:**
```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  process.env.JWT_SECRET
)
```

### Token Configuration

**Requirements:**
- Algorithm: HS256
- Issuer: ambulance-dispatch-system
- Audience: api.ambulance-dispatch.com
- Access token expiry: 1 hour
- Refresh token expiry: 7 days

### Token Storage (Client-Side)

**SECURE (httpOnly Cookie):**
```
httpOnly: true
secure: true (HTTPS only)
sameSite: strict (CSRF protection)
maxAge: 3600000 (1 hour)
```

**NOT SECURE:**
- localStorage (vulnerable to XSS)
- sessionStorage (vulnerable to XSS)

### Token Verification

**Verification Steps:**
1. Check signature validity
2. Verify issuer and audience
3. Check token expiration
4. Validate required claims
5. Verify token not blacklisted

**On Every Request:**
- Authorization header parsed
- Token signature verified
- Token claims validated
- User permissions checked

### Token Refresh Flow

**Process:**
1. Access token expires
2. Client sends refresh token
3. Server validates refresh token
4. New access token generated
5. Refresh token rotation optional

**Refresh Token:**
- Stored separately
- Longer expiration (7 days)
- Cannot be used for API calls
- Can be blacklisted

---

## 2. Session Management

### Session Configuration

**Storage:** Redis

**Configuration:**
- Secret: process.env.SESSION_SECRET
- httpOnly: true (prevent JavaScript access)
- secure: true (HTTPS only)
- sameSite: strict (CSRF protection)
- maxAge: 1800000 (30 minutes)

### Session Data

**Minimal Information Stored:**
- Session ID
- User ID
- User role
- Login timestamp
- Last activity timestamp

**NOT Stored:**
- Passwords
- Personal data
- Sensitive information
- Full authorization details

### Session Security Middleware

**Session Validation:**
1. Check session exists
2. Verify session not expired
3. Validate token matches session
4. Check user permissions
5. Update last activity

### Session Fixation Prevention

**Process:**
1. Authenticate user
2. Destroy old session
3. Regenerate new session ID
4. Set new session data
5. Return new session cookie

**Implementation:**
- Session ID regeneration on login
- Secure ID generation
- Old session invalidation

### Session Timeout

**Activity Tracking:**
- Last activity timestamp updated
- 30-minute inactivity timeout
- Automatic session destruction
- Re-authentication required

### Logout & Session Destruction

**Process:**
1. Blacklist access token
2. Invalidate refresh token
3. Destroy session
4. Clear session cookie
5. Log logout event

**Token Blacklist:**
- Redis TTL expiration
- Matches token lifetime
- Checked on all requests

---

## 3. Password Security

### Password Requirements

**Complexity:**
- Minimum 12 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character

**Validation:**
- No common passwords (blacklist)
- No dictionary words
- No user information
- No repeated characters

### Password Hashing

**Algorithm:** bcryptjs
**Salt Rounds:** 12
**Storage:** Hashed only, never plaintext

**Password Verification:**
- bcrypt.compare() for verification
- Timing-safe comparison
- Failed attempts logged

### Password Change

**Requirements:**
- Current password verification required
- New password validation
- Password history check (prevent reuse)
- 5 previous passwords tracked

### Password Reset

**Process:**
1. Email-based reset link
2. Secure token generation (SHA256)
3. Token expiration (1 hour)
4. Single-use token
5. Hashed token storage

**Reset Link:**
```
https://app.ambulance-dispatch.com/reset-password?token=<secure-token>
```

**Validation:**
- Token authenticity verified
- Token not expired
- Token not already used
- New password validation
- Password history check

### Password Expiration & History

**Expiration Policy:**
- 90 days maximum age
- Expiration notification at 14 days
- Forced change on expiration

**Password History:**
- Last 5 passwords tracked
- Reuse prevented
- Hashed comparison

---

## 4. Multi-Factor Authentication (MFA)

### TOTP (Time-based One-Time Password)

**Implementation:**
- Authenticator app support (Google, Authy, Microsoft)
- 6-digit codes
- 30-second validity window
- 2-second time window for clock skew

**Enable Process:**
1. Generate secret key
2. Generate QR code
3. User scans QR code
4. User enters verification code
5. MFA enabled

**Login Process:**
1. Username and password
2. MFA code requested
3. 6-digit code verification
4. Access granted on success

### Backup Codes

**Generation:**
- 10 unique backup codes
- 8-character format
- Generated during MFA setup
- Shown once (user saves)

**Usage:**
- One-time use only
- Single-use tokens
- Used when TOTP unavailable
- Marks code as consumed

**Recovery:**
- Contact support for new codes
- Verify identity
- Generate new codes
- Old codes invalidated

### MFA Enforcement

**Required For:**
- Admin users (mandatory)
- Users with sensitive access
- Users handling ePHI
- High-privilege accounts

**Optional For:**
- Regular users
- Viewers with read-only access

---

## 5. Account Lockout & Brute Force Protection

### Failed Login Attempts

**Tracking:**
- Recorded with email/IP
- 15-minute window
- Maximum 5 failed attempts
- Account lockout triggered

**Lockout Mechanism:**
- 15-minute temporary lockout
- Account locked field updated
- Subsequent login attempts rejected
- Lockout cleared after duration

**User Notification:**
- Email notification on lockout
- Account recovery instructions
- Support contact information

### Brute Force Mitigation

**Rate Limiting:**
- 5 login attempts per 15 minutes
- Per email address
- Per IP address
- Combined tracking

**Attack Detection:**
- Multiple failed attempts alert
- Suspicious IP tracking
- Geographic anomaly detection
- Device fingerprinting

---

## 6. Role-Based Access Control (RBAC)

### Defined Roles

| Role | Permissions | Scope |
|------|-----------|-------|
| **Admin** | Full system access | System-wide |
| **Dispatcher** | Call management, resource allocation | Regional |
| **Operator** | Ambulance assignment | Assigned region |
| **Driver** | Location, status updates | Assigned vehicle |
| **Viewer** | Read-only access | Limited |

### Permission Mapping

**Permissions Structure:**
```
resource:action
```

**Examples:**
- call:read
- call:create
- call:update
- resource:assign
- user:create
- report:read

### Access Control Lists (ACL)

**Implementation:**
- Middleware-based authorization
- Per-route validation
- Per-resource validation
- Permission inheritance

**Enforcement:**
```
Authorization Header → Token Verification → 
Permission Check → Route Handler → 
Resource Validation → Operation
```

### Privilege Escalation Prevention

**Checks:**
- Cannot change own role
- Cannot grant higher privileges
- Admin approval required for role changes
- Audit logging of all changes

---

## 7. OAuth 2.0 Integration (Optional)

**Support For:**
- Google OAuth
- Microsoft OAuth
- SAML 2.0

**Local Strategy:**
- Email and password
- Primary authentication method

**Social Login:**
- Email verification required
- Account linking available
- Password change required

---

## 8. Token Security Best Practices

### Token Expiration

**Access Token:** 1 hour
**Refresh Token:** 7 days
**MFA Code:** 30 seconds
**Password Reset:** 1 hour
**Email Verification:** 24 hours

### Token Blacklisting

**Implementation:**
- Redis-based blacklist
- TTL matches token expiration
- Checked on every request
- Logout invalidates token

### Token Rotation

**Refresh Token Rotation:**
- Optional on each refresh
- Reduces token lifetime exposure
- Invalidates old token
- New refresh token issued

---

## 9. Authentication Audit Logging

**Logged Events:**
- login_success
- login_failure
- logout
- password_change
- password_reset
- mfa_enable
- mfa_disable
- token_refresh
- access_denied
- role_change

**Log Details:**
- Timestamp
- User ID/email
- Event type
- IP address
- User agent
- Success/failure reason

---

## References

- JWT Best Practices: RFC 8725
- OWASP Authentication Cheat Sheet
- OAuth 2.0 Security Best Practices
- NIST Digital Identity Guidelines
