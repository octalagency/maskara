#!/bin/bash
# Production deploy — uploads full project + builds on VPS
set -euo pipefail
cd "$(dirname "$0")/.."

export MASKARA_SSH_HOST="${MASKARA_SSH_HOST:-148.135.137.47}"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Maskara Production Deploy → $MASKARA_SSH_HOST"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

PYTHON="${PYTHON:-python3}"
if ! $PYTHON -c "import paramiko" 2>/dev/null; then
  echo "Installing paramiko..."
  $PYTHON -m pip install paramiko -q
fi

# Optional: local docker build (not required — VPS builds from source)
if docker ps &>/dev/null; then
  echo "✓ Docker available (optional local build skipped — VPS will build)"
else
  echo "→ Docker not needed — VPS will build from uploaded source"
fi

echo ""
$PYTHON scripts/remote-deploy.py

echo ""
echo "Verify in browser:"
echo "  https://app.maskara.bd"
echo "  https://api.maskara.bd/health"
echo "  Admin: admin@maskara.bd / Admin@123"
