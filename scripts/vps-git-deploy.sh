#!/bin/bash
# VPS — GitHub থেকে latest code + redeploy
# Usage: bash scripts/vps-git-deploy.sh
set -euo pipefail

REPO="https://github.com/octalagency/maskara.git"
DIR="/opt/maskara"

if [ ! -d "$DIR/.git" ]; then
  echo "=== First-time clone ==="
  mkdir -p /opt
  if [ -d "$DIR" ] && [ ! -d "$DIR/.git" ]; then
    echo "Backing up existing $DIR to ${DIR}.bak.$(date +%s)"
    mv "$DIR" "${DIR}.bak.$(date +%s)"
  fi
  git clone "$REPO" "$DIR"
fi

cd "$DIR"
echo "=== git pull ==="
git fetch origin main
git checkout main 2>/dev/null || git checkout -b main origin/main
git pull origin main

if [ ! -f .env ]; then
  echo "=== Creating .env ==="
  JWT=$(openssl rand -hex 32)
  PG=$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)
  VOICE=$(openssl rand -hex 24)
  WOO=$(openssl rand -hex 24)
  cat > .env <<EOF
POSTGRES_PASSWORD=$PG
JWT_SECRET=$JWT
VOICE_WEBHOOK_SECRET=$VOICE
WOOCOMMERCE_WEBHOOK_SECRET=$WOO
APP_URL=https://app.maskara.bd
API_URL=https://api.maskara.bd
PUBLIC_API_URL=https://api.maskara.bd
FRONTEND_URL=https://app.maskara.bd
EPBX_API_KEY=znoOkJcxs6TdrKGreQ7Iobx5uTmvwMFwOHGcCQPR
VOICE_PROVIDER=epbx
EPBX_API_URL=https://maskara.epbx.bd/api/v1
EOF
fi

mkdir -p docker/nginx/ssl
[ -f docker/nginx/ssl/fullchain.pem ] || openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/privkey.pem \
  -out docker/nginx/ssl/fullchain.pem -subj "/CN=maskara.bd"

chmod +x scripts/vps-redeploy.sh scripts/vps-fix-502.sh 2>/dev/null || true
bash scripts/vps-redeploy.sh
