#!/bin/bash
cd "$(dirname "$0")"
chmod +x scripts/configure-epbx-local.sh
./scripts/configure-epbx-local.sh
read -p "Press Enter to close..."
