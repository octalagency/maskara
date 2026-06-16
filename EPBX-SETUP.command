#!/bin/bash
cd "$(dirname "$0")"
echo "=== ePBX.bd Setup for Maskara ==="
open "https://epbx.bd/register" 2>/dev/null || true
open docs/EPBX-BANGLA.md 2>/dev/null || cat docs/EPBX-BANGLA.md
echo ""
echo "Add to .env:"
echo "  VOICE_PROVIDER=epbx"
echo "  EPBX_API_KEY=your_key"
echo "  PUBLIC_API_URL=https://your-domain.com"
echo ""
open -e .env 2>/dev/null || true
chmod +x scripts/check-voice-provider.sh
./scripts/check-voice-provider.sh 2>/dev/null || true
read -p "Press Enter to close..."
