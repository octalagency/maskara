#!/bin/bash
# Production push → Docker Hub + Hostinger VPS deploy
set -euo pipefail
cd "$(dirname "$0")"

export DOCKER_USERNAME="${DOCKER_USERNAME:-octalagency}"
export MASKARA_SSH_HOST="${MASKARA_SSH_HOST:-148.135.137.47}"

clear
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Maskara PRODUCTION PUSH                                 ║"
echo "║  app.maskara.bd + api.maskara.bd                         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

if ! docker ps &>/dev/null; then
  echo "✗ Docker Desktop চালু করুন, তারপর আবার run করুন"
  read -p "Enter..."
  exit 1
fi

echo "Docker Hub login (octalagency) — password/token দিন:"
docker login -u "$DOCKER_USERNAME" || true

echo ""
echo "VPS root password (Hostinger):"
read -rs MASKARA_SSH_PASSWORD
export MASKARA_SSH_PASSWORD
echo ""

bash scripts/docker-deploy-full.sh

echo ""
echo "Verify:"
echo "  https://app.maskara.bd"
echo "  https://api.maskara.bd/health"
read -p "Done. Press Enter..."
