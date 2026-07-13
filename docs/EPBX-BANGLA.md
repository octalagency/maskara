# ePBX.bd Integration — Maskara

**খরচ:** ৳০.৩৫–০.৪৫/মিনিট (Twilio-র চেয়ে ~১৫ গুণ সস্তা)

---

## Maskara workspace (local dev)

আপনার account: **https://maskara.epbx.bd/login**

`.env` এ ইতিমধ্যে সেট করা আছে:

```env
VOICE_PROVIDER=epbx
EPBX_API_URL=https://maskara.epbx.bd/api/v1
EPBX_API_KEY=your_api_key_from_portal
PUBLIC_API_URL=http://localhost:4000
```

লোকাল apply:

```bash
bash scripts/configure-epbx-local.sh
# অথবা EPBX-LOCAL.command ডাবল-ক্লিক
```

Admin panel: **http://localhost:3002/admin/config** — webhook copy, test call, dashboard links

### ePBX dashboard-এ করুন

1. **Developer API** → `https://maskara.epbx.bd/portal/developer` — token verify
2. **Webhook URLs** paste করুন (Admin config page থেকে copy)
3. Local webhook-এর জন্য tunnel: `bash scripts/start-api-tunnel.sh` → tunnel URL কে Public API URL হিসেবে save করুন
4. **IVR Menus** (optional) → IVR ID admin config-এ দিন

---

1. https://epbx.bd/register → **7-day free trial**
2. Workplace/subdomain সেট করুন (min 4 chars, no space)
3. KYC verify করুন (NID + photo)
4. Wallet recharge: bKash/Nagad/Rocket

---

## Step 2: API Key নিন

1. Login: `https://YOUR-WORKSPACE.epbx.bd` (যেমন `https://maskara.epbx.bd`)
2. Sidebar menu (☰) → **Developer API**  
   অথবা সরাসরি: `https://YOUR-WORKSPACE.epbx.bd/portal/developer`
3. Application Name দিন → **Generate Token** → token copy করুন
4. Optional: Sidebar → **IVR Menus** → order verification IVR তৈরি করুন

Helpline: **01886944844** | WhatsApp: **+8801886944844**

---

## Step 3: `.env` configure করুন

```env
VOICE_PROVIDER=epbx
PUBLIC_API_URL=https://YOUR-DOMAIN.com
EPBX_API_URL=https://YOUR-WORKSPACE.epbx.bd/api/v1
EPBX_API_KEY=your_api_key_from_portal
EPBX_CUSTOMER_ID=
EPBX_IVR_ID=
```

Call endpoint: `POST /api/v1/calls/verify` (portal Developer API)। Wallet-এ balance থাকতে হবে (TTS + ৳০.৪৫/min)।

`PUBLIC_API_URL` — production domain বা ngrok URL (webhook-এর জন্য)

---

## Step 4: Webhook URLs (ePBX dashboard-এ দিন)

| Event | URL |
|-------|-----|
| DTMF / Order result | `https://YOUR-DOMAIN.com/voice/webhook/epbx/dtmf` |
| Call status | `https://YOUR-DOMAIN.com/voice/webhook/epbx/status` |
| General | `https://YOUR-DOMAIN.com/voice/webhook/epbx` |

---

## Step 5: Test

```bash
# Provider check
curl http://localhost:4000/voice/provider

# Submit test order (merchant API key লাগবে)
./scripts/test-api.sh
```

Customer phone-এ Bangla call আসবে:
- **1** = Order confirm
- **2** = Cancel  
- **0** = Agent

---

## Cost Example

| Calls/month | Avg 30s | Cost |
|-------------|---------|------|
| 1,000 | 500 min | **৳১৭৫–২২৫** |
| 5,000 | 2,500 min | **৳৮৭৫–১,১২৫** |

vs Twilio: ৳৩,০০০+ for 1,000 calls
