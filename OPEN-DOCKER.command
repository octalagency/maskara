#!/bin/bash
cd "$(dirname "$0")"
chmod +x scripts/open-docker.sh
./scripts/open-docker.sh
echo ""
echo "Whale icon stable হলে DOCKER-UPDATE.command চালান।"
read -p "Press Enter to close..."
