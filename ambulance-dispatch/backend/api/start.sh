#!/bin/bash

# Ambulance Dispatch API Gateway - Startup Script
# This script helps you get started quickly

echo "🚑 Ambulance Dispatch System - API Gateway"
echo "=========================================="
echo ""

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node -v 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "❌ Node.js is not installed. Please install Node.js >= 18.0.0"
    exit 1
fi
echo "✅ Node.js $NODE_VERSION found"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please edit it with your configuration."
    echo ""
    echo "Required configuration:"
    echo "  - JWT_SECRET (generate a strong random string)"
    echo "  - Database credentials (DB_HOST, DB_USER, DB_PASSWORD)"
    echo "  - Redis credentials (REDIS_HOST)"
    echo ""
    read -p "Press Enter to continue after configuring .env..."
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
    echo "✅ Dependencies installed"
    echo ""
fi

# Check PostgreSQL connection
echo "Checking PostgreSQL connection..."
source .env
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;" > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Cannot connect to PostgreSQL database"
    echo "   Please ensure PostgreSQL is running and credentials are correct"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ PostgreSQL connection successful"
fi
echo ""

# Check Redis connection
echo "Checking Redis connection..."
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "❌ Cannot connect to Redis"
    echo "   Please ensure Redis is running"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ Redis connection successful"
fi
echo ""

# Create logs directory if it doesn't exist
if [ ! -d logs ]; then
    mkdir -p logs
    echo "✅ Logs directory created"
fi

echo "=========================================="
echo "🚀 Starting API Gateway on port $PORT..."
echo "=========================================="
echo ""

# Start the server
if [ "$NODE_ENV" = "production" ]; then
    node server.js
else
    npm run dev
fi
