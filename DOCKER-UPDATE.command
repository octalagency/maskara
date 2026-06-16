#!/bin/bash
cd "$(dirname "$0")"
clear
echo "Maskara Docker Update শুরু হচ্ছে..."
chmod +x scripts/*.sh *.command 2>/dev/null
xattr -cr . 2>/dev/null || true
./scripts/docker-update.sh
STATUS=$?
echo ""
if [ $STATUS -ne 0 ]; then
  echo "✗ Update ব্যর্থ। নিচের একটা চেষ্টা করুন:"
  echo "  1. OPEN-DOCKER.command → তারপর আবার DOCKER-UPDATE"
  echo "  2. Terminal খুলে: cd /Users/tudo/maskara && ./scripts/docker-update.sh"
  echo "  3. Docker reinstall: DOCKER-INSTALL.command"
fi
read -p "Press Enter to close..."
