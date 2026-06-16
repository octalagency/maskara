#!/bin/bash
# Hostinger Browser Terminal — backend unhealthy / dist/main.js missing
set -euo pipefail
cd /opt/maskara

echo "=== Pull latest fixes ==="
git pull origin main

echo "=== Fix Nest build config ==="
cat > backend/tsconfig.build.json <<'EOF'
{"extends":"./tsconfig.json","compilerOptions":{"rootDir":"src","outDir":"./dist"},"include":["src/**/*"],"exclude":["node_modules","dist","test","**/*.spec.ts","**/*.test.ts"]}
EOF
if ! grep -q 'tsconfig.build.json' backend/nest-cli.json 2>/dev/null; then
  sed -i 's/"deleteOutDir": true/"deleteOutDir": true,\n    "tsConfigPath": "tsconfig.build.json"/' backend/nest-cli.json
fi

echo "=== Backend logs (before rebuild) ==="
docker logs maskara-backend --tail 40 2>&1 || true

echo "=== Rebuild backend + worker (--no-cache) ==="
docker compose -f docker-compose.hostinger.yml build --no-cache backend
docker compose -f docker-compose.hostinger.yml up -d backend worker

echo "Waiting 120s..."
sleep 120
docker compose -f docker-compose.hostinger.yml ps

echo "=== Verify dist/main.js inside container ==="
docker exec maskara-backend test -f dist/main.js && echo "dist/main.js OK" || {
  echo "dist/main.js still missing:"
  docker exec maskara-backend ls -la dist 2>&1 || true
  exit 1
}

echo "=== Ensure admin ==="
docker exec -e ADMIN_EMAIL=admin@maskara.bd \
  -e ADMIN_INITIAL_PASSWORD=Admin@123 \
  maskara-backend node scripts/ensure-admin.js 2>/dev/null || true

docker exec maskara-backend wget -qO- http://127.0.0.1:4000/health/live && echo "backend live OK"
echo "→ https://app.maskara.bd/admin"
