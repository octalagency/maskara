#!/bin/bash
cd "$(dirname "$0")"
chmod +x scripts/build-woo-plugin.sh

echo "=== Maskara WooCommerce Plugin ==="
./scripts/build-woo-plugin.sh

ZIP="$(pwd)/frontend/public/downloads/maskara-woocommerce.zip"

if [ ! -f "$ZIP" ]; then
  echo "✗ Zip তৈরি হয়নি"
  read -p "Press Enter..."
  exit 1
fi

echo ""
echo "✓ Plugin: $ZIP"
echo ""
echo "Browser download লিংক:"
echo "  http://localhost:3002/downloads/maskara-woocommerce.zip"
echo ""
echo "Finder-এ খুলছি..."
open "$ZIP"
open "http://localhost:3002/downloads/maskara-woocommerce.zip" 2>/dev/null || true
echo ""
read -p "Press Enter to close..."
