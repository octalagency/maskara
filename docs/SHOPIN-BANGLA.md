# ShopIn ↔ Maskara Integration

ShopIn dashboard-এ Maskara AI Call Center UI আগে থেকেই আছে। Maskara সাইডে এই ফ্লো সাপোর্ট করে।

## Flow

```
ShopIn COD order
  → POST https://api.maskara.bd/webhooks/shopin  (X-API-Key)
  → Maskara AI Bangla call
  → POST https://api.shopin.bd/api/v1/webhooks/maskara/{shopId}
       body: { orderNumber, outcome: CONFIRMED|CANCELLED, ... }
  → ShopIn confirm + (optional) Pathao auto-deploy
```

### Physical call center (WordPress-এর মতো Manual Complete)

ShopIn-এ মানুষ কল করে Confirm করলে (Pending → Confirmed / Pickup Pending), ShopIn যেন **আবার** Maskara webhook পাঠায় `status` সহ। Maskara তখন:

- অর্ডার **Manual Complete / VERIFIED** করে
- AI কল বন্ধ করে (`nextCallAt` clear + queued jobs remove)
- ড্যাশবোর্ডে Manual Complete দেখায়

মানে WooCommerce-এ website `completed` sync-এর মতোই।

**ShopIn → Maskara status values that trigger Manual Complete (existing order):**  
`confirmed`, `confirm`, `completed`, `pickup_pending`, `ready_for_delivery`, `in_transit`, `processing`, `delivered`, …

On **new** order create, only clear confirm statuses (`confirmed` / `completed` / …) skip the AI call — COD `processing` still dials.

**Cancel:** `cancelled` / `rejected` → Maskara cancel + stop calls.

> ShopIn যদি status-change webhook না পাঠায়, Manual Complete হবে না — ShopIn Maskara settings-এ status sync চালু আছে কিনা চেক করুন।

## Hybrid: Maskara + Staff Call (ShopIn UI)

ShopIn অর্ডার রোতে দুই অপশন — **Maskara** ও **স্টাফ কল**। একই রুল Maskara সাইডে:

| ধাপ | কী হয় |
|-----|--------|
| 1 | অর্ডার → ~২০ সেকেন্ডে Maskara প্রথম কল |
| 2 | মিস → ~২ মিনিটে Maskara দ্বিতীয় কল |
| 3 | দুইবার মিস → ShopIn `staffCallEligible: true` (স্টাফ কল বাটন) |
| 4 | স্টাফ Confirm → Maskara **Manual Confirm (ShopIn)** + কল বন্ধ |
| 5 | স্টাফ না করলে → Maskara দিনে সর্বোচ্চ **১০** কল চালিয়ে যায় (মোট **২০**) |

## Staff → Maskara (PATCH status)

ShopIn Staff Confirm syncs via:

```http
PATCH https://api.maskara.bd/orders/{orderNumber}/status
X-API-Key: msk_…
Content-Type: application/json

{ "status": "VERIFIED", "source": "shopin_staff" }
```

- `{orderNumber}` = `ORD-…` or Maskara order id
- Also accepts `confirmed` / `cancelled` as status aliases
- Auth: **X-API-Key** (or `Authorization: Bearer msk_…`) — JWT not required
- Result: Maskara shows **Manual Confirm (ShopIn)** and stops AI calls

Cancel:

```json
{ "status": "CANCELLED", "source": "shopin_staff" }
```

## Maskara endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/integrations/shopin/ping` | API Key | ShopIn “API টেস্ট” |
| POST | `/integrations/shopin/connect` | API Key | Bind callback URL + secret |
| GET | `/integrations/shopin/status` | JWT | Dashboard status |
| DELETE | `/integrations/shopin/disconnect` | JWT | Disconnect |
| POST | `/webhooks/shopin` | API Key | Inbound orders from ShopIn |

## Connect body

```json
{
  "shopId": "cmq2aqs1v0002kv4jnd7appya",
  "shopName": "My Store",
  "webhookSecret": "same-as-shopin-settings",
  "callbackUrl": "https://api.shopin.bd/api/v1/webhooks/maskara/cmq2aqs1v0002kv4jnd7appya"
}
```

`callbackUrl` বাদ দিলে default: `SHOPIN_API_BASE` (default `https://api.shopin.bd`) + `/api/v1/webhooks/maskara/{shopId}`।

## Inbound order (minimum)

```json
{
  "shopId": "cmq2aqs1v0002kv4jnd7appya",
  "orderNumber": "ORD-MRWFM016",
  "customerName": "Customer",
  "customerPhone": "01770384390",
  "totalAmount": 640,
  "paymentMethod": "COD"
}
```

`orderNumber` অবশ্যই ShopIn-এর ORD-… হতে হবে (confirm webhook এ lookup হয়)।

## Callback (Maskara → ShopIn)

Same shape as Woo verification callback. ShopIn requires `orderNumber`. Outcomes:

- `CONFIRMED` / `VERIFIED` → ShopIn `action: confirmed` (+ Pathao if enabled)
- `CANCELLED` → `action: cancelled`
- other → `action: noted`

Headers: `X-Webhook-Secret`, optional `X-Maskara-Signature` (HMAC-SHA256 of body).

Storage note: ShopIn is stored as `IntegrationType.CUSTOM_API` with
`credentials.provider = "shopin"` and name `ShopIn …` (no DB enum migration required).
Orders use `source: CUSTOM_API` + `metadata.provider = "shopin"`.
