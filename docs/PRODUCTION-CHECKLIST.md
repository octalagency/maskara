# Maskara Production Checklist

Production-এ যাওয়ার আগে এই কাজগুলো complete করতে হবে।

## Phase 1 — Security & Infrastructure (P0)

| # | কাজ | স্ট্যাটাস |
|---|-----|--------|
| 1 | Production env validation | ✅ Started |
| 2 | Auto-seed বন্ধ production-এ | ✅ Done |
| 3 | Rate limiting (ThrottlerGuard) | ✅ Done |
| 4 | Deep health check (DB + Redis) | ✅ Done |
| 5 | Webhook signature verification | ✅ Done |
| 6 | Voice webhook auth | ✅ Done |
| 7 | HTTPS/SSL Nginx | ✅ Template ready |
| 8 | Strong secrets on server | ✅ Env validation |
| 9 | Postgres/Redis ports internal only | ✅ prod compose |
| 10 | standalone-api deploy নিষিদ্ধ | ⬜ Ops |
| 22 | Offline/demo mode বন্ধ production-এ | ✅ Done |
| 23 | Demo credentials remove from seed | ✅ Done |
| 24 | Admin offline login remove | ✅ Done |
| 19 | PUBLIC_API_URL for voice | ✅ Done + HTTPS enforced |

## Phase 2 — Business Logic (P0)

| # | কাজ | স্ট্যাটাস |
|---|-----|--------|
| 11 | Subscription call limit enforce | ✅ Started |
| 12 | callsUsed increment on call | ✅ Started |
| 13 | Duplicate order detection | ⬜ TODO |
| 14 | Real payment gateway (bKash/Nagad) | ✅ Done |
| 26 | Unit tests + CI gate | ✅ Done |
| 29 | DB backup automation | ✅ Done |
| 25 | Error monitoring (Sentry) | ✅ Done |
| 31 | S3 call recording upload | ✅ Done |
| 32 | Email verification | ✅ Done |
| 33 | Password reset | ✅ Done |
| 15 | Suspended merchant block | ⬜ TODO |

## Phase 3 — Deploy & Domain (P0)

| # | কাজ | স্ট্যাটাস |
|---|-----|--------|
| 16 | VPS provision | ⬜ |
| 17 | Domain setup | ⬜ |
| 18 | docker-compose.prod.yml deploy | ⬜ |
| 19 | PUBLIC_API_URL for voice | ⬜ |
| 20 | ePBX production credentials | ⬜ |
| 21 | WooCommerce → public API | ⬜ |

## Phase 4–6 — Polish & Features

- Offline/demo mode off in production ✅ Started
- Automated tests ⬜
- S3 recordings ⬜
- Email verification ⬜

## Production .env (required)

```env
NODE_ENV=production
RUN_SEED=false
JWT_SECRET=<64-char-random>
POSTGRES_PASSWORD=<strong>
API_URL=https://api.maskara.bd
PUBLIC_API_URL=https://api.maskara.bd
FRONTEND_URL=https://app.maskara.bd
NEXT_PUBLIC_PRODUCTION=true
```

**Estimated MVP live: 2–3 weeks**
