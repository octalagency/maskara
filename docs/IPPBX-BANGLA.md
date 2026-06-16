# ippbx.com.bd Integration — Maskara

**খরচ:** ৳০.৪০/মিনিট (40 poisha)

**Provider:** NEO Technologies  
**Phone:** +880 9678 22 11 11 | +880 9617 39 88 88  
**Address:** Bashundhara R/A, Dhaka

---

## Step 1: Account খুলুন

1. https://ippbx.com.bd/contact — sales-এ যোগাযোগ করুন
2. Voice Broadcast / IVR package নিন
3. **API credentials** চান (Maskara integration-এর জন্য)

> ippbx-এ public developer portal নেই — API URL/key sales team দেবে।

---

## Step 2: `.env` configure করুন

Sales থেকে পাওয়া credentials দিন:

```env
VOICE_PROVIDER=ippbx
PUBLIC_API_URL=https://YOUR-DOMAIN.com
IPPBX_API_URL=https://api.ippbx.com.bd/v1/call
IPPBX_API_KEY=your_key_from_ippbx
IPPBX_API_SECRET=your_secret_if_any
```

---

## Step 3: Webhook URLs (ippbx-কে দিন)

| Event | URL |
|-------|-----|
| DTMF result | `https://YOUR-DOMAIN.com/voice/webhook/ippbx/dtmf` |
| Call status | `https://YOUR-DOMAIN.com/voice/webhook/ippbx/status` |
| General | `https://YOUR-DOMAIN.com/voice/webhook/ippbx` |

---

## Step 4: Test

```bash
curl http://localhost:4000/voice/provider
# Expected: {"provider":"ippbx","configured":true,"estimatedRateBdt":"0.35-0.45/min"}
```

---

## Features (ippbx)

- Voice call broadcast
- IVR (1/2/0 keypad)
- Pre-recorded Bangla audio
- 40 poisha/min local rate
- SMS from same IP number

---

## Maskara auto-select

`VOICE_PROVIDER=auto` থাকলে priority:
1. **ePBX** (if `EPBX_API_KEY` set)
2. **ippbx** (if `IPPBX_API_KEY` set)
3. **Twilio** (if Twilio credentials set)
4. **Simulate** (dev mode)
