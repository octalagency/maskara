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
echo "  Logs MUST show: tts_text_present=true bangla_script=true voice_gender=male azure=bn-BD-PradeepNeural skip_tts=false mode=custom_tts"
echo "  For Algieba: merchantVoiceId=…Algieba googleVoice=bn-IN-Chirp3-HD-Algieba azure=bn-BD-PradeepNeural"
echo "  audio_url_sent may be true (Chirp3 best-effort) or false (Azure twin only) — never omit Bangla text."
echo "  Optional:"
echo "  docker logs maskara-worker 2>&1 | grep -E 'audio_url_sent|tts_text_present|azure=|voice_gender|googleVoice|refuse audio_url'"
echo ""
echo "=== Hostinger verify checklist ==="
echo "  1) git -C /opt/maskara rev-parse --short HEAD   # expect this SHA after pull"
echo "  2) docker exec maskara-worker sh -c 'test -n \"\$GOOGLE_TTS_API_KEY\" && echo GOOGLE_KEY=set:\${#GOOGLE_TTS_API_KEY} || echo GOOGLE_KEY=MISSING'"
echo "  3) docker exec maskara-redis redis-cli KEYS 'maskara:tts-audio:*' | head"
echo "  4) After a test dial: curl -sI https://api.maskara.bd/voice/tts-audio/<id-from-logs>"
echo "  5) If still wrong gender: confirm worker log has voice_gender matching selection; disable portal default English/female IVR (EPBX_FORCE_IVR must stay off)"
