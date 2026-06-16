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
FORCE="${2:-}"

git add -A
if git diff --cached --quiet; then
  if [ "$FORCE" = "--deploy" ]; then
    git commit --allow-empty -m "$MSG"
  else
    echo "No file changes. Pushing main and checking remote..."
    git push "https://octalagency:${TOKEN}@github.com/octalagency/maskara.git" main
    echo ""
    echo "To redeploy without code changes: bash scripts/push-and-deploy.sh \"$MSG\" --deploy"
    exit 0
  fi
else
  git commit -m "$MSG"
fi

git push "https://octalagency:${TOKEN}@github.com/octalagency/maskara.git" main

echo ""
echo "✓ Pushed — GitHub Actions deploying..."
echo "  https://github.com/octalagency/maskara/actions"
echo "  Live: https://app.maskara.bd/admin (2-30 min)"
