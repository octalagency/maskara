#!/bin/bash
# Full VPS deploy — run from Mac Terminal
set -euo pipefail
cd "$(dirname "$0")/.."

export MASKARA_SSH_HOST="${MASKARA_SSH_HOST:-148.135.137.47}"
export MASKARA_LOCAL_ROOT="$(pwd)"

PYTHON="${PYTHON:-python3}"
if ! $PYTHON -c "import paramiko" 2>/dev/null; then
  echo "Installing paramiko..."
  $PYTHON -m pip install paramiko -q
fi

echo "╔══════════════════════════════════════════════════╗"
echo "║  Maskara Deploy → $MASKARA_SSH_HOST"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "SSH password prompt আসবে — YOUR_ROOT_PASSWORD লিখবেন না!"
echo ""

$PYTHON scripts/remote-deploy.py
