#!/bin/bash
cd "$(dirname "$0")/.."

echo "=== Maskara Doctor ==="
echo ""

# Docker
if docker info &>/dev/null; then
  echo "✓ Docker Desktop — running"
  docker compose ps 2>/dev/null || true
else
  echo "✗ Docker Desktop — NOT running"
  if [ -d "/Applications/Docker.app" ]; then
    echo "  → Open Docker.app from Applications folder"
  else
    echo "  → Install: https://www.docker.com/products/docker-desktop/"
  fi
fi

echo ""

# Ports
for port in 3000 4000 5432 6379; do
  if lsof -nP -iTCP:$port -sTCP:LISTEN &>/dev/null; then
    echo "✓ Port $port — in use (service running)"
  else
    echo "✗ Port $port — free (nothing listening)"
  fi
done

echo ""

# Backend health
if curl -sf http://localhost:4000/health &>/dev/null; then
  echo "✓ Backend API — UP (http://localhost:4000/health)"
else
  echo "✗ Backend API — DOWN"
fi

echo ""

# Node (for local dev without Docker)
if command -v node &>/dev/null; then
  echo "✓ Node.js — $(node -v)"
else
  echo "✗ Node.js — not found (install Node 20+ for local dev)"
fi

echo ""
echo "=== Fix commands ==="
echo "  Docker:  ./scripts/start-all.sh"
echo "  Local:   ./scripts/start-local.sh"
echo "  Doctor:  ./scripts/doctor.sh"
