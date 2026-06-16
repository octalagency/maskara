# WooCommerce Integration — Maskara

## Merchant Panel থেকে Connect

1. **API Key:** Dashboard → API Keys → `WooCommerce` নামে key তৈরি করুন
2. **Plugin Download:** Dashboard → Integrations → `maskara-woocommerce.zip`
3. **WordPress:** Plugins → Add New → Upload → Activate
4. **Settings:** WooCommerce → Maskara
   - Maskara API URL: `http://localhost:4000` (production: আপনার API domain)
   - API Key: Step 1-এর key
5. **Test Connection** → **Connect to Maskara**

COD order আসলে automatic Bangla voice verification call যাবে।

## API Endpoints (Plugin uses)

| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/integrations/woocommerce/ping` | X-API-Key |
| POST | `/integrations/woocommerce/connect` | X-API-Key |
| POST | `/webhooks/woocommerce` | X-API-Key |

## Plugin rebuild

```bash
./scripts/build-woo-plugin.sh
```
