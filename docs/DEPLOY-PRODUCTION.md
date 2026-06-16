# Production Deploy Guide

## 1. VPS তৈরি করুন

- Ubuntu 22.04+, 2GB+ RAM
- Docker + Docker Compose install

## 2. Domain DNS

| Host | Type | Value |
|------|------|-------|
| `@` (maskara.bd) | A | VPS IP |
| `www` | CNAME | maskara.bd |
| `app` | A | VPS IP |
| `api` | A | VPS IP |

Quick setup:
```bash
VPS_IP=148.135.137.47 bash scripts/setup-domain.sh
```

See **docs/DNS-RECORDS.md** for copy-paste DNS table.

## 3. Environment setup

```bash
cp .env.production.example .env
nano .env   # সব CHANGE_ME values পূরণ করুন
```

Generate secrets:
```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 24   # VOICE_WEBHOOK_SECRET
openssl rand -hex 24   # WOOCOMMERCE_WEBHOOK_SECRET
```

## 4. Deploy

```bash
chmod +x scripts/deploy-production.sh scripts/setup-ssl.sh
./scripts/deploy-production.sh
```

## 5. SSL Certificate

```bash
sudo ./scripts/setup-ssl.sh maskara.bd www.maskara.bd app.maskara.bd api.maskara.bd
```

## 6. First admin user

```bash
docker exec -e RUN_SEED=true \
  -e ADMIN_EMAIL=admin@maskara.bd \
  -e ADMIN_INITIAL_PASSWORD='YourStrongPassword' \
  maskara-backend npx prisma db seed
```

## 7. WooCommerce plugin (filobeauty.xyz)

| Field | Value |
|-------|-------|
| Maskara API URL | `https://api.maskara.bd` |
| API Key | Dashboard → API Keys |
| Webhook Secret | same as `WOOCOMMERCE_WEBHOOK_SECRET` |

## 8. ePBX callback

ePBX portal-এ webhook URL:
```
https://api.maskara.bd/voice/webhook/epbx?secret=YOUR_VOICE_WEBHOOK_SECRET
```

`PUBLIC_API_URL` অবশ্যই HTTPS হতে হবে।

## Verify

```bash
curl https://api.maskara.bd/health
curl https://api.maskara.bd/integrations/woocommerce/ping -H "X-API-Key: YOUR_KEY"
```
