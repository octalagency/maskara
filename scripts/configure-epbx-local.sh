#!/bin/bash
# ePBX local configuration — .env থেকে settings apply + webhook URLs দেখায়
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export PATH="$ROOT/.tools/node/bin:$PATH"

# Persist to standalone API settings (loads .env inside node)
mkdir -p standalone-api/data
node -e "
const fs = require('fs');
const path = require('path');
function loadEnv() {
  const p = path.join(process.cwd(), '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnv();
const file = path.join('standalone-api/data/local-settings.json');
let cur = {};
try { cur = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
cur.voice_providers = {
  provider: process.env.VOICE_PROVIDER || 'epbx',
  publicApiUrl: process.env.PUBLIC_API_URL || process.env.API_URL || 'http://localhost:4000',
  epbx: {
    enabled: true,
    apiUrl: process.env.EPBX_API_URL || 'https://maskara.epbx.bd/api/v1',
    apiKey: process.env.EPBX_API_KEY || cur.voice_providers?.epbx?.apiKey || '',
    customerId: process.env.EPBX_CUSTOMER_ID || '',
    ivrId: process.env.EPBX_IVR_ID || '',
  },
};
cur.updatedAt = new Date().toISOString();
fs.writeFileSync(file, JSON.stringify(cur, null, 2));
const key = cur.voice_providers.epbx.apiKey;
console.log('✓ Saved standalone-api/data/local-settings.json');
console.log('  API Key:', key ? 'configured ✓' : 'NOT SET ✗');
"

API_PORT="${PORT:-4000}"
PUBLIC_URL="http://localhost:$API_PORT"

echo "=== ePBX Local Configuration ==="
echo ""
echo "Webhook URLs (ePBX dashboard-এ দিন):"
echo "  General:  $PUBLIC_URL/voice/webhook/epbx"
echo "  DTMF:     $PUBLIC_URL/voice/webhook/epbx/dtmf"
echo "  Status:   $PUBLIC_URL/voice/webhook/epbx/status"
echo ""
if curl -sf "http://localhost:$API_PORT/voice/provider" >/dev/null 2>&1; then
  echo "API status:"
  curl -s "http://localhost:$API_PORT/voice/provider" | node -pe "JSON.stringify(JSON.parse(require('fs').readFileSync(0,'utf8')),null,2)"
  echo ""
  echo "Test call (আপনার নম্বর দিন):"
  echo "  curl -X POST http://localhost:$API_PORT/voice/test-call \\"
  echo "    -H 'Authorization: Bearer YOUR_ADMIN_TOKEN' \\"
  echo "    -H 'Content-Type: application/json' \\"
  echo "    -d '{\"phone\":\"017XXXXXXXX\"}'"
else
  echo "API চালু নেই। প্রথমে: bash scripts/start-dev-watch.sh"
fi

echo ""
echo "Admin Voice Config: http://localhost:3002/admin/config"
echo "Local webhook-এর জন্য tunnel: bash scripts/start-api-tunnel.sh"
echo ""
