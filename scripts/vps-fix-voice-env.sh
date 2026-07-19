#!/bin/bash
# Hostinger Browser Terminal — fix voice .env (clear IVR) + rebuild.
# Usage: bash /opt/maskara/scripts/vps-fix-voice-env.sh
set -euo pipefail

DIR="${MASKARA_DIR:-/opt/maskara}"
cd "$DIR"

echo "=== Fix Maskara voice env ==="

# Pull latest (IVR permanently ignored in code)
git fetch origin main
git reset --hard origin/main

# Strip dangerous IVR / force flags
sed -i '/^EPBX_IVR_ID=/d' .env
sed -i '/^EPBX_FORCE_IVR=/d' .env
echo 'EPBX_IVR_ID=' >> .env
echo 'EPBX_FORCE_IVR=0' >> .env

# Ensure caller IDs exist (safe defaults)
grep -q '^EPBX_CALLER_ID=' .env || echo 'EPBX_CALLER_ID=09639444146' >> .env
grep -q '^EPBX_DID=' .env || echo 'EPBX_DID=09639444146' >> .env
grep -q '^VOICE_PROVIDER=' .env || echo 'VOICE_PROVIDER=epbx' >> .env

if ! grep -qE '^GOOGLE_TTS_API_KEY=.+' .env; then
  echo "✗ GOOGLE_TTS_API_KEY missing in .env — add it then re-run:"
  echo "  nano $DIR/.env"
  exit 1
fi

echo "GOOGLE_TTS_API_KEY: SET"
echo "EPBX_IVR_ID: $(grep '^EPBX_IVR_ID=' .env | tail -1)"
echo "EPBX_FORCE_IVR: $(grep '^EPBX_FORCE_IVR=' .env | tail -1)"
echo "SHA: $(git rev-parse --short HEAD)"

docker compose -f docker-compose.hostinger.yml build --no-cache backend
docker compose -f docker-compose.hostinger.yml up -d backend worker
docker compose -f docker-compose.hostinger.yml build --no-cache frontend
docker compose -f docker-compose.hostinger.yml up -d frontend nginx

echo "Waiting 45s..."
sleep 45
docker compose -f docker-compose.hostinger.yml ps

docker exec maskara-worker sh -c 'test -n "$GOOGLE_TTS_API_KEY" && echo WORKER_GOOGLE=OK || echo WORKER_GOOGLE=MISSING'
echo "✓ Done — test a call; logs:"
echo "  docker logs maskara-worker --tail 40 2>&1 | grep -E 'Ignoring EPBX_IVR|portalVoice|voice_gender|FULL voice'"
