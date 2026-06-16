#!/bin/bash
cd "$(dirname "$0")"
chmod +x scripts/deploy-vps.sh
./scripts/deploy-vps.sh
read -p "Press Enter to close..."
