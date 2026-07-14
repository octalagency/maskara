#!/bin/bash
# Hostinger Browser Terminal — rebuild backend+worker for Google Chirp3 live voice
# (Algieba→portal Algenib; stop Azure conflict → female WaveNet).
set -euo pipefail
cd /opt/maskara

git fetch origin main
git reset --hard origin/main

docker compose -f docker-compose.hostinger.yml build --no-cache backend
docker compose -f docker-compose.hostinger.yml up -d backend worker

# Frontend voice settings helper text
docker compose -f docker-compose.hostinger.yml build --no-cache frontend
docker compose -f docker-compose.hostinger.yml up -d frontend nginx

echo "Waiting 45s for health..."
sleep 45
docker compose -f docker-compose.hostinger.yml ps
echo ""
echo "=== backend voice / Google ==="
docker logs maskara-backend --tail 40 2>&1 | grep -iE 'voice|google|tts|Nest|error' || true
echo ""
echo "=== worker voice / Google ==="
docker logs maskara-worker --tail 80 2>&1 | grep -iE 'voice|google|tts|portalGoogle|Algenib|FULL voice|error' || true

echo ""
echo "✓ Backend+worker+frontend rebuilt"
echo "  Logs MUST show: tts_provider=google portalVoice=bn-IN-Chirp3-HD-Algenib voice_gender=male"
echo "  tts_language=bn-IN bangla_script=true skip_tts=false mode=custom_tts"
echo "  NO azure_voice / Nabanita in initiate FULL voice payload."
echo "  Optional:"
echo "  docker logs maskara-worker 2>&1 | grep -E 'portalVoice|FULL voice payload|voice_gender|Algenib'"
echo ""
echo "=== Checklist ==="
echo "  1) ePBX portal: Primary Voice = bn-IN-Chirp3-HD-Algenib (MALE) → Save Voice Profile"
echo "  2) Maskara settings: Algieba selected + Save"
echo "  3) git -C /opt/maskara rev-parse --short HEAD"
echo "  4) rebuild backend+worker (+frontend if settings UI changed)"
echo "  5) EPBX_FORCE_IVR must stay off"
