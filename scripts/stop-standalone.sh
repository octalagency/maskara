#!/bin/bash
# Stop standalone API so Docker backend can use port 4000

echo "Stopping standalone API on port 4000..."
launchctl unload "$HOME/Library/LaunchAgents/com.maskara.api.plist" 2>/dev/null || true

PIDS=$(lsof -ti:4000 2>/dev/null || true)
if [ -n "$PIDS" ]; then
  for pid in $PIDS; do
    CMD=$(ps -p "$pid" -o command= 2>/dev/null || echo "")
    if echo "$CMD" | grep -q "standalone-api/server.js"; then
      kill "$pid" 2>/dev/null && echo "  Stopped standalone API (pid $pid)"
    fi
  done
fi
