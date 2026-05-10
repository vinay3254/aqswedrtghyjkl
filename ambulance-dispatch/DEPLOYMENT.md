# 🚀 Deployment Guide

Complete deployment guide for the AI-Powered Ambulance Dispatch System.

---

## 📋 Prerequisites

### Hardware Requirements

**Minimum (Development/Testing):**
- 4 CPU cores
- 8 GB RAM
- 50 GB SSD storage
- 10 Mbps internet

**Recommended (Production):**
- 8+ CPU cores
- 16 GB RAM
- 200 GB SSD storage (for logs, database, OSRM maps)
- 100 Mbps internet
- Load balancer (for high availability)

### Software Requirements

- Ubuntu 20.04 LTS or later
- Docker 24.x
- Docker Compose 2.x
- Node.js 18.x (for local development)
- PostgreSQL 15.x (or use Docker)
- Redis 7.x (or use Docker)
- Nginx (for production)
- SSL certificates (Let's Encrypt)

---

## 🐳 Docker Deployment (Recommended)

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd ambulance-dispatch-system
```

### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your configuration
nano .env
```

**Critical Environment Variables:**

```bash
# Database
DATABASE_URL=postgresql://admin:your_secure_password@postgres:5432/ambulance_dispatch
POSTGRES_PASSWORD=your_secure_password

# Redis
REDIS_URL=redis://redis:6379

# JWT Authentication
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# OSRM Routing
OSRM_URL=http://osrm:5000

# API Configuration
API_PORT=3000
NODE_ENV=production

# Frontend
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_WS_URL=wss://api.yourdomain.com

# SMS Gateway (optional)
SMS_GATEWAY_URL=https://api.sms-provider.com
SMS_API_KEY=your_sms_api_key

# Maps API (optional)
GOOGLE_MAPS_API_KEY=your_google_maps_key
```

### Step 3: Download OSRM Map Data

```bash
# Create OSRM data directory
mkdir -p osrm-data

# Download India map (or your region)
wget https://download.geofabrik.de/asia/india-latest.osm.pbf -O osrm-data/india-latest.osm.pbf

# Process map data (this takes time!)
docker run -t -v "${PWD}/osrm-data:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/india-latest.osm.pbf
docker run -t -v "${PWD}/osrm-data:/data" osrm/osrm-backend osrm-partition /data/india-latest.osrm
docker run -t -v "${PWD}/osrm-data:/data" osrm/osrm-backend osrm-customize /data/india-latest.osrm
```

### Step 4: Build & Start Services

```bash
# Build all Docker images
docker-compose -f docker-compose.prod.yml build

# Start services in detached mode
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose ps
```

### Step 5: Initialize Database

```bash
# Run database migrations
docker-compose exec api npm run migrate

# Load seed data (development only)
docker-compose exec api npm run seed
```

### Step 6: Verify Deployment

```bash
# Check API health
curl http://localhost:3000/health

# Check OSRM
curl http://localhost:5000/health

# Check all services
docker-compose logs -f
```

---

## 🔧 Manual Deployment (Without Docker)

### Step 1: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL 15 with PostGIS
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-15 postgresql-15-postgis-3

# Install Redis
sudo apt install -y redis-server

# Install Nginx
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Step 2: Setup Database

```bash
# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE ambulance_dispatch;
CREATE USER admin WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE ambulance_dispatch TO admin;
\c ambulance_dispatch
CREATE EXTENSION postgis;
EOF

# Run schema
psql -U admin -d ambulance_dispatch -f backend/database/schema.sql
```

### Step 3: Setup Backend

```bash
cd backend/api

# Install dependencies
npm install --production

# Configure environment
cp .env.example .env
nano .env

# Run migrations
npm run migrate

# Start with PM2 (process manager)
sudo npm install -g pm2
pm2 start npm --name "ambulance-api" -- start
pm2 save
pm2 startup
```

### Step 4: Setup Frontend

```bash
cd frontend/dispatcher-dashboard

# Install dependencies
npm install

# Build for production
npm run build

# Copy build to Nginx
sudo cp -r build/* /var/www/html/dispatcher/
```

### Step 5: Configure Nginx

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/ambulance-dispatch
```

```nginx
upstream api_backend {
    server localhost:3000;
}

server {
    listen 80;
    server_name yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Frontend
    location / {
        root /var/www/html/dispatcher;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/ambulance-dispatch /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Setup SSL
sudo certbot --nginx -d yourdomain.com
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm test

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker images
        run: docker-compose -f docker-compose.prod.yml build
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker-compose -f docker-compose.prod.yml push

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/ambulance-dispatch-system
            git pull origin main
            docker-compose -f docker-compose.prod.yml pull
            docker-compose -f docker-compose.prod.yml up -d
            docker-compose exec api npm run migrate
```

---

## 📊 Monitoring

### Health Checks

```bash
# API health
curl https://yourdomain.com/api/health

# Expected response:
# {"status":"healthy","timestamp":"2026-04-05T10:00:00Z","services":{"database":"up","redis":"up","osrm":"up"}}
```

### Logging

```bash
# View API logs
docker-compose logs -f api

# View all logs
docker-compose logs -f

# PM2 logs (manual deployment)
pm2 logs ambulance-api
```

### Prometheus Metrics

Metrics available at: `http://localhost:3000/metrics`

```
# Example metrics
ambulance_dispatch_incidents_total
ambulance_dispatch_response_time_seconds
ambulance_dispatch_active_ambulances
ambulance_dispatch_available_beds
```

---

## 🔒 Security Hardening

### 1. Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 2. Database Security

```bash
# Edit PostgreSQL config
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Allow only local connections
# local   all   all   md5
# host    all   all   127.0.0.1/32   md5
```

### 3. Environment Secrets

```bash
# Never commit .env files
echo ".env" >> .gitignore

# Use secrets manager in production
# (AWS Secrets Manager, HashiCorp Vault, etc.)
```

### 4. Rate Limiting

Configure in `backend/api/middleware/rate-limit.js`:

```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});
```

---

## 📦 Backup & Recovery

### Database Backup

```bash
# Create backup script
cat > /opt/scripts/backup-db.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups"
DB_NAME="ambulance_dispatch"

mkdir -p $BACKUP_DIR
docker-compose exec -T postgres pg_dump -U admin $DB_NAME | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.sql.gz" -mtime +30 -delete
EOF

chmod +x /opt/scripts/backup-db.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /opt/scripts/backup-db.sh" | crontab -
```

### Database Restore

```bash
# Restore from backup
gunzip -c /opt/backups/backup_20260405_020000.sql.gz | docker-compose exec -T postgres psql -U admin ambulance_dispatch
```

---

## 🚨 Troubleshooting

### Common Issues

**1. Database connection failed**
```bash
# Check PostgreSQL status
docker-compose ps postgres
docker-compose logs postgres

# Verify credentials
docker-compose exec api env | grep DATABASE
```

**2. OSRM routing errors**
```bash
# Check OSRM status
curl http://localhost:5000/health

# Restart OSRM
docker-compose restart osrm
```

**3. High memory usage**
```bash
# Check resource usage
docker stats

# Increase memory limits in docker-compose.yml
services:
  api:
    mem_limit: 2g
```

**4. WebSocket connection issues**
```bash
# Check Nginx WebSocket config
sudo nginx -t

# Verify upgrade headers are set
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

---

## 📈 Scaling

### Horizontal Scaling

```yaml
# docker-compose.prod.yml
services:
  api:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 2G
```

### Load Balancer

```nginx
upstream api_backend {
    least_conn;
    server api1:3000;
    server api2:3000;
    server api3:3000;
}
```

---

## ✅ Post-Deployment Checklist

- [ ] All services running (docker-compose ps)
- [ ] Database initialized and migrated
- [ ] Health check endpoints responding
- [ ] SSL certificates installed and valid
- [ ] Firewall configured
- [ ] Backup scripts configured and tested
- [ ] Monitoring dashboards accessible
- [ ] Log rotation configured
- [ ] Environment secrets secured
- [ ] CI/CD pipeline tested
- [ ] Load testing completed
- [ ] Security audit performed
- [ ] Documentation updated
- [ ] Team trained on deployment procedures

---

**Deployment complete! 🎉 System ready to save lives. 🚑**
