#!/bin/bash
cd "$(dirname "$0")"
chmod +x scripts/epbx-dashboard-setup.sh
./scripts/epbx-dashboard-setup.sh
read -p "Press Enter to close..."
