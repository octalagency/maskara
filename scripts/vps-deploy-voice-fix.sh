#!/bin/bash
# Hostinger Browser Terminal — rebuild backend+worker so Google TTS audio
# is Redis-shared (fixes female Azure নবনীতা fallback on live calls).
set -euo pipefail
cd /opt/maskara

git fetch origin main
git reset --hard origin/main

docker compose -f docker-compose.hostinger.yml build --no-cache backend
docker compose -f docker-compose.hostinger.yml up -d backend worker

# Frontend only if merchant voice UI also changed
docker compose -f docker-compose.hostinger.yml build --no-cache frontend
docker compose -f docker-compose.hostinger.yml up -d frontend nginx

echo "Waiting 45s for health..."
sleep 45
docker compose -f docker-compose.hostinger.yml ps
echo ""
echo "=== backend voice / Google / Redis ==="
docker logs maskara-backend --tail 40 2>&1 | grep -iE 'voice|google|tts|redis|Nest|error' || true
echo ""
echo "=== worker voice / Google / Redis ==="
docker logs maskara-worker --tail 40 2>&1 | grep -iE 'voice|google|tts|redis|error' || true

echo ""
echo "✓ Backend+worker+frontend rebuilt"
echo "  Settings → Algieba (or your Chirp3) select → new test call"
echo "  Logs should show: audio_url_sent=true  (NOT Azure নবনীতা)"
echo "  Optional: docker logs -f maskara-worker | grep '\\[voice\\]'"
