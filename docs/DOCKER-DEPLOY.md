# Docker দিয়ে Deploy — maskara.bd

হ্যাঁ, **পুরো project Docker দিয়ে deploy** হয়।

## Stack (docker-compose.prod.yml)

| Container | কাজ |
|-----------|-----|
| postgres | Database |
| redis | Queue/cache |
| backend | API (NestJS) |
| frontend | App (Next.js) |
| worker | Background jobs |
| nginx | SSL + routing |

---

## Method 1: Mac → Docker Hub → VPS (সবচেয়ে সহজ)

### Mac-এ (Docker Desktop চালু):

```bash
cd /Users/tudo/maskara

# Image build + Docker Hub push
DOCKER_USERNAME=octalagency bash scripts/docker-push.sh
```

### VPS-এ (SSH login করার পর):

```bash
apt install -y docker.io docker-compose-plugin
mkdir -p /opt/maskara && cd /opt/maskara

# শুধু এই files লাগবে (scp/git):
# - docker-compose.prod.yml
# - docker/nginx/nginx.prod.conf
# - .env (production)

cp .env.production.example .env
nano .env   # secrets + DOCKER_USERNAME=octalagency

# SSL (Cloudflare Full mode)
mkdir -p docker/nginx/ssl
openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/privkey.pem \
  -out docker/nginx/ssl/fullchain.pem \
  -subj "/CN=maskara.bd"

# Pull + start
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Admin user
docker exec -e RUN_SEED=true \
  -e ADMIN_EMAIL=admin@maskara.bd \
  -e ADMIN_INITIAL_PASSWORD=Admin@123 \
  maskara-backend npx prisma db seed
```

---

## Method 2: VPS-এ direct build (Docker Hub ছাড়া)

পুরো project VPS-এ copy করে সেখানে build:

```bash
cd /opt/maskara

docker build -t octalagency/maskara-backend:latest ./backend

docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.maskara.bd \
  --build-arg NEXT_PUBLIC_APP_URL=https://app.maskara.bd \
  --build-arg NEXT_PUBLIC_PRODUCTION=true \
  -t octalagency/maskara-frontend:latest ./frontend

docker compose -f docker-compose.prod.yml up -d
```

অথবা Mac থেকে এক কমান্ডে: `bash scripts/deploy-vps.sh` (SSH password দিয়ে)

---

## Method 3: Local test (Docker Desktop)

```bash
cd /Users/tudo/maskara
cp .env.example .env
bash scripts/start-docker.sh
# http://localhost:3000
```

---

## .env (production — অবশ্যই)

```env
DOCKER_USERNAME=octalagency
APP_URL=https://app.maskara.bd
API_URL=https://api.maskara.bd
PUBLIC_API_URL=https://api.maskara.bd
FRONTEND_URL=https://app.maskara.bd
```

---

## Verify

```bash
curl https://api.maskara.bd/health
open https://app.maskara.bd
```

## Cloudflare

- SSL mode: **Full** (origin self-signed OK)
- Ports VPS-এ open: **80, 443**
