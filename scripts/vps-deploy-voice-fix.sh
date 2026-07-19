#!/bin/bash
# Hostinger — pull voice fix + rebuild. Bootstraps /opt/maskara if missing.
set -euo pipefail

DIR="${MASKARA_DIR:-/opt/maskara}"

if [ ! -d "$DIR/.git" ]; then
  echo "⚠ $DIR missing — running fresh bootstrap"
  bash "$(dirname "$0")/vps-bootstrap-fresh.sh"
  exit $?
fi

cd "$DIR"
git fetch origin main
git reset --hard origin/main

docker compose -f docker-compose.hostinger.yml build --no-cache backend
docker compose -f docker-compose.hostinger.yml up -d backend worker
docker compose -f docker-compose.hostinger.yml build --no-cache frontend
docker compose -f docker-compose.hostinger.yml up -d frontend nginx

echo "Waiting 45s..."
sleep 45
docker compose -f docker-compose.hostinger.yml ps

echo ""
echo "SHA: $(git rev-parse --short HEAD)"
echo "=== worker voice ==="
docker logs maskara-worker --tail 80 2>&1 | grep -iE 'voice|synth|portalVoice|Algenib|Algieba|FULL voice|error' || true
echo ""
echo "Expect after a test call: portalVoice=bn-IN-Chirp3-HD-Algenib voice_gender=male audio_url_sent=true"
echo "Checklist: ePBX Save Voice Profile (Algenib MALE) + Maskara Algieba + GOOGLE_TTS_API_KEY"
