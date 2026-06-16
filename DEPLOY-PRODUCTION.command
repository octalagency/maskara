#!/bin/bash
cd "$(dirname "$0")"
chmod +x scripts/deploy-production.sh
./scripts/deploy-production.sh
read -p "Press Enter to close..."
