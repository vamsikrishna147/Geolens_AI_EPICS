#!/bin/bash

echo "================================================================="
echo "GeoLens AI - Production Deployment Script (Linux/macOS)"
echo "================================================================="
echo ""

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker could not be found. Please install Docker."
    exit 1
fi

if ! docker info > /dev/null 2>&1; then
    echo "[ERROR] Docker daemon is not running. Please start Docker."
    exit 1
fi

echo "[1/3] Building and starting Docker containers..."
docker-compose up -d --build

echo ""
echo "[2/3] Waiting for services to initialize..."
sleep 10

echo ""
echo "[3/3] Deployment Successful!"
echo "================================================================="
echo "Access the application at:"
echo "  - Frontend Dashboard: http://localhost/"
echo "  - Backend API Docs:   http://localhost:8000/docs"
echo "================================================================="
echo ""
echo "To view live logs, run: docker-compose logs -f"
echo "To stop the stack, run: docker-compose down"
