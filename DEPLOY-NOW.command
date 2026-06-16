#!/bin/bash
# Double-click (Mac) — full upload + deploy to Hostinger VPS
set -euo pipefail
cd "$(dirname "$0")/.."

export MASKARA_SSH_HOST="${MASKARA_SSH_HOST:-148.135.137.47}"
export MASKARA_LOCAL_ROOT="$(pwd)"

clear
echo "╔══════════════════════════════════════════════════╗"
echo "║  Maskara Deploy → $MASKARA_SSH_HOST"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "VPS password দিন (root@148.135.137.47)"
echo "Build ১৫–২৫ মিনিট লাগতে পারে — window বন্ধ করবেন না"
echo ""

PYTHON="${PYTHON:-python3}"
$PYTHON -c "import paramiko" 2>/dev/null || $PYTHON -m pip install paramiko -q

$PYTHON scripts/remote-deploy.py

echo ""
read -r -p "Press Enter to close..."
