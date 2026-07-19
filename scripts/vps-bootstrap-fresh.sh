#!/bin/bash
# Hostinger Browser Terminal — FIRST install when /opt/maskara is missing.
# Creates repo, .env template, builds backend+worker+frontend.
set -euo pipefail

DIR="${MASKARA_DIR:-/opt/maskara}"
REPO="${MASKARA_REPO:-https://github.com/octalagency/maskara.git}"

echo "=== Maskara fresh bootstrap → $DIR ==="

if [ ! -d "$DIR/.git" ]; then
  rm -rf "$DIR"
  git clone "$REPO" "$DIR"
fi
cd "$DIR"
git fetch origin main
git checkout main
git reset --hard origin/main

if [ ! -f .env ]; then
  if [ -f .env.production.example ]; then
    cp .env.production.example .env
    echo "Created .env from .env.production.example — EDIT secrets before going live:"
    echo "  nano $DIR/.env"
    echo "  Required: POSTGRES_PASSWORD, JWT_SECRET, EPBX_API_KEY, GOOGLE_TTS_API_KEY, VOICE_WEBHOOK_SECRET"
  else
    echo "✗ No .env.production.example — create $DIR/.env manually"
    exit 1
  fi
fi

# Fail early if Google TTS missing (male Chirp3 path requires it)
if ! grep -qE '^GOOGLE_TTS_API_KEY=.+' .env; then
  echo "⚠ GOOGLE_TTS_API_KEY empty in .env — set it, then re-run this script"
  echo "  Without it, live dials refuse (by design — blocks portal female)."
fi

docker compose -f docker-compose.hostinger.yml build --no-cache backend frontend
docker compose -f docker-compose.hostinger.yml up -d --remove-orphans

echo "Waiting 60s for health..."
sleep 60
docker compose -f docker-compose.hostinger.yml ps

echo ""
echo "SHA: $(git rev-parse --short HEAD)"
echo "Verify:"
echo "  docker logs maskara-worker --tail 50 2>&1 | grep -E 'portalVoice|voice_gender|FULL voice|synth start'"
echo "  curl -sI https://api.maskara.bd/health/live | head -3"
echo ""
echo "Voice checklist:"
echo "  1) ePBX: Algenib (MALE) → Save Voice Profile"
echo "  2) Maskara settings: Algieba"
echo "  3) GOOGLE_TTS_API_KEY set on worker"
echo "✓ Bootstrap done"
