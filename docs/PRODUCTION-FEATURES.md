# Maskara Production Features

## 1. Automated Tests

```bash
cd backend && npm ci && npm test
```

CI runs tests on every push to `main` (`.github/workflows/docker-publish.yml`).

Test files:
- `src/common/utils/webhook-signature.util.spec.ts`
- `src/subscriptions/subscriptions.service.spec.ts`
- `src/config/validate-env.spec.ts`
- `src/payments/payments.service.spec.ts`

---

## 2. bKash / Nagad Payment

**API:** `POST /payments/initiate` (JWT)
```json
{ "planCode": "GROWTH", "provider": "bkash" }
```

**Callbacks:**
- `GET /payments/bkash/callback`
- `POST /payments/nagad/callback`

**Env (.env):**
```env
BKASH_APP_KEY=
BKASH_APP_SECRET=
BKASH_USERNAME=
BKASH_PASSWORD=
BKASH_BASE_URL=https://tokenized.sandbox.bka.sh/v1.2.0-beta

NAGAD_MERCHANT_ID=
NAGAD_MERCHANT_NUMBER=
NAGAD_PUBLIC_KEY=
NAGAD_PRIVATE_KEY=
NAGAD_BASE_URL=http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0
```

Without credentials → sandbox mock mode (dev).

**Merchant UI:** Dashboard → Subscription → bKash / Nagad buttons

---

## 3. DB Backup + Sentry

**Daily backup:**
```bash
chmod +x scripts/backup-database.sh
./scripts/backup-database.sh

# Cron (VPS):
0 2 * * * /opt/maskara/scripts/backup-database.sh >> /var/log/maskara-backup.log 2>&1
```

**Sentry:**
```env
SENTRY_DSN=https://xxx@o123.ingest.sentry.io/456
```

Auto-initialized in `backend/src/main.ts` when DSN is set.

---

## 4. S3 Call Recordings

When Twilio/ePBX sends a recording URL, Maskara uploads to S3:

```env
AWS_S3_BUCKET=maskara-recordings
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-southeast-1
```

Stored in `Call.recordingS3Key` + `recordingUrl`.

---

## 5. Email Verification + Password Reset

**SMTP:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Maskara <noreply@maskara.bd>
```

**Endpoints:**
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/verify-email` | Verify with token |
| POST | `/auth/resend-verification` | Resend email |
| POST | `/auth/forgot-password` | Send reset link |
| POST | `/auth/reset-password` | Set new password |

**Frontend pages:**
- `/verify-email?token=...`
- `/reset-password?token=...`
- `/forgot-password`

Production login blocks unverified emails.
