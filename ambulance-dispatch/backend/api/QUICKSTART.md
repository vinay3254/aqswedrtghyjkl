# API Gateway - Quick Start Guide

## Installation

```bash
cd backend/api
npm install
```

## Setup

1. **Create PostgreSQL Database**

```sql
CREATE DATABASE ambulance_dispatch;

\c ambulance_dispatch

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

2. **Configure Environment**

```bash
cp .env.example .env
# Edit .env with your actual values
```

Required environment variables:
- `JWT_SECRET` - Secret key for JWT tokens (use a strong random string)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - PostgreSQL connection
- `REDIS_HOST`, `REDIS_PORT` - Redis connection

3. **Start Redis**

```bash
redis-server
```

4. **Run the Server**

```bash
# Development
npm run dev

# Production
npm start
```

## Testing the API

### 1. Register a User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dispatcher@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+1234567890",
    "role": "dispatcher"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dispatcher@example.com",
    "password": "SecurePass123!"
  }'
```

Save the `token` from the response.

### 3. Create an Incident

```bash
curl -X POST http://localhost:3000/api/incidents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "address": "123 Main St, New York, NY"
    },
    "severity": "high",
    "description": "Patient experiencing chest pain and difficulty breathing",
    "contactNumber": "+1234567890",
    "patientInfo": {
      "name": "Jane Smith",
      "age": 45,
      "gender": "female"
    }
  }'
```

### 4. Check Health

```bash
curl http://localhost:3000/health
```

## API Endpoints Overview

### Core Endpoints

| Category | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| **Auth** | POST | `/api/auth/register` | Register user |
| **Auth** | POST | `/api/auth/login` | Login user |
| **Incidents** | POST | `/api/incidents` | Create emergency |
| **Incidents** | GET | `/api/incidents/:id` | Get incident |
| **Incidents** | PUT | `/api/incidents/:id/status` | Update status |
| **Ambulances** | GET | `/api/ambulances` | List ambulances |
| **Ambulances** | PUT | `/api/ambulances/:id/location` | Update GPS |
| **Hospitals** | GET | `/api/hospitals/nearby` | Find nearby |
| **Assignments** | POST | `/api/assignments` | Create assignment |
| **Health** | GET | `/health` | Health check |

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│            API Gateway (Port 3000)                │
│  ┌──────────────────────────────────────────┐   │
│  │  Middleware Layer                         │   │
│  │  • Authentication (JWT)                   │   │
│  │  • Authorization (RBAC)                   │   │
│  │  • Validation (express-validator)         │   │
│  │  • Rate Limiting                          │   │
│  │  • Logging                                │   │
│  │  • Error Handling                         │   │
│  └──────────────────────────────────────────┘   │
│                                                   │
│  ┌──────────────────────────────────────────┐   │
│  │  Routes                                   │   │
│  │  /api/auth/*                              │   │
│  │  /api/incidents/*                         │   │
│  │  /api/ambulances/*                        │   │
│  │  /api/hospitals/*                         │   │
│  │  /api/assignments/*                       │   │
│  │  /api/drivers/*                           │   │
│  │  /api/tracking/*                          │   │
│  │  /api/analytics/*                         │   │
│  └──────────────────────────────────────────┘   │
└──────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│           External Services (Microservices)       │
│  • Incident Service (3010)                        │
│  • Ambulance Service (3011)                       │
│  • Hospital Service (3012)                        │
│  • Tracking Service (3013)                        │
│  • Analytics Service (3014)                       │
└──────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────┐
│           Data Layer                              │
│  • PostgreSQL (5432)                              │
│  • Redis (6379)                                   │
└──────────────────────────────────────────────────┘
```

## Security Features

### 1. JWT Authentication
- Access tokens expire in 24 hours
- Refresh tokens expire in 7 days
- Token blacklisting on logout

### 2. Password Security
- bcrypt hashing with 10 rounds
- Minimum password requirements enforced

### 3. Rate Limiting
- Default: 100 requests per 15 minutes
- Auth endpoints: 10 requests per 15 minutes
- Emergency creation: 10 requests per minute

### 4. Input Validation
- All inputs validated using express-validator
- SQL injection prevention via parameterized queries
- XSS protection via sanitization

### 5. Security Headers (Helmet.js)
- Content Security Policy
- HSTS
- X-Frame-Options
- X-Content-Type-Options

## Monitoring

### Logs
Logs are stored in the `logs/` directory:
- `combined-YYYY-MM-DD.log` - All logs
- `error-YYYY-MM-DD.log` - Error logs only
- `exceptions-YYYY-MM-DD.log` - Uncaught exceptions
- `rejections-YYYY-MM-DD.log` - Unhandled rejections

### Metrics
Access at `/metrics` (requires admin token):
```bash
curl http://localhost:3000/metrics \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

Returns:
- Request count by endpoint/method
- Average response time
- Error count
- Status code distribution
- Memory usage
- Uptime

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
psql -U postgres -l

# Test connection
psql -h localhost -U postgres -d ambulance_dispatch
```

### Redis Connection Issues
```bash
# Check Redis is running
redis-cli ping
# Should return PONG
```

### Port Already in Use
```bash
# Windows - Find process on port 3000
netstat -ano | findstr :3000

# Kill process
taskkill /PID <PID> /F
```

## Development

### Adding New Routes

1. Create route file in `routes/`
2. Implement route handlers
3. Add validation middleware
4. Import in `server.js`
5. Register route

Example:
```javascript
// routes/myroute.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  // Handle request
});

module.exports = router;
```

```javascript
// server.js
const myRoute = require('./routes/myroute');
app.use('/api/myroute', myRoute);
```

### Adding Middleware

Create middleware in `middleware/` directory:

```javascript
// middleware/myMiddleware.js
const myMiddleware = (req, res, next) => {
  // Middleware logic
  next();
};

module.exports = myMiddleware;
```

## Production Deployment

### Environment Variables
Set all required environment variables:
- `NODE_ENV=production`
- Strong `JWT_SECRET`
- Production database credentials
- Production Redis credentials

### Process Management
Use PM2 for process management:

```bash
npm install -g pm2

pm2 start server.js --name api-gateway
pm2 startup
pm2 save
```

### Reverse Proxy
Configure Nginx:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL/TLS
Use Let's Encrypt:

```bash
certbot --nginx -d api.yourdomain.com
```

## Support

For issues or questions:
- Check logs in `logs/` directory
- Verify environment configuration
- Check health endpoint: `/health`
- Review error messages

---

**Ready to handle emergencies! 🚑**
