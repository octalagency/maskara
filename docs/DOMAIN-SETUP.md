# maskara.bd Domain Setup

## Domain structure

| Domain | Purpose |
|--------|---------|
| **maskara.bd** | Apex — redirects to app |
| **www.maskara.bd** | Redirects to app |
| **app.maskara.bd** | Frontend (admin, merchant, landing) |
| **api.maskara.bd** | API, ePBX webhooks, WooCommerce plugin |

```
User → app.maskara.bd  → nginx → frontend:3000
ePBX → api.maskara.bd  → nginx → backend:4000
```

---

## Step 1: DNS (.bd registrar)

BTCL বা আপনার domain reseller panel-এ:

| Host | Type | Value |
|------|------|-------|
| `@` | A | `<VPS_IP>` |
| `www` | CNAME | `maskara.bd` |
| `app` | A | `<VPS_IP>` |
| `api` | A | `<VPS_IP>` |

Check:
```bash
VPS_IP=YOUR_IP bash scripts/setup-domain.sh
```

---

## Step 2: Production `.env`

```bash
cp .env.production.example .env
```

Required:
```env
APP_URL=https://app.maskara.bd
FRONTEND_URL=https://app.maskara.bd
API_URL=https://api.maskara.bd
PUBLIC_API_URL=https://api.maskara.bd
NEXT_PUBLIC_PRODUCTION=true
```

Generate secrets:
```bash
openssl rand -hex 32   # JWT_SECRET
openssl rand -hex 24   # VOICE_WEBHOOK_SECRET
openssl rand -hex 24   # WOOCOMMERCE_WEBHOOK_SECRET
```

---

## Step 3: Deploy + SSL

```bash
bash scripts/deploy-production.sh
sudo bash scripts/setup-ssl.sh maskara.bd www.maskara.bd app.maskara.bd api.maskara.bd
```

---

## Step 4: ePBX webhooks

https://maskara.epbx.bd/portal/developer

| Event | URL |
|-------|-----|
| General | `https://api.maskara.bd/voice/webhook/epbx` |
| DTMF | `https://api.maskara.bd/voice/webhook/epbx/dtmf` |
| Status | `https://api.maskara.bd/voice/webhook/epbx/status` |

---

## Step 5: Verify

```bash
curl https://api.maskara.bd/health
curl -I https://app.maskara.bd
curl -I https://maskara.bd    # should redirect to app
```

---

## Docker build (production URLs baked in)

Frontend image build করার সময়:
```bash
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.maskara.bd \
  --build-arg NEXT_PUBLIC_APP_URL=https://app.maskara.bd \
  --build-arg NEXT_PUBLIC_PRODUCTION=true \
  -t maskara-frontend ./frontend
```

Or: `DOCKER_USERNAME=octalagency bash scripts/docker-push.sh`
