#!/bin/bash
# GitHub push helper — password কাজ করে না, PAT বা SSH লাগবে
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE_SSH="git@github.com:octalagency/maskara.git"
REMOTE_HTTPS="https://github.com/octalagency/maskara.git"

echo "=== Maskara → GitHub push ==="
echo ""

if [ ! -d .git ]; then
  echo "✗ git repo নেই — আগে: git init -b main"
  exit 1
fi

if ! git remote get-url origin &>/dev/null; then
  git remote add origin "$REMOTE_HTTPS"
fi

# Option 1: SSH key
if [ -f "$HOME/.ssh/id_ed25519.pub" ]; then
  echo "SSH key পাওয়া গেছে — SSH remote ব্যবহার করছি"
  git remote set-url origin "$REMOTE_SSH"
  git push -u origin main
  echo "✓ Push done"
  exit 0
fi

echo "GitHub password আর support করে না।"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "পদ্ধতি A — Personal Access Token (দ্রুত)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. খুলুন: https://github.com/settings/tokens/new"
echo "2. Note: maskara-deploy"
echo "3. Expiration: 90 days"
echo "4. Scope: repo (tick)"
echo "5. Generate token → copy করুন"
echo ""
echo "তারপর Terminal-এ:"
echo "  git push -u origin main"
echo "  Username: octalagency"
echo "  Password: <paste TOKEN here> (password নয়!)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "পদ্ধতি B — SSH key (recommended)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -r -p "SSH key তৈরি করব? (y/n): " ans
if [ "$ans" = "y" ] || [ "$ans" = "Y" ]; then
  read -r -p "GitHub email: " ghemail
  ssh-keygen -t ed25519 -C "$ghemail" -f "$HOME/.ssh/id_ed25519" -N ""
  eval "$(ssh-agent -s)"
  ssh-add "$HOME/.ssh/id_ed25519"
  echo ""
  echo "এই key GitHub-এ add করুন:"
  echo "https://github.com/settings/ssh/new"
  echo ""
  cat "$HOME/.ssh/id_ed25519.pub"
  echo ""
  read -r -p "GitHub-এ key add করলে Enter চাপুন..."
  git remote set-url origin "$REMOTE_SSH"
  ssh -T git@github.com || true
  git push -u origin main
  echo "✓ Push done"
fi
