# Twilio Setup — Real Bangla Voice Call

Maskara customer-কে phone-এ call করে order confirm করায়। Twilio ছাড়া call **simulate** হয় (auto-verify)।

---

## Step 1: Twilio Account

1. যান: https://www.twilio.com/try-twilio
2. Sign up করুন (free trial $15 credit)
3. Phone verify করুন

---

## Step 2: Phone Number কিনুন

1. Twilio Console → **Phone Numbers** → **Buy a number**
2. **Voice** capability সহ number নিন
3. Country: USA number সহজ (Bangladesh call করতে **Geo Permissions** enable করতে হবে)

### Bangladesh-এ call করতে

1. Console → **Voice** → **Settings** → **Geo Permissions**
2. **Bangladesh** enable করুন
3. Trial account-এ verified number-এই call যায় — আপনার নিজের phone verify করুন

---

## Step 3: Credentials `.env`-এ দিন

`/Users/tudo/maskara/.env` file edit করুন:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_SMS_ENABLED=true
```

Console → **Account** → **API keys & tokens** থেকে SID ও Token নিন।

---

## Step 4: Public URL (Local test)

Twilio আপনার Mac-এর `localhost` দেখতে পারে না। Local test-এ **ngrok** লাগবে:

```bash
# ngrok install (one time)
brew install ngrok

# tunnel start
ngrok http 4000
```

ngrok দেবে: `https://abc123.ngrok-free.app`

`.env`-এ যোগ করুন:

```env
PUBLIC_API_URL=https://abc123.ngrok-free.app
API_URL=http://localhost:4000
```

তারপর backend restart:

```bash
docker compose restart backend worker
```

---

## Step 5: Test Call

1. Merchant login: `demo@store.com` / `Demo@123`
2. API Key তৈরি করুন (Dashboard → API Keys)
3. Test order পাঠান:

```bash
curl -X POST http://localhost:4000/orders \
  -H "X-API-Key: mk_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "orderNumber": "ORD-1001",
    "customerName": "রহিম",
    "customerPhone": "+88017XXXXXXXX",
    "totalAmount": 1500,
    "paymentMethod": "COD"
  }'
```

4. Customer phone-এ Bangla call আসবে:
   - **1** = Order confirm
   - **2** = Cancel
   - **0** = Agent

---

## Production (VPS)

VPS deploy-এ `PUBLIC_API_URL` আপনার domain:

```env
PUBLIC_API_URL=https://api.maskara.bd
API_URL=https://api.maskara.bd
APP_URL=https://maskara.bd
```

Twilio webhook URLs auto-set হয়:
- `https://api.maskara.bd/voice/twiml/{callId}`
- `https://api.maskara.bd/voice/gather/{callId}`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Call simulate হয়, real call না | `.env`-এ Twilio credentials check |
| Call fail | Geo Permissions → Bangladesh on |
| Trial-এ call যায় না | Customer number Twilio-তে verified করুন |
| Webhook error | `PUBLIC_API_URL` ngrok/domain set করুন |
| No Bangla voice | Polly.Aditi ব্যবহার হয় — Twilio default |

---

## Cost Estimate (Bangladesh)

| Item | Approx cost |
|------|-------------|
| Twilio number | ~$1/month |
| Outbound call BD | ~$0.05-0.10/min |
| 1000 calls/month | ~$50-100 |
