# Quick Start — Run Maskara Locally

## Option A: One-Command Docker Setup (Recommended)

```bash
cd /Users/tudo/maskara
chmod +x scripts/setup.sh
./scripts/setup.sh
```

This starts PostgreSQL, Redis, Backend, Worker, and Frontend.

**URLs:**
- App: http://localhost:3000
- API: http://localhost:4000
- API Docs: http://localhost:4000/docs

**Demo logins:**
| Role | Email | Password |
|------|-------|----------|
| Merchant | demo@store.com | Demo@123 |
| Admin | admin@maskara.bd | Admin@123 |

---

## Option B: Manual Docker Steps

```bash
cd /Users/tudo/maskara

# 1. Start database & cache
docker compose up postgres redis -d

# 2. Build and start app (first build takes ~3-5 min)
docker compose up --build -d backend worker frontend

# 3. Check logs
docker compose logs -f backend
```

---

## Option C: Local Node.js (if you have Node 20+)

```bash
cd /Users/tudo/maskara

# Start infra only
docker compose up postgres redis -d

# Backend
cd backend
npm install
npx prisma migrate deploy
npx prisma db seed
npm run start:dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

---

## Verify It Works

```bash
chmod +x scripts/test-api.sh
./scripts/test-api.sh
```

Or manually:
1. Open http://localhost:3000
2. Login with `demo@store.com` / `Demo@123`
3. Go to **API Keys** → Create a key
4. Go to **Orders** — submit a test order via API (see `scripts/test-api.sh`)

Without Twilio configured, orders auto-verify in **simulated call mode**.

---

## Next: Enable Real Voice Calls (Twilio)

1. Sign up at https://www.twilio.com
2. Buy a voice-enabled phone number
3. Edit `.env`:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
API_URL=https://your-public-url.com   # Twilio must reach this
```

4. For local dev, use **ngrok** to expose the API:

```bash
ngrok http 4000
# Set API_URL to the ngrok HTTPS URL in .env
docker compose restart backend worker
```

5. Twilio will call the customer's phone with the Bangla greeting.

---

## Push to Docker Hub

```bash
# 1. Login to Docker Hub (one time)
docker login

# 2. Build and push both images
DOCKER_USERNAME=yourhubuser ./scripts/docker-push.sh

# With version tag
DOCKER_USERNAME=yourhubuser IMAGE_TAG=v1.0.0 ./scripts/docker-push.sh
```

Images pushed:
- `yourhubuser/maskara-backend:latest`
- `yourhubuser/maskara-frontend:latest`

**Deploy on server using pushed images:**

```bash
# On your VPS/cloud server
export DOCKER_USERNAME=yourhubuser
cp .env.example .env   # fill in production values
docker compose -f docker-compose.prod.yml up -d
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `permission denied` on Docker | Open Docker Desktop, ensure it's running |
| Port 5432 in use | Stop local Postgres or change port in docker-compose.yml |
| Backend won't start | `docker compose logs backend` — check migration errors |
| Frontend shows demo data | Backend not reachable — check `NEXT_PUBLIC_API_URL` |
| Calls not initiating | Ensure `worker` container is running: `docker compose ps` |
