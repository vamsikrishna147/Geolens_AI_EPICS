@echo off
echo =================================================================
echo GeoLens AI - Production Deployment Script (Windows)
echo =================================================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running or not installed.
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [1/3] Building and starting Docker containers...
docker-compose up -d --build

echo.
echo [2/3] Waiting for services to initialize...
timeout /t 10 /nobreak >nul

echo.
echo [3/3] Deployment Successful!
echo =================================================================
echo Access the application at:
echo   - Frontend Dashboard: http://localhost/
echo   - Backend API Docs:   http://localhost:8000/docs
echo =================================================================
echo.
echo To view live logs, run: docker-compose logs -f
echo To stop the stack, run: docker-compose down
pause
