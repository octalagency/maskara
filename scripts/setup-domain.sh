#!/bin/bash
# maskara.bd domain setup — DNS guide + production env template
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

APP_DOMAIN="${APP_DOMAIN:-app.maskara.bd}"
API_DOMAIN="${API_DOMAIN:-api.maskara.bd}"
APEX_DOMAIN="${APEX_DOMAIN:-maskara.bd}"
VPS_IP="${VPS_IP:-}"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  maskara.bd Domain Setup                                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Domain structure:"
echo "  $APEX_DOMAIN, www.$APEX_DOMAIN  →  redirect →  https://$APP_DOMAIN"
echo "  $APP_DOMAIN                   →  Frontend (Next.js)"
echo "  $API_DOMAIN                   →  API + webhooks (NestJS)"
echo ""

if [ -z "$VPS_IP" ]; then
  echo "VPS IP দিন (optional DNS check):"
  echo "  VPS_IP=YOUR_SERVER_IP bash scripts/setup-domain.sh"
  echo ""
fi

echo "=== DNS Records (.bd registrar panel-এ add করুন) ==="
echo ""
printf "%-20s %-8s %-30s\n" "Host / Name" "Type" "Value"
printf "%-20s %-8s %-30s\n" "--------------------" "--------" "------------------------------"
if [ -n "$VPS_IP" ]; then
  printf "%-20s %-8s %-30s\n" "@" "A" "$VPS_IP"
  printf "%-20s %-8s %-30s\n" "www" "CNAME" "$APEX_DOMAIN"
  printf "%-20s %-8s %-30s\n" "app" "A" "$VPS_IP"
  printf "%-20s %-8s %-30s\n" "api" "A" "$VPS_IP"
else
  printf "%-20s %-8s %-30s\n" "@" "A" "<YOUR_VPS_IP>"
  printf "%-20s %-8s %-30s\n" "www" "CNAME" "maskara.bd"
  printf "%-20s %-8s %-30s\n" "app" "A" "<YOUR_VPS_IP>"
  printf "%-20s %-8s %-30s\n" "api" "A" "<YOUR_VPS_IP>"
fi
echo ""
echo "DNS propagate হতে ৫ মিনিট–২৪ ঘণ্টা লাগতে পারে।"
echo ""

if [ -n "$VPS_IP" ]; then
  echo "=== DNS Check ==="
  for host in "$APEX_DOMAIN" "www.$APEX_DOMAIN" "$APP_DOMAIN" "$API_DOMAIN"; do
    ip=$(dig +short "$host" 2>/dev/null | tail -1 || true)
    if [ -n "$ip" ]; then
      if [ "$ip" = "$VPS_IP" ] || [ "$ip" = "$APEX_DOMAIN." ]; then
        echo "  ✓ $host → $ip"
      else
        echo "  ⚠ $host → $ip (expected $VPS_IP)"
      fi
    else
      echo "  ✗ $host — not resolved yet"
    fi
  done
  echo ""
fi

if [ ! -f .env ] && [ -f .env.production.example ]; then
  echo "=== Creating .env from production template ==="
  cp .env.production.example .env
  # Apply maskara.bd domains
  if command -v sed &>/dev/null; then
    sed -i.bak \
      -e "s|APP_URL=.*|APP_URL=https://$APP_DOMAIN|" \
      -e "s|API_URL=.*|API_URL=https://$API_DOMAIN|" \
      -e "s|PUBLIC_API_URL=.*|PUBLIC_API_URL=https://$API_DOMAIN|" \
      -e "s|FRONTEND_URL=.*|FRONTEND_URL=https://$APP_DOMAIN|" \
      .env 2>/dev/null || sed \
      -e "s|APP_URL=.*|APP_URL=https://$APP_DOMAIN|" \
      -e "s|API_URL=.*|API_URL=https://$API_DOMAIN|" \
      -e "s|PUBLIC_API_URL=.*|PUBLIC_API_URL=https://$API_DOMAIN|" \
      -e "s|FRONTEND_URL=.*|FRONTEND_URL=https://$APP_DOMAIN|" \
      .env.production.example > .env
    rm -f .env.bak
  fi
  echo "  ✓ Created .env — secrets (JWT, passwords) পূরণ করুন"
else
  echo "=== .env ==="
  if [ -f .env ]; then
    echo "  .env exists — verify these values:"
    grep -E '^(APP_URL|API_URL|PUBLIC_API_URL|FRONTEND_URL)=' .env 2>/dev/null || true
  else
    echo "  cp .env.production.example .env"
  fi
fi

echo ""
echo "=== Production URLs (.env) ==="
echo "  APP_URL=https://$APP_DOMAIN"
echo "  FRONTEND_URL=https://$APP_DOMAIN"
echo "  API_URL=https://$API_DOMAIN"
echo "  PUBLIC_API_URL=https://$API_DOMAIN"
echo ""
echo "=== ePBX webhooks (maskara.epbx.bd portal) ==="
echo "  General:  https://$API_DOMAIN/voice/webhook/epbx"
echo "  DTMF:     https://$API_DOMAIN/voice/webhook/epbx/dtmf"
echo "  Status:   https://$API_DOMAIN/voice/webhook/epbx/status"
echo ""
echo "=== Deploy steps (VPS-এ) ==="
echo "  1. bash scripts/setup-domain.sh"
echo "  2. nano .env   # secrets fill করুন"
echo "  3. bash scripts/deploy-production.sh"
echo "  4. sudo bash scripts/setup-ssl.sh $APEX_DOMAIN www.$APEX_DOMAIN $APP_DOMAIN $API_DOMAIN"
echo "  5. docker exec -e RUN_SEED=true -e ADMIN_EMAIL=admin@maskara.bd \\"
echo "       -e ADMIN_INITIAL_PASSWORD='...' maskara-backend npx prisma db seed"
echo ""
echo "Docs: docs/DOMAIN-SETUP.md"
echo ""
