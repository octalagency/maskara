#!/bin/bash
cd "$(dirname "$0")"

echo "=== Maskara Frontend Restart ==="
echo ""

# Port 3002 খালি করা
for pid in $(lsof -ti:3002 2>/dev/null); do
  kill -9 "$pid" 2>/dev/null && echo "Stopped process $pid on port 3002"
done
sleep 2

if lsof -ti:3002 &>/dev/null; then
  echo "⚠ Port 3002 এখনো ব্যবহারে। Activity Monitor থেকে 'node' process বন্ধ করুন।"
  echo "   অথবা Terminal-এ: lsof -ti:3002 | xargs kill -9"
  read -p "Press Enter to continue anyway..."
fi

chmod +x scripts/start-frontend-local.sh scripts/build-woo-plugin.sh
./scripts/build-woo-plugin.sh
./scripts/start-frontend-local.sh
