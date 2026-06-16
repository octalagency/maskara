#!/bin/bash
# Maskara deploy — Shopin-এর মতো Mac Terminal থেকে চালান
set -euo pipefail

VPS_HOST="${MASKARA_SSH_HOST:-148.135.137.47}"
VPS_USER="${MASKARA_SSH_USER:-root}"
LOCAL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG="${LOCAL_DIR}/deploy-maskara.log"

log() { echo "$1" | tee -a "$LOG"; }

log "=== Maskara deploy $(date) ==="

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

if ! command -v sshpass >/dev/null 2>&1; then
  log "Installing sshpass..."
  brew install hudochenkov/sshpass/sshpass
fi

if [ -z "${MASKARA_SSH_PASSWORD:-}" ]; then
  read -rs -p "VPS password (${VPS_USER}@${VPS_HOST}): " MASKARA_SSH_PASSWORD
  echo
fi

SSH=(sshpass -p "$MASKARA_SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "${VPS_USER}@${VPS_HOST}")

log "=== Upload code (rsync) ==="
sshpass -p "$MASKARA_SSH_PASSWORD" rsync -avz \
  -e "ssh -o StrictHostKeyChecking=no" \
  --exclude node_modules \
  --exclude .git \
  --exclude .next \
  --exclude dist \
  --exclude .env \
  --exclude .tools \
  "${LOCAL_DIR}/" "${VPS_USER}@${VPS_HOST}:/opt/maskara/"

log "=== Deploy on VPS ==="
"${SSH[@]}" bash -s <<'REMOTE'
set -euo pipefail
cd /opt/maskara
mkdir -p docker/nginx/ssl
[ -f docker/nginx/ssl/fullchain.pem ] || openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/privkey.pem \
  -out docker/nginx/ssl/fullchain.pem -subj "/CN=maskara.bd"
chmod +x scripts/vps-redeploy.sh scripts/vps-fix-admin-deploy.sh 2>/dev/null || true
bash scripts/vps-redeploy.sh
docker exec -e RUN_SEED=true -e ADMIN_EMAIL=admin@maskara.bd \
  -e ADMIN_INITIAL_PASSWORD=Admin@123 maskara-backend npx prisma db seed 2>/dev/null || true
docker compose -f docker-compose.hostinger.yml ps
echo "OK: https://app.maskara.bd/admin"
REMOTE

log ""
log "=== DONE ==="
log "App: https://app.maskara.bd/admin"
log "Admin: admin@maskara.bd / Admin@123"
