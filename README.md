# Maskara - AI Order Verification Platform

A production-ready SaaS platform that automatically verifies eCommerce orders via AI-powered Bangla voice calls. Built for Bangladesh COD businesses, Shopify stores, WooCommerce shops, and custom online stores.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  eCommerce  │────▶│   NestJS API │────▶│   Twilio    │
│  Webhooks   │     │   + Bull MQ  │     │  Voice/SMS  │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────┴───────┐
                    │  PostgreSQL  │
                    │    Redis     │
                    └──────────────┘
                           │
                    ┌──────┴───────┐
                    │   Next.js    │
                    │  Dashboard   │
                    └──────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts |
| Backend | NestJS, Prisma ORM, Bull Queue |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7 |
| Voice | Twilio (TwiML + Polly TTS Bangla) |
| Storage | AWS S3 (call recordings) |
| Proxy | Nginx |
| Deploy | Docker Compose |

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- Twilio account (for production voice calls)

### 1. Clone and configure

```bash
cd maskara
cp .env.example .env
# Edit .env with your Twilio credentials and secrets
```

### 2. Start with Docker

```bash
docker compose up -d
```

Services:
- Frontend: http://localhost:3000
- API: http://localhost:4000
- API Docs: http://localhost:4000/docs
- PostgreSQL: localhost:5432
- Redis: localhost:6379

### 3. Run database migrations

```bash
cd backend
npm install
npx prisma migrate dev --name init
npx prisma db seed
```

### 4. Development mode

```bash
# Terminal 1 - Backend
cd backend && npm run start:dev

# Terminal 2 - Frontend
cd frontend && npm install && npm run dev
```

### Demo Accounts (after seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@maskara.bd | Admin@123 |
| Merchant | demo@store.com | Demo@123 |

## Core Workflow

1. Customer places order on connected store
2. Store sends webhook/API request to Maskara
3. System queues AI voice call via Bull/Redis
4. Twilio calls customer with Bangla greeting:
   > "আসসালামু আলাইকুম। আপনি [Store Name] থেকে একটি অর্ডার করেছেন। অর্ডারটি নিশ্চিত করতে ১ চাপুন। অর্ডার বাতিল করতে ২ চাপুন। একজন প্রতিনিধির সাথে কথা বলতে ০ চাপুন।"
5. Customer presses DTMF key (1/2/0)
6. Order status updated (VERIFIED/CANCELLED/ESCALATED)
7. Merchant receives SMS + in-app + webhook notification

## API Integration

### Create Order (Custom API)

```bash
curl -X POST http://localhost:4000/orders \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mk_your_api_key" \
  -d '{
    "orderNumber": "ORD-001",
    "customerName": "রহিম আহমেদ",
    "customerPhone": "01712345678",
    "totalAmount": 2500,
    "paymentMethod": "COD"
  }'
```

### Shopify Webhook
Configure in Shopify Admin → Settings → Notifications → Webhooks:
- Event: Order creation
- URL: `https://your-domain.com/webhooks/shopify`
- Header: `X-API-Key: mk_your_api_key`

### WooCommerce Webhook
WooCommerce → Settings → Advanced → Webhooks:
- Topic: Order created
- URL: `https://your-domain.com/webhooks/woocommerce`
- Header: `X-API-Key: mk_your_api_key`

## Project Structure

```
maskara/
├── backend/                 # NestJS API
│   ├── prisma/schema.prisma # Database schema
│   └── src/
│       ├── auth/            # JWT + API key auth
│       ├── orders/          # Order management
│       ├── calls/           # Call queue + retry
│       ├── voice/           # Twilio TwiML + DTMF
│       ├── webhooks/        # Shopify/WooCommerce/Custom
│       ├── notifications/   # SMS/WhatsApp/Webhook
│       ├── admin/           # Admin panel APIs
│       └── reports/         # Analytics
├── frontend/                # Next.js dashboard
│   └── src/app/
│       ├── page.tsx         # Landing page
│       ├── pricing/         # Pricing page
│       ├── login/ register/ # Auth pages
│       ├── dashboard/       # Merchant dashboard
│       ├── admin/           # Admin panel
│       └── docs/            # API documentation
├── docker/                  # Nginx config
├── docker-compose.yml       # Full stack deployment
└── IMPLEMENTATION_PLAN.md   # Step-by-step guide
```

## Database Schema

Key models: `User`, `Merchant`, `Order`, `Call`, `ApiKey`, `Integration`, `Notification`, `Subscription`, `UsageRecord`

See full schema: `backend/prisma/schema.prisma`

## Subscription Plans

| Plan | Price (BDT) | Calls/mo | SMS/mo |
|------|------------|----------|--------|
| Free | ৳0 (14 days) | 50 | 20 |
| Starter | ৳1,999 | 300 | 100 |
| Growth | ৳4,999 | 1,000 | 500 |
| Enterprise | Custom | Unlimited | Unlimited |

## Production Deployment

See `IMPLEMENTATION_PLAN.md` for detailed production setup including:
- AWS EC2/ECS deployment
- SSL with Let's Encrypt
- Twilio production configuration
- S3 recording storage
- Monitoring and scaling

## License

Proprietary - All rights reserved.
