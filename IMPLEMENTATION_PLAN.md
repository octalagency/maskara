# Maskara - Step-by-Step Implementation Plan

## Phase 1: Environment Setup (Day 1)

### 1.1 Local Development
- [x] Clone repository
- [ ] Install Node.js 20+, Docker, Docker Compose
- [ ] Copy `.env.example` to `.env`
- [ ] Start PostgreSQL and Redis: `docker compose up postgres redis -d`
- [ ] Install backend dependencies: `cd backend && npm install`
- [ ] Run Prisma migrations: `npx prisma migrate dev --name init`
- [ ] Seed database: `npx prisma db seed`
- [ ] Install frontend dependencies: `cd frontend && npm install`

### 1.2 Twilio Setup
1. Create account at https://www.twilio.com
2. Purchase a phone number with voice capability
3. For Bangladesh calls, enable international dialing
4. Set credentials in `.env`:
   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_PHONE_NUMBER=+1...
   ```
5. Configure Twilio webhook URLs (after deployment):
   - Voice URL: `https://your-domain.com/voice/twiml/{callId}`
   - Status Callback: `https://your-domain.com/voice/status/{callId}`

### 1.3 Verify Local Stack
```bash
# Start backend
cd backend && npm run start:dev

# Start frontend (new terminal)
cd frontend && npm run dev

# Test API health
curl http://localhost:4000/docs

# Test registration
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@store.com","password":"Test@1234","firstName":"Test","lastName":"User","storeName":"Test Store","phone":"01712345678"}'
```

---

## Phase 2: Core Features (Days 2-5)

### 2.1 Authentication & Multi-Tenancy
- [x] JWT authentication with refresh tokens
- [x] API key authentication for webhooks
- [x] Role-based access (SUPER_ADMIN, MERCHANT_OWNER)
- [x] Merchant registration with trial subscription
- [ ] Email verification (add SendGrid/Resend)
- [ ] Password reset flow

### 2.2 Order Processing Pipeline
- [x] Order creation via REST API
- [x] Shopify webhook handler
- [x] WooCommerce webhook handler
- [x] Custom webhook handler
- [x] Phone number normalization (Bangladesh format)
- [x] Bull queue for async call processing
- [ ] Rate limiting per merchant plan
- [ ] Duplicate order detection

### 2.3 Voice Call System
- [x] Twilio call initiation
- [x] TwiML generation with Bangla TTS (Polly.Aditi)
- [x] DTMF key detection (1=Confirm, 2=Cancel, 0=Agent)
- [x] Call status webhooks
- [x] Call recording storage
- [x] Failed call retry scheduler (every 5 min)
- [ ] Google Cloud TTS for better Bangla quality
- [ ] Custom greeting per merchant
- [ ] Business hours check (don't call at night)

### 2.4 Notifications
- [x] In-app notifications
- [x] SMS via Twilio
- [x] WhatsApp via Twilio (optional)
- [x] Merchant webhook callback
- [ ] Email notifications (SendGrid)
- [ ] Push notifications

---

## Phase 3: Dashboard & UI (Days 6-8)

### 3.1 Public Pages
- [x] Landing page with hero, features, workflow
- [x] Pricing page with 4 tiers
- [x] Login / Register pages
- [x] API documentation page

### 3.2 Merchant Dashboard
- [x] Overview with stat cards and charts
- [x] Order management with search/filter
- [x] Call history with recordings
- [x] Reports with daily analytics
- [x] API key management
- [x] Integration setup guides
- [x] Settings (store name, webhook config)
- [ ] Real-time order updates (WebSocket)
- [ ] Export reports to CSV

### 3.3 Admin Panel
- [x] Platform dashboard (merchants, revenue, calls)
- [x] Merchant list with status management
- [ ] Subscription management UI
- [ ] System settings editor
- [ ] Revenue charts

---

## Phase 4: Integrations (Days 9-11)

### 4.1 Shopify App
1. Create Shopify Partner account
2. Create custom app with `read_orders` scope
3. Register webhook for `orders/create`
4. Point webhook to `POST /webhooks/shopify`
5. Test with Shopify development store

### 4.2 WooCommerce Plugin
Create a simple WordPress plugin:

```php
// maskara-woocommerce/maskara.php
add_action('woocommerce_new_order', function($order_id) {
    $order = wc_get_order($order_id);
    wp_remote_post('https://api.maskara.bd/webhooks/woocommerce', [
        'headers' => ['X-API-Key' => get_option('maskara_api_key')],
        'body' => json_encode($order->get_data()),
    ]);
});
```

### 4.3 Facebook/Custom Integration
- Use Custom API endpoint for Facebook sellers
- Provide Zapier/Make.com integration template
- WordPress shortcode for simple order forms

---

## Phase 5: Production Deployment (Days 12-14)

### 5.1 AWS Infrastructure

```
┌─────────────────────────────────────────┐
│              Route 53 DNS               │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│         Application Load Balancer       │
│              (HTTPS/SSL)                │
└───────┬─────────────────┬───────────────┘
        │                 │
┌───────▼──────┐  ┌───────▼──────┐
│  ECS/EC2     │  │  ECS/EC2     │
│  Frontend    │  │  Backend     │
│  (Next.js)   │  │  (NestJS)    │
└──────────────┘  └──────┬───────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
        ┌─────▼───┐ ┌───▼───┐ ┌───▼───┐
        │ RDS     │ │Redis  │ │  S3   │
        │ Postgres│ │Cache  │ │Record │
        └─────────┘ └───────┘ └───────┘
```

### 5.2 Deployment Steps

```bash
# 1. Build and push Docker images
docker compose build
docker tag maskara-backend your-ecr/backend:latest
docker push your-ecr/backend:latest

# 2. Set up RDS PostgreSQL
# 3. Set up ElastiCache Redis
# 4. Create S3 bucket for recordings
# 5. Configure environment variables on ECS/EC2
# 6. Run migrations: npx prisma migrate deploy
# 7. Seed admin user: npx prisma db seed
# 8. Configure Nginx with SSL (Let's Encrypt)
# 9. Point Twilio webhooks to production domain
```

### 5.3 SSL Configuration

```bash
# Using Certbot with Nginx
certbot --nginx -d api.maskara.bd -d app.maskara.bd
```

### 5.4 Environment Variables (Production)

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@rds-endpoint:5432/maskara
REDIS_URL=redis://elasticache-endpoint:6379
JWT_SECRET=<strong-random-secret>
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
AWS_S3_BUCKET=maskara-recordings-prod
APP_URL=https://app.maskara.bd
API_URL=https://api.maskara.bd
FRONTEND_URL=https://app.maskara.bd
```

---

## Phase 6: Testing & QA (Days 15-16)

### 6.1 API Testing
```bash
# Create API key from dashboard
# Test order creation
curl -X POST https://api.maskara.bd/orders \
  -H "X-API-Key: mk_..." \
  -H "Content-Type: application/json" \
  -d '{"orderNumber":"TEST-001","customerName":"Test","customerPhone":"01712345678","totalAmount":100}'

# Verify call initiated (check dashboard)
# Test DTMF by answering call and pressing 1
```

### 6.2 Test Checklist
- [ ] User registration and login
- [ ] API key creation and revocation
- [ ] Order creation triggers call
- [ ] DTMF 1 confirms order
- [ ] DTMF 2 cancels order
- [ ] DTMF 0 escalates order
- [ ] Failed call retry works
- [ ] SMS notification sent to merchant
- [ ] Webhook callback delivered
- [ ] Shopify integration end-to-end
- [ ] WooCommerce integration end-to-end
- [ ] Dashboard stats update correctly
- [ ] Admin panel shows all merchants
- [ ] Call recording accessible
- [ ] Mobile responsive UI

---

## Phase 7: Launch & Growth (Day 17+)

### 7.1 Pre-Launch
- [ ] Set up monitoring (Datadog/New Relic)
- [ ] Configure error tracking (Sentry)
- [ ] Set up uptime monitoring
- [ ] Create backup strategy for PostgreSQL
- [ ] Load test with 100 concurrent calls
- [ ] Legal: Terms of Service, Privacy Policy
- [ ] Payment integration (bKash/Nagad/Stripe)

### 7.2 Marketing
- Target: Bangladesh COD eCommerce merchants
- Channels: Facebook groups, eCommerce communities
- Demo: Free 14-day trial with 50 calls
- Content: Bangla tutorials on YouTube

### 7.3 Scaling Considerations
- Horizontal scaling: Multiple backend workers
- Redis cluster for high-throughput queue
- Read replicas for PostgreSQL analytics
- CDN for frontend static assets
- Twilio rate limits: Request increase for high volume
- Consider Asterisk/FreeSWITCH for cost optimization at scale

---

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Voice Provider | Twilio | Fastest to market, reliable DTMF, Bangla TTS |
| Queue | Bull + Redis | Battle-tested, retry support, job scheduling |
| ORM | Prisma | Type-safe, great migrations, PostgreSQL support |
| Auth | JWT + API Keys | Dashboard uses JWT, integrations use API keys |
| Multi-tenancy | Shared DB | merchantId on all tables, simpler for MVP |
| TTS | Twilio Polly | Built-in Bangla support, no extra service |
| Frontend | Next.js App Router | SSR landing, CSR dashboard, great DX |

## Cost Estimation (Monthly)

| Service | Estimated Cost |
|---------|---------------|
| AWS EC2 (t3.medium x2) | $60 |
| RDS PostgreSQL (db.t3.micro) | $15 |
| ElastiCache Redis | $15 |
| S3 Storage | $5 |
| Twilio (1000 calls) | $30-50 |
| Domain + SSL | $2 |
| **Total** | **~$130/month** |

Revenue at 50 Growth plan merchants: 50 × ৳4,999 = ৳249,950/month
