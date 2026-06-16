#!/bin/bash
cd "$(dirname "$0")"
chmod +x scripts/rebuild-frontend.sh
./scripts/rebuild-frontend.sh
echo ""
read -p "Press Enter to close..."
