@echo off
REM Ambulance Dispatch API Gateway - Windows Startup Script

echo ========================================
echo   Ambulance Dispatch System - API Gateway
echo ========================================
echo.

REM Check Node.js
echo Checking Node.js version...
node -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Please install Node.js >= 18.0.0
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo [OK] Node.js %NODE_VERSION% found
echo.

REM Check if .env exists
if not exist .env (
    echo [WARN] .env file not found. Creating from .env.example...
    copy .env.example .env
    echo [OK] .env file created. Please edit it with your configuration.
    echo.
    echo Required configuration:
    echo   - JWT_SECRET (generate a strong random string)
    echo   - Database credentials (DB_HOST, DB_USER, DB_PASSWORD)
    echo   - Redis credentials (REDIS_HOST)
    echo.
    pause
)

REM Check if node_modules exists
if not exist node_modules (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
    echo [OK] Dependencies installed
    echo.
)

REM Create logs directory
if not exist logs (
    mkdir logs
    echo [OK] Logs directory created
)

echo ========================================
echo   Starting API Gateway...
echo ========================================
echo.

REM Start the server
if "%NODE_ENV%"=="production" (
    node server.js
) else (
    npm run dev
)
