# Real System চালু করার Guide

## বর্তমান অবস্থা

| Mode | Status | কী করে |
|------|--------|--------|
| **Standalone** (এখন) | ✅ চলছে | Admin panel demo — memory data |
| **Real Docker** | ❌ Docker ভাঙা | Database + real calls + orders |

**সমস্যা:** `Docker.app` install আছে কিন্তু **executable missing** — reinstall লাগবে।

---

## Step 1: Docker Desktop Reinstall (একবার)

1. পুরনো Docker uninstall:
   - Applications → Docker.app → Trash
   - অথবা: https://docs.docker.com/desktop/uninstall/

2. নতুন download:
   - https://www.docker.com/products/docker-desktop/
   - **Mac Apple Silicon** (M1/M2/M3) বা **Intel** select করুন

3. Install করে **Docker Desktop open** করুন

4. Whale icon menu bar-এ **stable** হওয়া পর্যন্ত wait (1-2 min)

5. **FIX.command** double-click:
   ```
   /Users/tudo/maskara/FIX.command
   ```

6. Success: Terminal-এ `✓ Real NestJS backend is UP` দেখবেন

---

## Step 2: Verify Real System

Browser check:

| URL | Expected |
|-----|----------|
| http://localhost:4000/health | `{"status":"ok","service":"maskara-api"}` |
| http://localhost:4000/docs | Swagger UI |
| http://localhost:3000/admin/login | Login works |

Test order (simulate mode without Twilio):
```bash
./scripts/test-api.sh
```

---

## Step 3: Twilio — Real Bangla Call

1. **TWILIO-SETUP.command** double-click:
   ```
   /Users/tudo/maskara/TWILIO-SETUP.command
   ```

2. Twilio account: https://www.twilio.com/try-twilio

3. `.env` file-এ credentials দিন:
   ```env
   TWILIO_ACCOUNT_SID=ACxxxx...
   TWILIO_AUTH_TOKEN=xxxx...
   TWILIO_PHONE_NUMBER=+1xxxx...
   ```

4. Local test-এ **ngrok** লাগবে:
   ```bash
   brew install ngrok
   ngrok http 4000
   ```
   `.env`-এ:
   ```env
   PUBLIC_API_URL=https://YOUR.ngrok-free.app
   ```

5. Restart:
   ```bash
   docker compose restart backend worker
   ```

বিস্তারিত: `docs/TWILIO-BANGLA.md`

---

## Double-click Files (Terminal typing লাগে না)

| File | কাজ |
|------|-----|
| `FIX.command` | Real Docker system start |
| `START-API.command` | Standalone demo API (Docker ছাড়া) |
| `TWILIO-SETUP.command` | Twilio guide + check |

---

## Call Flow (Real System)

```
Order আসে (API/Shopify/WooCommerce)
    ↓
PostgreSQL-এ save
    ↓
Redis queue → Worker
    ↓
Twilio → Customer phone (Bangla voice)
    ↓
Customer: 1=Confirm, 2=Cancel, 0=Agent
    ↓
Order status update + Merchant alert
```
