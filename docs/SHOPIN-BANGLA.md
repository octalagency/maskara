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
