#!/bin/bash
# ePBX dashboard setup — maskara.epbx.bd (manual login required)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="$ROOT/.tools/node/bin:$PATH"

API_PORT="${PORT:-4000}"
PUBLIC_URL="${PUBLIC_API_URL:-http://localhost:$API_PORT}"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ePBX Setup — maskara.epbx.bd                           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Login email: octalagency@gmail.com"
echo "(password আপনার দেওয়া — এখানে save করা হয়নি)"
echo ""

bash "$ROOT/scripts/configure-epbx-local.sh" 2>/dev/null | tail -15

echo ""
echo "=== ePBX Dashboard-এ করুন ==="
echo ""
echo "1. Login: https://maskara.epbx.bd/login"
echo "   Email: octalagency@gmail.com"
echo ""
echo "2. Developer API: https://maskara.epbx.bd/portal/developer"
echo "   → Application Name: Maskara"
echo "   → Generate Token → copy করুন"
echo "   → Admin panel-এ paste: http://localhost:3002/admin/config"
echo ""
echo "3. Webhook URLs (Developer settings-এ):"
echo "   General:  $PUBLIC_URL/voice/webhook/epbx"
echo "   DTMF:     $PUBLIC_URL/voice/webhook/epbx/dtmf"
echo "   Status:   $PUBLIC_URL/voice/webhook/epbx/status"
echo ""
echo "   ⚠ Local webhook-এর জন্য tunnel:"
echo "   bash scripts/start-api-tunnel.sh"
echo "   → tunnel URL কে Public API URL হিসেবে admin config-এ save করুন"
echo ""
echo "4. IVR (optional): https://maskara.epbx.bd/portal/ivr-menus"
echo "   → IVR ID admin config-এ দিন"
echo ""
echo "5. Test: http://localhost:3002/admin/config → Test Call"
echo ""

open "https://maskara.epbx.bd/login" 2>/dev/null || true
open "https://maskara.epbx.bd/portal/developer" 2>/dev/null || true
open "http://localhost:3002/admin/config" 2>/dev/null || true
