# maskara.bd DNS Records

**VPS IP:** `148.135.137.47`

Registrar panel-এ (BTCL / reseller) এই records add করুন:

| Host / Name | Type | Value | TTL |
|-------------|------|-------|-----|
| `@` | A | `148.135.137.47` | 300 |
| `www` | CNAME | `maskara.bd` | 300 |
| `app` | A | `148.135.137.47` | 300 |
| `api` | A | `148.135.137.47` | 300 |

## Result

| URL | Points to |
|-----|-----------|
| https://maskara.bd | → app (redirect) |
| https://www.maskara.bd | → app (redirect) |
| https://app.maskara.bd | Frontend |
| https://api.maskara.bd | API + webhooks |

## Verify (after DNS propagate)

```bash
dig +short maskara.bd
dig +short app.maskara.bd
dig +short api.maskara.bd
# সব 148.135.137.47 দেখাবে
```

## VPS deploy

```bash
ssh root@148.135.137.47
cd /opt/maskara   # or your deploy path
VPS_IP=148.135.137.47 bash scripts/setup-domain.sh
cp .env.production.example .env && nano .env
bash scripts/deploy-production.sh
sudo bash scripts/setup-ssl.sh maskara.bd www.maskara.bd app.maskara.bd api.maskara.bd
```
