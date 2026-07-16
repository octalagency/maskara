#!/bin/bash
# Build WooCommerce plugin zip + update manifest (single source of truth for version).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLUGIN_DIR="$ROOT/wordpress-plugin/maskara-woocommerce"
MAIN="$PLUGIN_DIR/maskara-woocommerce.php"
UPDATE_JSON="$ROOT/frontend/public/downloads/maskara-woocommerce-update.json"
PUBLIC_DIR="$ROOT/frontend/public"
DOWNLOADS_DIR="$PUBLIC_DIR/downloads"

VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  VERSION="$(grep -E '^\s*\*\s*Version:' "$MAIN" | head -1 | sed 's/.*Version:\s*//;s/\s*$//')"
fi
if [ -z "$VERSION" ]; then
  echo "Could not detect plugin version from $MAIN" >&2
  exit 1
fi

echo "Building Maskara WooCommerce plugin v$VERSION"

python3 <<PY
import json, re, time, zipfile
from pathlib import Path

root = Path("$ROOT")
plugin_dir = Path("$PLUGIN_DIR")
version = "$VERSION"
main = plugin_dir / "maskara-woocommerce.php"
readme = plugin_dir / "readme.txt"
update_json = Path("$UPDATE_JSON")

text = main.read_text(encoding="utf-8")
text = re.sub(r"(?m)^(\s*\*\s*Version:\s*).*$", rf"\g<1>{version}", text, count=1)
text = re.sub(r"define\('MASKARA_VERSION',\s*'[^']+'\);", f"define('MASKARA_VERSION', '{version}');", text)
text = re.sub(r"get_option\('maskara_db_version'\)\s*!==\s*'[^']+'", f"get_option('maskara_db_version') !== '{version}'", text)
text = re.sub(r"update_option\('maskara_db_version',\s*'[^']+'\);", f"update_option('maskara_db_version', '{version}');", text)
main.write_text(text, encoding="utf-8")

if readme.exists():
    rt = readme.read_text(encoding="utf-8")
    rt = re.sub(r"(?m)^Stable tag:\s*.*$", f"Stable tag: {version}", rt, count=1)
    readme.write_text(rt, encoding="utf-8")

manifest = {
    "name": "Maskara Order Verification",
    "slug": "maskara-woocommerce",
    "version": version,
    "download_url": "https://app.maskara.bd/downloads/maskara-woocommerce.zip",
    "homepage": "https://maskara.bd",
    "requires": "5.8",
    "tested": "6.7",
    "requires_php": "7.4",
    "description": "AI voice order verification for WooCommerce. Confirm sets Completed + Pathao auto-deploy. Miss/cancel sets Cancelled.",
    "changelog": f"<h4>{version}</h4><ul><li>ঠিকানার টেক্সট থেকে শহর ধরে Pathao অটো-ডিপ্লয় (চট্টগ্রাম/Chittagong ইত্যাদি — Woo City ফিল্ড খালি থাকলেও)</li><li>BD city alias map + shipping/billing merge</li></ul><h4>1.5.9</h4><ul><li>Sync cancelled/refunded/failed Woo orders to Maskara (stops calls, dashboard CANCELLED)</li></ul><h4>1.5.8</h4><ul><li>ঠিকানা ঠিক হলে Pathao তে অটো-ডিপ্লয়</li><li>Orders লিস্টে ম্যানুয়াল «Pathao তে পাঠান» বাটন</li><li>Shipping+Billing ঠিকানা একসাথে যাচাই (City মিস হওয়া ফিক্স)</li></ul>",
}
update_json.parent.mkdir(parents=True, exist_ok=True)
update_json.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

zip_path = root / f"maskara-woocommerce-{version}.zip"
if zip_path.exists():
    zip_path.unlink()

with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
    for path in sorted(plugin_dir.rglob("*")):
        if not path.is_file() or path.name.startswith(".") or path.name == ".DS_Store":
            continue
        arc = "maskara-woocommerce/" + str(path.relative_to(plugin_dir)).replace("\\\\", "/")
        mt = time.localtime(path.stat().st_mtime)
        info = zipfile.ZipInfo(
            filename=arc,
            date_time=(mt.tm_year, mt.tm_mon, mt.tm_mday, mt.tm_hour, mt.tm_min, mt.tm_sec),
        )
        info.compress_type = zipfile.ZIP_DEFLATED
        info.create_system = 0
        info.external_attr = 0o644 << 16
        zf.writestr(info, path.read_bytes())

print("zip", zip_path, zip_path.stat().st_size)
PY

mkdir -p "$DOWNLOADS_DIR"
cp -f "$ROOT/maskara-woocommerce-$VERSION.zip" "$DOWNLOADS_DIR/maskara-woocommerce.zip"
if [ "$UPDATE_JSON" != "$DOWNLOADS_DIR/maskara-woocommerce-update.json" ]; then
  cp -f "$UPDATE_JSON" "$DOWNLOADS_DIR/maskara-woocommerce-update.json"
fi
cp -f "$DOWNLOADS_DIR/maskara-woocommerce.zip" "$PUBLIC_DIR/maskara-woocommerce.zip"
cp -f "$DOWNLOADS_DIR/maskara-woocommerce.zip" "$PUBLIC_DIR/maskara-woocommerce-$VERSION.zip"

# Keep legacy URLs serving the latest full package.
for legacy in 1.1.0 1.2.0 1.4.0 1.5.0 1.5.1 1.5.2 1.5.3 1.5.4 1.5.5 1.5.6 1.5.7 1.5.8 1.5.9 1.5.10; do
  cp -f "$DOWNLOADS_DIR/maskara-woocommerce.zip" "$PUBLIC_DIR/maskara-woocommerce-$legacy.zip"
done

echo "✓ Plugin v$VERSION"
echo "  zip: $DOWNLOADS_DIR/maskara-woocommerce.zip"
echo "  manifest: $UPDATE_JSON"
echo "  Integrations page reads version from manifest automatically"
