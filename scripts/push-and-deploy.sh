#!/bin/bash
# git push → GitHub Actions auto deploy (Cursor/Mac)
set -euo pipefail
cd "$(dirname "$0")/.."

TOKEN_FILE="$HOME/.config/maskara/github_token"
TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"

if [ -z "$TOKEN" ] && [ -f "$TOKEN_FILE" ]; then
  TOKEN=$(cat "$TOKEN_FILE")
fi

if [ -z "$TOKEN" ]; then
  echo "No GitHub token. Run once: bash scripts/setup-auto-deploy.sh"
  exit 1
fi

MSG="${1:-Deploy update}"
git add -A
git diff --cached --quiet && { echo "Nothing to commit"; exit 0; }
git commit -m "$MSG"
git push "https://octalagency:${TOKEN}@github.com/octalagency/maskara.git" main

echo ""
echo "✓ Pushed — GitHub Actions deploying..."
echo "  https://github.com/octalagency/maskara/actions"
echo "  Live: https://app.maskara.bd/admin (2-30 min)"
