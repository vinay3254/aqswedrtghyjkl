# Data Protection & Encryption

**Project:** Ambulance Dispatch System  
**Last Updated:** 2024  

---

## Overview

This document outlines data protection measures for the Ambulance Dispatch System, with special attention to PII and healthcare data.

---

## 1. Data Classification

### Classification Levels

#### Level 1: Public
- General information, published documentation

#### Level 2: Confidential
- Internal business information, non-critical operational data

#### Level 3: Restricted
- Patient data (PII), Personal health information (PHI)
- Authentication credentials, System access credentials

#### Level 4: Highly Restricted
- Electronic Protected Health Information (ePHI)
- Sensitive authentication tokens, Encryption keys

---

## 2. PII (Personally Identifiable Information) Handling

### Identified PII Elements

| Data Element | Classification | Encryption | Retention |
|--------------|-----------------|-----------|-----------|
| Name | Restricted | Yes | Active |
| Phone Number | Restricted | Yes | Active |
| Email | Restricted | Yes | Active |
| Social Security Number | Highly Restricted | Yes | Active |
| Date of Birth | Restricted | Yes | Active |
| Address | Restricted | Yes | Active |
| Insurance ID | Restricted | Yes | Billing only |
| Medical History | Highly Restricted | Yes | Active |
| Medication List | Highly Restricted | Yes | Active |
| Emergency Contact | Restricted | Yes | Active |
| GPS Location | Restricted | Yes | 30 days |

### PII Minimization

- Only collect necessary PII
- Data access principle: Only request/display what's needed
- Role-based data views (dispatcher, paramedic, driver)
- Exclude unnecessary fields (SSN, full medical history, payment data)

---

## 3. Encryption at Rest

### Database Encryption

#### Field-Level Encryption

**Algorithm:** AES-256-GCM
**Key Management:** Environment variables (32 bytes)
**Implementation:** Sequelize models with encryption hooks

**Encrypted Fields:**
- Patient names (first, last)
- Phone numbers
- Email addresses
- SSN/Medical ID
- Home addresses
- Medical history
- Medication information
- Insurance information

#### Database-Level Encryption

- PostgreSQL pgcrypto extension
- Transparent Data Encryption (TDE)
- Enabled at database creation time

#### Backup Encryption

- S3 server-side encryption (AES256)
- Encrypted key management
- Compression enabled

---

## 4. Encryption in Transit

### HTTPS/TLS Configuration

**Requirements:**
- TLS 1.2 minimum (TLS 1.3 preferred)
- Strong cipher suites only
- Certificate validation enabled

**Cipher Suites:**
- ECDHE-ECDSA-AES128-GCM-SHA256
- ECDHE-RSA-AES128-GCM-SHA256
- ECDHE-ECDSA-AES256-GCM-SHA384
- ECDHE-RSA-AES256-GCM-SHA384

### Certificate Management

- Let's Encrypt certificates
- Auto-renewal enabled
- Certificate details monitored

### WebSocket Encryption (WSS)

- WSS (Secure WebSocket) enforced
- TLS/SSL automatically handled
- End-to-end encryption

### API Client HTTPS Enforcement

- Certificate verification enabled
- TLS version specified
- Timeout configured

---

## 5. Password Storage

### Bcrypt Implementation

**Configuration:**
- Salt rounds: 12
- Algorithm: bcryptjs
- No plaintext passwords stored

**Password Requirements:**
- Minimum 12 characters
- Mix of uppercase, lowercase, numbers, symbols
- No dictionary words
- No repeated characters

### Password Management

- Password hashing on registration
- Secure comparison on login
- Password change with current password verification
- Password reset via email token
- Token expiration: 1 hour
- Password history: Prevent reuse

---

## 6. Secrets Management

### Environment Variables

**Protected in .env (not committed):**
- DATABASE_URL
- JWT_SECRET
- ENCRYPTION_KEY
- API_KEY_EXTERNAL
- REFRESH_TOKEN_SECRET

### .gitignore Protection

```
.env
.env.local
.env.*.local
*.pem
*.key
*.p12
secrets/
```

### Secrets Rotation

- Quarterly key rotation
- Gradual rollover with dual keys
- 30-day overlap period
- Old key disabled after overlap

### HashiCorp Vault Integration (Production)

- Vault for secret storage
- Dynamic secret generation
- Automatic rotation

---

## 7. Data Retention & Deletion

### Retention Policy

| Data Type | Retention Period | Deletion Method |
|-----------|------------------|-----------------|
| Active Patient Records | Indefinite | Secure wipe |
| Inactive Patient Records | 7 years | HIPAA compliance |
| Call Logs | 90 days | Secure wipe |
| Audit Logs | 2 years | Compliance |
| Session Tokens | Until expiry | Auto-expire |
| Failed Login Attempts | 30 days | Auto-delete |
| Temporary Uploads | 24 hours | Auto-delete |

### Data Deletion Implementation

**GDPR Right to Be Forgotten:**
- Secure deletion of user data
- Deletion of call records
- User account deletion
- Audit logging of deletion
- Transaction rollback on failure

**Secure File Deletion:**
- Overwrite with random data (3 passes)
- Cryptographic secure deletion

---

## 8. Data Access Controls

### Role-Based Data Access

**Dispatcher:**
- View only assigned region's data
- Last 30 days of calls
- Limited patient information

**Driver:**
- View only assigned ambulance's calls
- Current and in-progress calls
- Limited patient information

**Admin:**
- Access to all data
- Audit controls applied

### Data Audit Trail

**Logged Events:**
- All sensitive data access
- User, timestamp, IP address
- Data type and record ID

**Anomalous Access Detection:**
- Threshold-based alerts
- Unusual access patterns
- Real-time monitoring

---

## 9. Data Breach Response

### Incident Response Plan

1. **Detect** - Automated alerts, monitoring
2. **Contain** - Revoke credentials, isolate systems
3. **Investigate** - Determine scope, review logs
4. **Notify** - HIPAA breach notification (if applicable)
5. **Remediate** - Patch vulnerabilities, reset credentials

### Breach Notification Requirements

**Timeline:** Within 60 days of discovery

**Who to Notify:**
- Affected individuals
- Media (if 500+ records affected)
- HHS Secretary (U.S. federal requirement)

**Content:**
- Date and nature of breach
- Information affected
- Steps taken to secure
- Recommended actions
- Contact information

---

## 10. Third-Party Data Processing

### Data Processing Agreements (DPA)

**Requirements:**
- Business Associate Agreement (BAA) for healthcare data
- Data Protection Addendum (DPA) for GDPR
- Security assessment before integration
- Annual compliance reviews

### Vendor Security Checklist

- [ ] SOC 2 Type II certification
- [ ] HIPAA BAA in place
- [ ] Encryption in transit and at rest
- [ ] Regular security audits
- [ ] Incident response procedures
- [ ] Data deletion on contract end
- [ ] Subprocessor notification
- [ ] No unauthorized data usage

---

## 11. Compliance Standards

### HIPAA Requirements

**Privacy Rule (45 CFR Part 164):**
- Notice of Privacy Practices
- Patient rights to access/amend
- Minimum necessary principle

**Security Rule (45 CFR Part 164):**
- Administrative safeguards
- Physical safeguards
- Technical safeguards
- Encryption of ePHI
- Access controls
- Audit logging

### GDPR Requirements

**Data Protection Principles:**
- Lawfulness, fairness, transparency
- Purpose limitation
- Data minimization
- Accuracy
- Storage limitation
- Integrity and confidentiality
- Accountability

**Rights:**
- Right to access
- Right to rectification
- Right to erasure ("right to be forgotten")
- Right to restrict processing
- Right to data portability

---

## 12. Data Protection Monitoring

### Real-Time Monitoring

**Metrics Tracked:**
- Data access events
- Encryption/decryption errors
- Unusual access patterns
- System performance

**Alert Thresholds:**
- Bulk data access: 1000 events per hour
- Failed decryption: 10 events per 5 minutes
- Unauthorized access: Immediate alert

---

## References

- HIPAA Security Rule: https://www.hhs.gov/hipaa/for-professionals/security/
- GDPR Data Protection: https://gdpr-info.eu/
- OWASP Data Protection: https://owasp.org/www-project-top-ten/
- NIST Encryption Standards: SP 800-53
