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
docker logs maskara-worker --tail 80 2>&1 | grep -iE 'voice|google|tts|redis|audio_url|error' || true

echo ""
echo "✓ Backend+worker+frontend rebuilt"
echo "  Merchants on নবনীতা are auto-migrated to Algieba (migration + live lock)."
echo "  Logs should show: audio_url_sent=true language=bn-IN redis_cached=true tts_text_present=true"
echo "  Optional:"
echo "  docker logs maskara-worker 2>&1 | grep -E 'audio_url_sent|language=bn-IN|redis_cached'"
