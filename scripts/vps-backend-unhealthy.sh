#!/bin/bash
# Backend unhealthy হলে VPS terminal-এ চালান
set -euo pipefail
cd /opt/maskara || exit 1

echo "=== 1. Backend logs ==="
docker logs maskara-backend --tail 60 2>&1 || true

echo ""
echo "=== 2. Fix .env (missing secrets block startup) ==="
if [ -f .env ]; then
  add() { grep -q "^$1=" .env || echo "$1=$2" >> .env; }
  add API_URL "https://api.maskara.bd"
  add PUBLIC_API_URL "https://api.maskara.bd"
  add FRONTEND_URL "https://app.maskara.bd"
  add APP_URL "https://app.maskara.bd"
  grep -q '^JWT_SECRET=.\{32,\}' .env || {
    JWT=$(openssl rand -hex 32)
    if grep -q '^JWT_SECRET=' .env; then sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT/" .env
    else echo "JWT_SECRET=$JWT" >> .env; fi
    echo "  fixed JWT_SECRET"
  }
  add VOICE_WEBHOOK_SECRET "$(openssl rand -hex 24)"
  add WOOCOMMERCE_WEBHOOK_SECRET "$(openssl rand -hex 24)"
  grep -q '^POSTGRES_PASSWORD=.' .env || add POSTGRES_PASSWORD "$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)"
fi

echo ""
echo "=== 3. Fix tsconfig.build.json (dist/main.js missing) ==="
cat > backend/tsconfig.build.json <<'EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test", "**/*.spec.ts", "**/*.test.ts"]
}
EOF
# remove broken exclude from tsconfig.json if present
perl -i -0pe 's/,\s*"exclude":\s*\[[^\]]*\]\s*(\n\})/$1/s' backend/tsconfig.json 2>/dev/null || true

echo ""
echo "=== 4. Fix healthcheck (use node, not wget) ==="
COMPOSE="docker-compose.hostinger.yml"
if grep -q 'wget -qO-' "$COMPOSE" 2>/dev/null; then
  python3 - <<'PY'
from pathlib import Path
p = Path("docker-compose.hostinger.yml")
text = p.read_text()
old = "wget -qO- http://127.0.0.1:4000/health || exit 1"
new = 'node -e "require(\\"http\\").get(\\"http://127.0.0.1:4000/health\\",r=>process.exit(r.statusCode===200?0:1)).on(\\"error\\",()=>process.exit(1))"'
if old in text:
    p.write_text(text.replace(old, new).replace("start_period: 60s", "start_period: 90s").replace("retries: 8", "retries: 10"))
    print("  patched healthcheck")
else:
    print("  healthcheck ok")
PY
fi

echo ""
echo "=== 5. Rebuild backend (no cache) ==="
docker compose -f "$COMPOSE" build backend --no-cache
docker compose -f "$COMPOSE" up -d

echo "Waiting 30s for migrations + startup..."
sleep 30
docker compose -f "$COMPOSE" ps
echo ""
docker logs maskara-backend --tail 25 2>&1 || true
echo ""
docker exec maskara-backend node -e "require('http').get('http://127.0.0.1:4000/health',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log('health:',r.statusCode,d))}).on('error',e=>console.error(e))" 2>/dev/null \
  && echo "✓ Backend healthy" || echo "✗ Still failing — paste full logs above"
