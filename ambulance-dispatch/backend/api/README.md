# Ambulance Dispatch System - API Gateway

Production-ready API Gateway for the Ambulance Dispatch System. Built with Express.js, providing centralized authentication, rate limiting, request validation, and routing to microservices.

## 🚀 Features

- **JWT Authentication** - Secure token-based authentication with refresh tokens
- **Role-Based Access Control (RBAC)** - Fine-grained permission management
- **Request Validation** - Input validation using express-validator
- **Rate Limiting** - Configurable rate limits per endpoint
- **CORS Support** - Secure cross-origin resource sharing
- **Health Checks** - Comprehensive health monitoring endpoints
- **Metrics Collection** - Request count, response times, error tracking
- **Error Handling** - Centralized error handling with proper HTTP status codes
- **Request Logging** - Structured logging with Winston
- **Database Connection Pooling** - PostgreSQL with connection management
- **Redis Caching** - Session management and rate limiting
- **Security Headers** - Helmet.js for security best practices
- **Graceful Shutdown** - Clean shutdown handling

## 📋 Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 13
- Redis >= 6.0

## 🛠️ Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
```

## 📝 Environment Configuration

Configure the following in your `.env` file:

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=your-super-secret-jwt-key
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ambulance_dispatch
DB_USER=postgres
DB_PASSWORD=postgres
REDIS_HOST=localhost
REDIS_PORT=6379
```

See `.env.example` for all available options.

## 🗄️ Database Setup

Create the required database tables:

```sql
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

## 🚀 Running the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start

# Run tests
npm test

# Lint code
npm run lint
```

## 📚 API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | User login | No |
| POST | `/api/auth/logout` | User logout | No |
| POST | `/api/auth/refresh` | Refresh access token | No |

### Incidents

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| POST | `/api/incidents` | Create emergency incident | Yes | All |
| GET | `/api/incidents` | List all incidents | Yes | Admin, Dispatcher |
| GET | `/api/incidents/:id` | Get incident details | Yes | All |
| PUT | `/api/incidents/:id/status` | Update incident status | Yes | Admin, Dispatcher, Driver |
| DELETE | `/api/incidents/:id` | Delete incident | Yes | Admin |

### Ambulances

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| GET | `/api/ambulances` | List ambulances | Yes | All |
| GET | `/api/ambulances/available` | Get available ambulances | Yes | Admin, Dispatcher |
| GET | `/api/ambulances/:id` | Get ambulance details | Yes | All |
| PUT | `/api/ambulances/:id/location` | Update GPS location | Yes | Driver, Dispatcher, Admin |
| PUT | `/api/ambulances/:id/status` | Update ambulance status | Yes | Driver, Dispatcher, Admin |

### Hospitals

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/hospitals` | List hospitals | Yes |
| GET | `/api/hospitals/nearby` | Find nearby hospitals | Yes |
| GET | `/api/hospitals/:id` | Get hospital details | Yes |
| GET | `/api/hospitals/:id/capacity` | Get hospital capacity | Yes |
| PUT | `/api/hospitals/:id/capacity` | Update hospital capacity | Yes |

### Assignments

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| POST | `/api/assignments` | Create assignment | Yes | Admin, Dispatcher |
| GET | `/api/assignments` | List assignments | Yes | Admin, Dispatcher, Driver |
| GET | `/api/assignments/:id` | Get assignment details | Yes | All |
| PUT | `/api/assignments/:id/status` | Update assignment status | Yes | Admin, Dispatcher, Driver |

### Tracking

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/tracking/locations/:vehicleId` | Get location history | Yes |
| GET | `/api/tracking/live/:vehicleId` | Get live location | Yes |
| GET | `/api/tracking/route/:assignmentId` | Get route information | Yes |

### Analytics

| Method | Endpoint | Description | Auth Required | Roles |
|--------|----------|-------------|---------------|-------|
| GET | `/api/analytics/dashboard` | Dashboard statistics | Yes | Admin, Dispatcher |
| GET | `/api/analytics/incidents/stats` | Incident statistics | Yes | Admin, Dispatcher |
| GET | `/api/analytics/response-times` | Response time analytics | Yes | Admin, Dispatcher |
| GET | `/api/analytics/performance` | Performance metrics | Yes | Admin |

### System

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Health check | No |
| GET | `/health/ready` | Readiness check | No |
| GET | `/health/live` | Liveness check | No |
| GET | `/metrics` | System metrics | Yes (Admin) |
| POST | `/metrics/reset` | Reset metrics | Yes (Admin) |

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Example Login Request

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### Example Authenticated Request

```bash
curl -X GET http://localhost:3000/api/incidents \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

## 👥 User Roles

- **super_admin** - Full system access
- **admin** - Administrative access
- **dispatcher** - Dispatch operations
- **driver** - Ambulance driver
- **paramedic** - Medical staff
- **hospital_staff** - Hospital personnel
- **user** - Basic user access

## 📊 Response Format

### Success Response

```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error message",
  "code": "ERROR_CODE",
  "errors": [ ... ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Paginated Response

```json
{
  "success": true,
  "message": "Data retrieved",
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🔒 Security Features

- **Helmet.js** - Security headers (CSP, HSTS, etc.)
- **CORS** - Configurable cross-origin policies
- **Rate Limiting** - IP-based request throttling
- **Input Validation** - Request payload validation
- **SQL Injection Prevention** - Parameterized queries
- **Password Hashing** - bcrypt with configurable rounds
- **Token Blacklisting** - Logout token invalidation
- **Request Size Limits** - 10MB payload limit

## 📈 Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

Returns service health status, database connectivity, Redis status, and system metrics.

### Metrics Endpoint

```bash
curl http://localhost:3000/metrics \
  -H "Authorization: Bearer <admin-token>"
```

Returns:
- Request count by endpoint and method
- Average response time
- Error rates
- Status code distribution
- Memory usage
- Uptime

## 🐛 Error Codes

| Code | Status | Description |
|------|--------|-------------|
| VALIDATION_ERROR | 400 | Invalid request data |
| AUTHENTICATION_ERROR | 401 | Authentication failed |
| AUTHORIZATION_ERROR | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| SERVICE_UNAVAILABLE | 503 | Service unavailable |

## 📁 Project Structure

```
api/
├── config/
│   ├── config.js          # Configuration loader
│   ├── database.js        # PostgreSQL connection
│   └── redis.js           # Redis connection
├── middleware/
│   ├── auth.js            # JWT authentication
│   ├── rbac.js            # Role-based access control
│   ├── validation.js      # Request validation
│   ├── rateLimiter.js     # Rate limiting
│   ├── errorHandler.js    # Error handling
│   └── logger.js          # Request logging
├── routes/
│   ├── auth.js            # Authentication routes
│   ├── incidents.js       # Incident routes
│   ├── ambulances.js      # Ambulance routes
│   ├── hospitals.js       # Hospital routes
│   ├── assignments.js     # Assignment routes
│   ├── tracking.js        # Tracking routes
│   ├── analytics.js       # Analytics routes
│   ├── health.js          # Health check routes
│   └── metrics.js         # Metrics routes
├── utils/
│   ├── logger.js          # Winston logger
│   ├── errors.js          # Custom error classes
│   ├── response.js        # Response formatters
│   └── metrics.js         # Metrics collector
├── server.js              # Main application
├── package.json           # Dependencies
├── .env.example           # Environment template
└── README.md              # This file
```

## 🔄 Microservices Integration

The API Gateway proxies requests to the following microservices:

- **Incident Service** (port 3010) - Emergency incident management
- **Ambulance Service** (port 3011) - Fleet management
- **Hospital Service** (port 3012) - Hospital information
- **Tracking Service** (port 3013) - GPS tracking
- **Analytics Service** (port 3014) - Reports and analytics

Configure service URLs in `.env` file.

## 🚨 Rate Limits

| Endpoint | Window | Max Requests |
|----------|--------|--------------|
| Default | 15 min | 100 |
| Auth endpoints | 15 min | 10 |
| Emergency creation | 1 min | 10 |
| API endpoints | 1 min | 60 |

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- auth.test.js
```

## 📝 License

MIT

## 👨‍💻 Support

For issues and questions, please contact the development team.

---

**Built with ❤️ for Emergency Services**
