#!/bin/bash
cd "$(dirname "$0")"
chmod +x scripts/stop-standalone.sh scripts/start-docker.sh scripts/start-all.sh
./scripts/start-docker.sh
echo ""
read -p "Press Enter to close..."
