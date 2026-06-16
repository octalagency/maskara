#!/bin/bash
# একবার চালান — পরে Cursor থেকে git push = auto deploy
set -euo pipefail
cd "$(dirname "$0")/.."

echo "╔══════════════════════════════════════════════════╗"
echo "║  Maskara Auto-Deploy Setup (GitHub Actions)      ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

echo "Step 1: GitHub Secrets (আপনি already set করেছেন কিনা check করুন)"
echo "  https://github.com/octalagency/maskara/settings/secrets/actions"
echo "  Required: VPS_HOST, VPS_USER, VPS_SSH_PASSWORD"
echo ""
read -r -p "Secrets set আছে? (y/n): " ok
[ "$ok" != "y" ] && [ "$ok" != "Y" ] && { echo "Secrets set করে আবার চালান"; exit 1; }

echo ""
echo "Step 2: GitHub Token (repo + workflow scope)"
echo "  https://github.com/settings/tokens/new"
read -rs -p "Paste token (hidden): " GH_TOKEN
echo ""

mkdir -p "$HOME/.config/maskara"
echo "$GH_TOKEN" > "$HOME/.config/maskara/github_token"
chmod 600 "$HOME/.config/maskara/github_token"
echo "✓ Token saved for future push-and-deploy"

git add .github/workflows/deploy-vps.yml
git commit -m "Enable auto deploy workflow" 2>/dev/null || true

echo "Step 3: Push to GitHub..."
git push "https://octalagency:${GH_TOKEN}@github.com/octalagency/maskara.git" main

echo ""
echo "✓ Setup done!"
echo "  Actions: https://github.com/octalagency/maskara/actions"
echo "  Live:    https://app.maskara.bd/admin"
echo ""
echo "পরে Cursor/Mac থেকে:"
echo "  git add -A && git commit -m 'update' && git push"
echo "  → GitHub auto deploy করবে"
