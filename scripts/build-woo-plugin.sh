#!/bin/bash
set -e
cd "$(dirname "$0")/.."
mkdir -p frontend/public/downloads
rm -f frontend/public/downloads/maskara-woocommerce.zip
cd wordpress-plugin
zip -r ../frontend/public/downloads/maskara-woocommerce.zip maskara-woocommerce -x "*.DS_Store"
echo "✓ Plugin zip: frontend/public/downloads/maskara-woocommerce.zip"
