# 🚑 Ambulance Dispatch System

**Save Lives in the Golden Hour** | Real-time Emergency Response Coordination Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue)](https://reactjs.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)](https://www.docker.com/)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)]()

---

## 🏥 Problem Statement: The Golden Hour Crisis

Every second matters in emergency medicine. The **"golden hour"** is the critical first 60 minutes following a traumatic injury when immediate medical intervention can mean the difference between life and death.

**Current Challenges:**
- ⏱️ Delayed dispatch decisions due to manual coordination
- 📍 Inefficient ambulance routing and hospital selection
- 📱 Fragmented communication between EMTs, dispatch centers, and hospitals
- 🚗 Suboptimal resource allocation leading to ambulance bottlenecks
- 📊 Lack of real-time visibility into emergency response metrics

**The Impact:** Average response times of 8-12 minutes in urban areas, with potential to save **1000+ lives annually** through optimized dispatch systems.

---

## 💡 Solution Overview

**Ambulance Dispatch System** is a real-time, AI-assisted emergency response coordination platform that:

✨ **Intelligently Routes** ambulances using advanced algorithms considering traffic, hospital capacity, and patient severity  
📡 **Enables Real-Time Communication** between dispatch centers, EMTs, and hospital staff  
🎯 **Optimizes Resource Allocation** with predictive analytics and load balancing  
📊 **Provides Actionable Insights** through comprehensive analytics and reporting  
🔒 **Ensures Data Security** with HIPAA-compliant architecture  
⚡ **Scales Effortlessly** handling thousands of concurrent emergencies  

---

## ✅ Features

### Core Dispatch Features
- [x] Real-time ambulance location tracking with GPS integration
- [x] Intelligent dispatch recommendations using route optimization (OSRM)
- [x] Multi-hospital selection with capacity awareness
- [x] Dynamic priority queuing for emergency cases
- [x] One-click dispatch confirmation and assignment

### Communication & Coordination
- [x] WebSocket-based real-time updates for all stakeholders
- [x] Two-way communication between dispatch and EMT teams
- [x] Hospital notification and bed availability updates
- [x] Emergency call integration and recording (CTI)
- [x] In-app messaging with message history and acknowledgments

### Analytics & Reporting
- [x] Response time tracking and performance metrics
- [x] Heat maps showing high-incident areas
- [x] Hospital capacity dashboards
- [x] Ambulance utilization reports
- [x] Predictive demand forecasting

### Safety & Compliance
- [x] HIPAA-compliant patient data handling
- [x] Role-based access control (RBAC)
- [x] Audit logs for all critical operations
- [x] End-to-end encryption for sensitive communications
- [x] Automated backup and disaster recovery

### Mobile & Web
- [x] Native iOS/Android app for EMT teams
- [x] Web-based dispatcher dashboard
- [x] Hospital staff portal
- [x] Public emergency request interface
- [x] Offline-first capabilities for remote areas

### Administration
- [x] User management and team organization
- [x] Hospital and ambulance fleet configuration
- [x] System health monitoring and alerting
- [x] Bulk data import/export
- [x] API rate limiting and quota management

---

## 🏗️ Architecture Diagram

```
                          ┌─────────────────────────────────────┐
                          │      External Services              │
                          │  ┌─────────────────────────────┐   │
                          │  │  OSRM Route Engine          │   │
                          │  │  (Routing Optimization)     │   │
                          │  └─────────────────────────────┘   │
                          └────────────┬────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌───────────────────┐     ┌────────────────────────┐     ┌─────────────────────┐
│   Web Dashboard   │     │   API Gateway & Auth   │     │  Mobile App (iOS)   │
│  (Dispatcher)     │     │  (JWT + Rate Limit)    │     │  (EMT Teams)        │
└──────────┬────────┘     └────────┬───────────────┘     └────────┬────────────┘
           │                       │                               │
           └───────────────────────┼───────────────────────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │    WebSocket Server         │
                    │  (Real-time Updates)        │
                    └──────────────┬───────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────────┐
        │                          │                              │
        ▼                          ▼                              ▼
┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│  Core API Services   │  │   Cache Layer    │  │  Hospital Portal     │
│  ┌────────────────┐  │  │  (Redis)         │  │  (Bed Mgmt)          │
│  │ Auth Service   │  │  │                  │  └──────────────────────┘
│  │ Dispatch Logic │  │  │  ┌────────────┐ │
│  │ Route Service  │  │  │  │  Location  │ │
│  │ Hospital API   │  │  │  │  Cache     │ │
│  │ Reporting      │  │  │  └────────────┘ │
│  └────────────────┘  │  │                  │
└──────────┬───────────┘  │  ┌────────────┐ │
           │              │  │  Route     │ │
           │              │  │  Cache     │ │
           │              │  └────────────┘ │
           │              └──────────────────┘
           │
        ┌──▼──────────────────────────────────────────┐
        │        PostgreSQL Database                  │
        │  ┌──────────────────────────────────────┐  │
        │  │ Tables: Users, Ambulances, Hospitals,   │
        │  │ Emergencies, Routes, Audit Logs        │
        │  │ (Timescale extension for analytics)    │
        │  └──────────────────────────────────────┘  │
        └─────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  S3 Backups  │      │ Sentry Error │      │  CloudWatch  │
│  (Daily)     │      │  Tracking    │      │  Monitoring  │
└──────────────┘      └──────────────┘      └──────────────┘

```

### Data Flow Example: Emergency Dispatch
```
Caller → Emergency Request → Dispatch System → Route Analysis → 
    Optimal Ambulance Selection → Real-time Assignment → 
    GPS Tracking → Hospital Notification → Outcome Recording
```

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose | Version |
|---|---|---|
| **Node.js** | Runtime environment | 18+ |
| **Express.js** | REST API framework | 4.x |
| **PostgreSQL** | Primary database | 14+ |
| **Redis** | Caching & session management | 7+ |
| **Socket.IO** | Real-time WebSocket communication | 4.x |
| **OSRM** | Route optimization engine | 5.x |
| **JWT** | Authentication & authorization | - |
| **Bcrypt** | Password hashing | - |

### Frontend
| Technology | Purpose | Version |
|---|---|---|
| **React** | UI framework | 18+ |
| **TypeScript** | Type safety | 4.9+ |
| **Tailwind CSS** | Styling | 3+ |
| **Redux** | State management | 4.x |
| **Socket.IO Client** | Real-time client | 4.x |
| **Mapbox GL** | Interactive mapping | 2+ |
| **Ant Design** | Component library | 5+ |

### Mobile
| Technology | Purpose |
|---|---|
| **React Native** | Cross-platform development |
| **Expo** | Development & deployment |
| **Redux** | State management |
| **Socket.IO** | Real-time updates |

### DevOps & Infrastructure
| Technology | Purpose |
|---|---|
| **Docker** | Containerization |
| **Docker Compose** | Multi-container orchestration |
| **PostgreSQL Timescale** | Time-series analytics |
| **Sentry** | Error tracking |
| **AWS S3** | Backup storage |
| **CloudWatch** | Monitoring & logging |

---

## 🚀 Quick Start Guide

### Prerequisites
Before you begin, ensure you have:
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Docker & Docker Compose** - [Download](https://www.docker.com/products/docker-desktop)
- **Git** - [Download](https://git-scm.com/)
- **PostgreSQL Client** (optional, for direct database access)

### Step 1: Clone the Repository
```bash
git clone https://github.com/yourusername/ambulance-dispatch-system.git
cd ambulance-dispatch-system
```

### Step 2: Set Up Environment Variables
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
# Make sure to set:
# - DB_PASSWORD: Secure database password
# - JWT_SECRET: Min 32 characters
# - REACT_APP_API_URL: Backend URL
# - OSRM_URL: Route engine URL
```

### Step 3: Start Docker Services
```bash
# Start all services (PostgreSQL, Redis, OSRM, Backend, Frontend)
docker-compose up -d

# Verify services are running
docker-compose ps

# Check logs
docker-compose logs -f backend
```

### Step 4: Initialize the Database
```bash
# Option A: Using Docker Compose (Automatic)
docker-compose exec backend npm run db:migrate

# Option B: Manual seed data
docker-compose exec backend npm run db:seed
```

### Step 5: Verify Everything Works

**Backend API** (http://localhost:3000):
```bash
curl http://localhost:3000/api/health
# Expected response: { status: "healthy", timestamp: "..." }
```

**Frontend Dashboard** (http://localhost:3001):
- Open http://localhost:3001 in your browser
- Default credentials: `dispatcher@demo.com` / `demo1234`

**Real-time Testing**:
```bash
# Test WebSocket connection
wscat -c ws://localhost:3000/socket.io/?EIO=4&transport=websocket
```

### Step 6: Explore the System

#### Dispatcher Dashboard
1. Navigate to **Emergencies** tab
2. Click **Create Emergency** to simulate a call
3. View optimal ambulance suggestions
4. Track real-time ambulance locations
5. Monitor hospital capacity metrics

#### EMT Mobile App
1. Sign in with EMT credentials
2. Receive dispatch notifications
3. Accept/reject assignments
4. Update patient status in real-time
5. Confirm arrival at hospital

---

## 📡 API Documentation Summary

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication
All requests (except `/auth/login`) require:
```headers
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

### Core Endpoints

#### 🔐 Authentication
```http
POST /auth/login
POST /auth/logout
POST /auth/refresh
GET  /auth/me
```

#### 🚑 Ambulances
```http
GET    /ambulances                    # List all ambulances
GET    /ambulances/:id                # Get ambulance details
POST   /ambulances                    # Create ambulance
PUT    /ambulances/:id                # Update ambulance
DELETE /ambulances/:id                # Remove ambulance
GET    /ambulances/:id/location       # Get current location
GET    /ambulances/:id/history        # Get location history
```

#### 🏥 Hospitals
```http
GET    /hospitals                     # List all hospitals
GET    /hospitals/:id                 # Get hospital details
GET    /hospitals/:id/capacity        # Get bed availability
PUT    /hospitals/:id/capacity        # Update capacity
GET    /hospitals/:id/emergencies     # Get active emergencies
```

#### 🚨 Emergencies
```http
POST   /emergencies                   # Create emergency
GET    /emergencies                   # List emergencies (filter: status, priority)
GET    /emergencies/:id               # Get emergency details
PUT    /emergencies/:id               # Update emergency status
GET    /emergencies/:id/recommended   # Get ambulance recommendations
POST   /emergencies/:id/assign        # Assign ambulance
POST   /emergencies/:id/complete      # Mark as complete
```

#### 📊 Reporting
```http
GET    /reports/response-time         # Response time analytics
GET    /reports/ambulance-utilization # Fleet utilization metrics
GET    /reports/hospital-load         # Hospital occupancy trends
GET    /reports/incidents-heatmap     # Geographic incident distribution
GET    /reports/export/:format        # Export reports (csv, pdf)
```

#### 📍 Routes
```http
POST   /routes/calculate              # Calculate optimal route
GET    /routes/history/:ambulance_id  # Get route history
```

### Example Request/Response

**Create Emergency:**
```bash
curl -X POST http://localhost:3000/api/v1/emergencies \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_name": "John Doe",
    "patient_age": 45,
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "address": "123 Main St, New York, NY"
    },
    "condition": "Chest pain, difficulty breathing",
    "priority": "HIGH",
    "contact_phone": "+1-555-0123"
  }'
```

**Response:**
```json
{
  "id": "em_abc123def456",
  "patient_name": "John Doe",
  "priority": "HIGH",
  "status": "DISPATCHED",
  "created_at": "2024-01-15T14:30:00Z",
  "assigned_ambulance": {
    "id": "amb_001",
    "call_sign": "Ambulance 1",
    "eta_minutes": 8,
    "current_location": {...}
  },
  "recommended_hospital": {
    "id": "hosp_001",
    "name": "City Medical Center",
    "distance_km": 2.4,
    "available_beds": 5
  }
}
```

### WebSocket Events

**Subscribe to Emergency Updates:**
```javascript
socket.on('emergency:updated', (data) => {
  console.log('Emergency status:', data.status);
  console.log('Ambulance location:', data.ambulance_location);
});

socket.on('ambulance:location-changed', (data) => {
  console.log('New location:', data.latitude, data.longitude);
});

socket.on('hospital:capacity-changed', (data) => {
  console.log('Available beds:', data.available_beds);
});
```

**Full API Documentation:** See [/docs/API.md](./docs/API.md) for complete reference with rate limits, error codes, and advanced features.

---

## 📸 Screenshots & Demos

### Web Dashboard
```
[SCREENSHOT PLACEHOLDER]
📌 Dispatcher Dashboard showing:
   - Real-time emergency map
   - Priority queue of cases
   - Ambulance fleet status
   - Hospital capacity heatmap
   - Performance metrics
```

### Mobile App
```
[SCREENSHOT PLACEHOLDER]
📌 EMT Mobile showing:
   - Dispatch notifications
   - Turn-by-turn navigation
   - Patient information
   - Real-time chat
   - Status updates
```

### Hospital Portal
```
[SCREENSHOT PLACEHOLDER]
📌 Hospital Staff showing:
   - Incoming emergency alerts
   - Bed availability management
   - Patient arrival tracking
   - Integration with EHR
```

### Analytics Dashboard
```
[SCREENSHOT PLACEHOLDER]
📌 System Analytics showing:
   - Response time trends
   - Incident heat maps
   - Ambulance utilization
   - Peak hour analysis
   - Performance KPIs
```

---

## 👥 Team

| Role | Team Members | Contact |
|---|---|---|
| **Project Lead** | [Name] | [Email] |
| **Backend Lead** | [Name] | [Email] |
| **Frontend Lead** | [Name] | [Email] |
| **DevOps Lead** | [Name] | [Email] |
| **Designer** | [Name] | [Email] |

### Contributors
- 🎖️ Hackathon Team 2024
- 💝 Special thanks to all medical professionals who provided requirements

---

## 🔧 Development Guide

### Setting Up Development Environment
```bash
# Install dependencies
npm install

# Start development server with hot reload
npm run dev

# Run tests
npm run test

# Run linter
npm run lint

# Format code
npm run format
```

### Project Structure
```
ambulance-dispatch-system/
├── backend/
│   ├── api/              # REST API routes
│   ├── auth/             # Authentication & authorization
│   ├── services/         # Business logic
│   ├── websocket/        # Real-time communication
│   └── tests/            # Unit & integration tests
├── frontend/
│   ├── dispatcher-dashboard/  # Web UI for dispatchers
│   ├── components/       # Reusable React components
│   ├── pages/            # Page components
│   └── hooks/            # Custom React hooks
├── mobile/               # React Native app
├── infrastructure/       # Terraform & K8s manifests
└── docs/                 # Documentation
```

### Running Tests
```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests (with running app)
npm run test:e2e

# Coverage report
npm run test:coverage
```

---

## 🚀 Deployment

### Docker Deployment (Development/Staging)
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Production Deployment
See [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- Kubernetes configuration
- Load balancer setup
- SSL/TLS certificates
- Database backup strategies
- Monitoring & alerting setup
- Disaster recovery procedures

### Environment Variables (Production)
```env
# See .env.example for all variables
# Critical variables:
NODE_ENV=production
DB_PASSWORD=<GENERATE_STRONG_PASSWORD>
JWT_SECRET=<GENERATE_32+_CHAR_STRING>
CORS_ORIGIN=https://yourdomain.com
SENTRY_DSN=https://your-sentry-key@sentry.io/project-id
```

---

## 📊 Monitoring & Logging

### Health Check Endpoints
```bash
# API health
GET /api/health

# Database connectivity
GET /api/health/db

# Cache status
GET /api/health/cache

# Real-time metrics
GET /api/metrics
```

### Logging
- **Application logs:** `/var/log/ambulance-dispatch/app.log`
- **Error logs:** `/var/log/ambulance-dispatch/error.log`
- **Access logs:** `/var/log/ambulance-dispatch/access.log`
- **Sentry integration:** Real-time error tracking

### Key Metrics
- Response time (p50, p95, p99)
- Ambulance utilization %
- Hospital bed occupancy %
- Emergency response time
- System uptime %

---

## 🔒 Security & Compliance

### HIPAA Compliance
- ✅ PHI data encryption at rest and in transit
- ✅ Access control and role-based permissions
- ✅ Audit logging of all PHI access
- ✅ Automatic data retention/purging
- ✅ Business Associate Agreement support

### Data Protection
- 🔐 AES-256 encryption for sensitive data
- 🔐 TLS 1.3 for all network communications
- 🔐 Regular security audits
- 🔐 Dependency vulnerability scanning
- 🔐 OWASP Top 10 protections

### Incident Response
- 📋 Documented incident response procedures
- 📋 24/7 monitoring and alerting
- 📋 Automated backup and recovery
- 📋 Security event logging

---

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](./LICENSE) file for details.

```
MIT License

Copyright (c) 2024 Ambulance Dispatch System Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Code Guidelines
- Follow ESLint configuration
- Write unit tests for new features
- Update documentation
- Keep commits atomic and descriptive

---

## 🆘 Troubleshooting

### Common Issues

**Docker containers won't start:**
```bash
# Check Docker daemon
docker ps

# View detailed logs
docker-compose logs -f

# Rebuild images
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**Database connection error:**
```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check connection string in .env
# Ensure DB_PASSWORD is correct
```

**WebSocket connection failing:**
```bash
# Check if Socket.IO is running
curl -i http://localhost:3000/socket.io/?EIO=4&transport=polling

# Check firewall rules for port 3000
```

**Port already in use:**
```bash
# Find process using port
lsof -i :3000

# Kill process (if needed)
kill -9 <PID>
```

### Getting Help

- 📖 Read [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md)
- 💬 Open an [GitHub Issue](https://github.com/yourusername/ambulance-dispatch-system/issues)
- 📧 Email: support@ambulance-dispatch.com
- 🚀 Check [Q&A Discussions](https://github.com/yourusername/ambulance-dispatch-system/discussions)

---

## 📞 Contact & Support

- **Website:** https://ambulance-dispatch.com
- **Email:** support@ambulance-dispatch.com
- **Issues:** [GitHub Issues](https://github.com/yourusername/ambulance-dispatch-system/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/ambulance-dispatch-system/discussions)

---

## ⭐ Show Your Support

If this project helped you, please consider giving it a ⭐ star on GitHub. It helps us reach more people and encourages continued development!

---

## 📚 Additional Resources

- [API Documentation](./docs/API.md)
- [Architecture Deep Dive](./docs/ARCHITECTURE.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Development Guide](./docs/DEVELOPMENT.md)
- [Security Policy](./docs/SECURITY.md)
- [Changelog](./CHANGELOG.md)

---

**Made with ❤️ for saving lives. One dispatch at a time.** 🚑

```
        🚨
        ╱╲
       ╱  ╲
      ╱ 🏥 ╲
     ╱______╲
    ┏━━━━━━━┓
    ┃       ┃
    ┃  🚑   ┃  → Safe, Fast, Efficient Emergency Response
    ┗━━━━━━━┛
```

**Last Updated:** January 2024 | **Version:** 1.0.0 | **Status:** Production Ready ✅
