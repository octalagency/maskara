#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "=== Maskara Setup ==="

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

echo "Starting PostgreSQL and Redis..."
docker compose up postgres redis -d

echo "Waiting for database..."
sleep 5

echo "Building and starting all services..."
docker compose build backend worker frontend
docker compose up -d backend worker frontend

echo ""
echo "=== Setup Complete ==="
echo "Frontend:  http://localhost:3000"
echo "API:       http://localhost:4000"
echo "API Docs:  http://localhost:4000/docs"
echo ""
echo "Demo accounts:"
echo "  Admin:    admin@maskara.bd / Admin@123"
echo "  Merchant: demo@store.com / Demo@123"
echo ""
echo "View logs: docker compose logs -f backend"
