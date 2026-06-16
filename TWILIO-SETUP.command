#!/bin/bash
cd "$(dirname "$0")"
echo "=== Maskara Twilio Setup ==="
echo ""
echo "Guide: docs/TWILIO-BANGLA.md"
echo ""
open docs/TWILIO-BANGLA.md 2>/dev/null || cat docs/TWILIO-BANGLA.md
echo ""
chmod +x scripts/check-twilio.sh
./scripts/check-twilio.sh 2>/dev/null || echo "(Add credentials to .env first)"
echo ""
echo "Edit .env file:"
open -e .env 2>/dev/null || echo "  /Users/tudo/maskara/.env"
echo ""
read -p "Press Enter to close..."
