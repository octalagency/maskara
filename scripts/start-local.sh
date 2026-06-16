#!/bin/bash
set -e
cd "$(dirname "$0")/.."

echo "=== Maskara — Local Dev (no Docker) ==="

if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js not found."
  echo "Install Node 20+: https://nodejs.org/"
  exit 1
fi

if ! command -v psql &>/dev/null; then
  echo "ERROR: PostgreSQL not found."
  echo "Install: brew install postgresql@16 && brew services start postgresql@16"
  exit 1
fi

if ! command -v redis-cli &>/dev/null; then
  echo "WARN: Redis not found — call queue may not work."
  echo "Install: brew install redis && brew services start redis"
fi

# Create DB if missing
createdb maskara 2>/dev/null || true

export DATABASE_URL="${DATABASE_URL:-postgresql://$(whoami)@localhost:5432/maskara}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export JWT_SECRET="${JWT_SECRET:-dev-jwt-secret-change-before-production-abc123xyz}"
export FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
export API_URL="${API_URL:-http://localhost:4000}"
export PORT=4000

echo "DATABASE_URL=$DATABASE_URL"
echo ""

echo "[1/3] Backend setup..."
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npx prisma db seed || true

echo ""
echo "[2/3] Starting backend on :4000..."
npm run start:dev &
BACKEND_PID=$!

cd ../frontend
echo ""
echo "[3/3] Starting frontend on :3000..."
npm install
npm run dev &
FRONTEND_PID=$!

sleep 8

if curl -sf http://localhost:4000/health &>/dev/null; then
  echo ""
  echo "✓ Backend UP — http://localhost:4000/docs"
  echo "✓ Frontend — http://localhost:3000/admin/login"
  echo "  Login: admin@maskara.bd / Admin@123"
  echo ""
  echo "Press Ctrl+C to stop both servers"
  wait $BACKEND_PID $FRONTEND_PID
else
  echo "✗ Backend failed to start. Check terminal output above."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  exit 1
fi
