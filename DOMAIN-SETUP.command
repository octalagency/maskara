#!/bin/bash
cd "$(dirname "$0")"
chmod +x scripts/setup-domain.sh
./scripts/setup-domain.sh
read -p "Press Enter to close..."
