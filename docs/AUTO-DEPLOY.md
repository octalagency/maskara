# Auto deploy — GitHub push → VPS

`main` branch-এ push করলে GitHub Actions VPS-এ SSH করে deploy করবে।

## ১. GitHub Secrets সেট করুন

Repo: https://github.com/octalagency/maskara/settings/secrets/actions

**New repository secret** — ৩টা যোগ করুন:

| Name | Value |
|------|--------|
| `VPS_HOST` | `148.135.137.47` |
| `VPS_USER` | `root` |
| `VPS_SSH_PASSWORD` | আপনার VPS root password |

## ২. Workflow file push করুন

Token-এ **`workflow`** scope লাগবে।

নতুন token: https://github.com/settings/tokens/new  
Scopes: **repo** ✓ + **workflow** ✓

```bash
cd /Users/tudo/maskara
git add .github/workflows/deploy-vps.yml .gitignore
git commit -m "Add auto deploy workflow"
git push origin main
```

## ৩. কাজ করছে কিনা দেখুন

https://github.com/octalagency/maskara/actions

সবুজ ✓ হলে live: https://app.maskara.bd/admin

## ৪. পরের থেকে

```bash
git add -A && git commit -m "update" && git push
```

Push = auto deploy (২–৩০ মিনিট, build অনুযায়ী)।

## Manual deploy (Actions থেকে)

Actions → **Deploy to VPS** → **Run workflow**

## সমস্যা হলে

VPS-এ manually:
```bash
cd /opt/maskara && git pull && bash scripts/vps-redeploy.sh
```

Cloudflare SSL: **Full** (not Strict)
