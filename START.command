#!/bin/bash
cd "$(dirname "$0")"
chmod +x scripts/start-all.sh
./scripts/start-all.sh
echo ""
read -p "Press Enter to close..."
