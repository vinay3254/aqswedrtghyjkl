# API Security Best Practices

**Project:** Ambulance Dispatch System  
**Last Updated:** 2024  

---

## Overview

This document outlines the security best practices implemented for the Ambulance Dispatch System API.

---

## 1. Authentication & Authorization

### JWT Implementation

**Token Structure:**
```
Header.Payload.Signature
```

**Requirements:**
- JWT signed with HS256 algorithm
- Access tokens expire in 1 hour
- Refresh tokens expire in 7 days
- Tokens must be verified on every request
- Token claims must include user role and permissions

### Bearer Token

```
Authorization: Bearer <jwt_token>
```

**Implementation:**
- Tokens sent via Authorization header (not in URL)
- Secure token storage (httpOnly cookies for web)
- Token rotation on refresh
- Explicit logout invalidates tokens

### Role-Based Access Control (RBAC)

**Defined Roles:**

| Role | Permissions | Scope |
|------|-----------|-------|
| **admin** | All operations, user management, system config | System-wide |
| **dispatcher** | Call management, resource allocation | Regional |
| **operator** | Ambulance assignment, status updates | Assigned region |
| **driver** | Location tracking, status updates | Assigned vehicle |
| **viewer** | Read-only access to assigned data | Limited |

---

## 2. Input Validation & Sanitization

### Schema Validation

All requests validated against schemas:

**Requirements:**
- JSON Schema validation on request body
- URL parameter validation
- Query parameter validation
- Type coercion disabled
- Unknown fields rejected

### Input Sanitization

- String length limits enforced
- Dangerous characters removed
- Email format validated
- Phone numbers validated

### SQL Injection Prevention

**Parameterized Queries:**
- Using parameterized queries
- ORM (Sequelize) for queries
- No string concatenation
- Input validation enforced

---

## 3. Rate Limiting & Throttling

### Global Rate Limiting

- 15-minute window
- 100 requests per window
- Admin bypass available

### Strict Endpoint Limits

**Authentication endpoint:** 5 attempts per 15 minutes
**API endpoints:** 10 requests per second

---

## 4. CORS (Cross-Origin Resource Sharing)

### Configuration

**Allowed Origins:**
- https://ambulance-dispatch.com
- https://app.ambulance-dispatch.com

**Allowed Methods:** GET, POST, PUT, DELETE, PATCH
**Allowed Headers:** Content-Type, Authorization
**Credentials:** Enabled (httpOnly cookies)

---

## 5. Security Headers

### HTTPS & SSL/TLS

- Enforce HTTPS only
- Redirect HTTP to HTTPS
- TLS 1.2 minimum

### Security Headers Implemented

| Header | Value |
|--------|-------|
| Strict-Transport-Security | max-age=31536000 |
| Content-Security-Policy | default-src 'self' |
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |
| X-XSS-Protection | 1; mode=block |
| Referrer-Policy | strict-origin-when-cross-origin |

---

## 6. CSRF Protection

### Token-Based CSRF Protection

- CSRF tokens generated for forms
- Token verified on state-changing requests
- Token rotation on sensitive operations

### SameSite Cookies

```
httpOnly: true
secure: true
sameSite: Strict
```

---

## 7. Data Protection

### Request/Response Encryption

- Sensitive data in responses over HTTPS only
- Never log sensitive data
- Sanitize all error messages

### Payload Size Limits

- JSON: 10KB max
- URL-encoded: 10KB max

### Request Timeout

- 30 seconds maximum
- Configurable by endpoint

---

## 8. API Versioning

### Version Strategy

```
GET /api/v1/calls
GET /api/v2/calls
```

**Requirements:**
- Version in URL path
- Support at least 2 major versions
- Deprecation notices 6 months before removal
- Breaking changes only in major versions

---

## 9. Error Handling & Logging

### Safe Error Responses

- No stack traces to client
- Generic error messages for security
- Request ID for support reference
- Detailed logging internally

### Audit Logging

- Authentication events
- Authorization failures
- Data access
- Administrative actions
- Timestamp, user ID, IP address

---

## 10. Third-Party API Security

### External API Calls

- Timeouts configured (5 seconds)
- SSL/TLS validation enforced
- API keys stored securely
- Response validation

**Requirements:**
- Rate limiting on outbound calls
- API keys in environment variables
- No hardcoded credentials

---

## 11. Dependency Management

### Security Updates

```bash
npm audit          # Check vulnerabilities
npm audit fix      # Fix automatically
npm outdated       # Review updates
npm update --save  # Update dependencies
```

### Key Dependencies

- Express.js - Web framework
- jsonwebtoken - JWT handling
- bcryptjs - Password hashing
- Sequelize - ORM
- axios - HTTP client
- helmet - Security headers
- express-rate-limit - Rate limiting

---

## 12. Deployment Checklist

- [ ] Environment variables configured
- [ ] HTTPS/TLS enabled
- [ ] Rate limiting active
- [ ] CORS configured
- [ ] Security headers enabled
- [ ] CSRF protection enabled
- [ ] Input validation enforced
- [ ] Logging configured
- [ ] Error handling safe
- [ ] Dependencies updated
- [ ] Vulnerability scan passed
- [ ] WAF rules configured

---

## References

- OWASP API Security Top 10
- Express.js Security Best Practices
- JWT Best Practices (RFC 8725)
- OAuth 2.0 Security Best Practices
