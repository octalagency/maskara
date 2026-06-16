#!/bin/bash
cd "$(dirname "$0")"
chmod +x scripts/docker-deploy-full.sh
./scripts/docker-deploy-full.sh
read -p "Press Enter to close..."
