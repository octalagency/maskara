#!/bin/bash
cd "$(dirname "$0")"
echo "=== ippbx.com.bd Setup for Maskara ==="
open "https://ippbx.com.bd/" 2>/dev/null || true
open docs/IPPBX-BANGLA.md 2>/dev/null || cat docs/IPPBX-BANGLA.md
echo ""
echo "Contact ippbx for API credentials:"
echo "  +880 9678 22 11 11"
echo ""
echo "Add to .env:"
echo "  VOICE_PROVIDER=ippbx"
echo "  IPPBX_API_URL=..."
echo "  IPPBX_API_KEY=..."
echo ""
open -e .env 2>/dev/null || true
read -p "Press Enter to close..."
