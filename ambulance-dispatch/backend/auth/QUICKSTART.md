# Authentication System Quick Start

## Installation

```bash
cd backend/auth
npm install
```

## Environment Setup

Create a `.env` file:

```env
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
DATABASE_URL=postgresql://user:password@localhost:5432/ambulance_db
```

## Database Setup

```bash
# Run the schema
psql -U your_user -d ambulance_db -f schema.sql
```

Or using your database client:
```sql
-- Copy and paste contents of schema.sql
```

## Quick Test

```bash
node test-auth.js
```

Expected output:
```
🧪 Testing Authentication System

1️⃣  Testing password hashing...
   ✅ Hash: $2b$12$...
   ✅ Valid password: true
   ✅ Invalid password: true

2️⃣  Testing password strength validation...
   ✅ Weak password rejected: true
   ✅ Strong password accepted: true

... etc
```

## Integration

```javascript
// In your main app.js or server.js
const express = require('express');
const createAuthRoutes = require('./auth/routes');
const { requireAuth, requireRole } = require('./auth/middleware');
const { ROLES } = require('./auth/config/roles');

const app = express();
const db = require('./db'); // Your PostgreSQL connection

// Mount auth routes
app.use('/api/auth', createAuthRoutes(db));

// Protect routes
app.get('/protected', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.post('/admin-only', 
  requireAuth, 
  requireRole(ROLES.ADMIN), 
  (req, res) => {
    res.json({ message: 'Admin access granted' });
  }
);
```

## API Testing

### Register
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "role": "CITIZEN"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

### Get Current User
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Default Admin Account

Email: `admin@ambulance.local`
Password: `Admin123!`

**⚠️ CHANGE THIS IMMEDIATELY IN PRODUCTION!**

## File Structure

```
auth/
├── config/
│   └── roles.js           # Role and permission definitions
├── models/
│   └── User.js            # User model
├── utils/
│   ├── jwt.js             # JWT token utilities
│   └── password.js        # Password hashing utilities
├── controller.js          # Request handlers
├── middleware.js          # Auth middleware
├── routes.js              # Route definitions
├── service.js             # Business logic
├── schema.sql             # Database schema
├── index.js               # Main export
├── package.json           # Dependencies
├── README.md              # Full documentation
├── QUICKSTART.md          # This file
├── test-auth.js           # Quick test script
└── example-server.js      # Integration example
```

## Common Issues

### "bcrypt not found"
```bash
npm install bcrypt
```

### "jsonwebtoken not found"
```bash
npm install jsonwebtoken
```

### Database connection error
Check your DATABASE_URL in .env

### JWT verification fails
Make sure JWT_SECRET matches between token generation and verification

## Security Checklist

- [ ] Change JWT_SECRET and JWT_REFRESH_SECRET
- [ ] Change default admin password
- [ ] Enable HTTPS in production
- [ ] Set up CORS properly
- [ ] Configure rate limiting
- [ ] Enable database connection pooling
- [ ] Set up logging and monitoring
- [ ] Configure backup strategy

## Support

See full documentation in `README.md`
