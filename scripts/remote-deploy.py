#!/usr/bin/env python3
"""Deploy Maskara to VPS. Usage:
  bash scripts/deploy-vps.sh
  (password prompt — do not use YOUR_ROOT_PASSWORD placeholder)
"""
import getpass
import os
import sys
import time
import subprocess
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("Installing paramiko...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "paramiko", "-q"])
    import paramiko

HOST = os.environ.get("MASKARA_SSH_HOST", "148.135.137.47")
USER = os.environ.get("MASKARA_SSH_USER", "root")
LOCAL_ROOT = Path(os.environ.get("MASKARA_LOCAL_ROOT", Path(__file__).resolve().parent.parent))
REMOTE_ROOT = os.environ.get("MASKARA_REMOTE_ROOT", "/opt/maskara")
SECRETS_FILE = Path(os.environ.get("MASKARA_SECRETS_FILE", "/tmp/maskara_deploy_secrets.env"))

PLACEHOLDER_PASSWORDS = {
    "", "YOUR_ROOT_PASSWORD", "your-root-password", "YOUR_ROO", "password",
}


def get_password():
    pw = os.environ.get("MASKARA_SSH_PASSWORD", "").strip()
    if pw in PLACEHOLDER_PASSWORDS or pw.upper().startswith("YOUR_"):
        pw = ""
    if not pw:
        pw = getpass.getpass(f"SSH password for {USER}@{HOST}: ")
    if not pw or pw in PLACEHOLDER_PASSWORDS:
        print("Error: real VPS root password required (not YOUR_ROOT_PASSWORD placeholder)", file=sys.stderr)
        sys.exit(1)
    return pw


def connect_ssh(password):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {USER}@{HOST}...")
    try:
        client.connect(
            HOST,
            username=USER,
            password=password,
            timeout=90,
            banner_timeout=90,
            allow_agent=False,
            look_for_keys=False,
            auth_timeout=60,
        )
        return client
    except paramiko.AuthenticationException:
        print("\n✗ Authentication failed.", file=sys.stderr)
        print("  • Password সঠিক কিনা check করুন (single quotes ব্যবহার করুন)", file=sys.stderr)
        print("  • VPS panel থেকে root password reset করতে পারেন", file=sys.stderr)
        print("  • Test: ssh root@148.135.137.47", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ SSH failed: {e}", file=sys.stderr)
        sys.exit(1)


def ensure_secrets():
    if SECRETS_FILE.exists():
        return
    import secrets
    SECRETS_FILE.write_text(
        f"JWT_SECRET={secrets.token_hex(32)}\n"
        f"POSTGRES_PASSWORD={secrets.token_urlsafe(24)}\n"
        f"VOICE_WEBHOOK_SECRET={secrets.token_hex(32)}\n"
        f"WOOCOMMERCE_WEBHOOK_SECRET={secrets.token_hex(32)}\n"
    )
    SECRETS_FILE.chmod(0o600)
    print(f"Generated secrets: {SECRETS_FILE}")


def load_secrets():
    d = {}
    for line in SECRETS_FILE.read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            d[k.strip()] = v.strip()
    return d


def ssh_run(client, cmd, timeout=7200):
    print(f"\n>>> {cmd[:180]}{'...' if len(cmd) > 180 else ''}")
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    code = stdout.channel.recv_exit_status()
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    if out:
        print(out[-8000:] if len(out) > 8000 else out)
    if err:
        print(err[-4000:], file=sys.stderr)
    return code, out, err


def sftp_upload_tree(sftp, local: Path, remote: str, excludes: set):
    try:
        sftp.mkdir(remote)
    except OSError:
        pass
    for item in local.iterdir():
        if item.name in excludes:
            continue
        if item.name == "data" and local.name == "standalone-api":
            continue
        rpath = f"{remote}/{item.name}"
        if item.is_dir():
            sftp_upload_tree(sftp, item, rpath, excludes)
        else:
            sftp.put(str(item), rpath)


def main():
    password = get_password()
    ensure_secrets()
    secrets = load_secrets()
    client = connect_ssh(password)

    ssh_run(client, f"mkdir -p {REMOTE_ROOT}")
    code, _, _ = ssh_run(client, "command -v docker")
    if code != 0:
        print("Installing Docker...")
        ssh_run(client, "apt-get update -y && apt-get install -y ca-certificates curl gnupg openssl")
        ssh_run(client, "install -m 0755 -d /etc/apt/keyrings")
        ssh_run(client, "curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg")
        ssh_run(client, "chmod a+r /etc/apt/keyrings/docker.gpg")
        ssh_run(
            client,
            'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] '
            'https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" '
            "> /etc/apt/sources.list.d/docker.list",
        )
        ssh_run(client, "apt-get update -y && apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin")
        ssh_run(client, "systemctl enable --now docker")

    print("Uploading project via SFTP...")
    excludes = {"node_modules", ".git", ".next", "__pycache__", ".tools"}
    sftp = client.open_sftp()
    sftp_upload_tree(sftp, LOCAL_ROOT, REMOTE_ROOT, excludes)

    epbx_key = os.environ.get("EPBX_API_KEY", "znoOkJcxs6TdrKGreQ7Iobx5uTmvwMFwOHGcCQPR")
    admin_pass = os.environ.get("ADMIN_INITIAL_PASSWORD", "Admin@123")
    env_content = f"""NODE_ENV=production
RUN_SEED=false
SEED_DEMO=false
NEXT_PUBLIC_PRODUCTION=true
POSTGRES_USER=maskara
POSTGRES_PASSWORD={secrets['POSTGRES_PASSWORD']}
POSTGRES_DB=maskara
JWT_SECRET={secrets['JWT_SECRET']}
VOICE_WEBHOOK_SECRET={secrets['VOICE_WEBHOOK_SECRET']}
WOOCOMMERCE_WEBHOOK_SECRET={secrets['WOOCOMMERCE_WEBHOOK_SECRET']}
APP_URL=https://app.maskara.bd
API_URL=https://api.maskara.bd
PUBLIC_API_URL=https://api.maskara.bd
FRONTEND_URL=https://app.maskara.bd
DOCKER_USERNAME=octalagency
IMAGE_TAG=latest
VOICE_PROVIDER=epbx
EPBX_API_URL=https://maskara.epbx.bd/api/v1
EPBX_API_KEY={epbx_key}
EPBX_CUSTOMER_ID=
EPBX_IVR_ID=
IPPBX_API_URL=
IPPBX_API_KEY=
IPPBX_API_SECRET=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
SMTP_FROM=Maskara <noreply@maskara.bd>
"""
    with sftp.file(f"{REMOTE_ROOT}/.env", "w") as f:
        f.write(env_content)
    sftp.close()

    ssh_run(client, f"""
mkdir -p {REMOTE_ROOT}/docker/nginx/ssl
openssl req -x509 -nodes -days 825 -newkey rsa:2048 \\
  -keyout {REMOTE_ROOT}/docker/nginx/ssl/privkey.pem \\
  -out {REMOTE_ROOT}/docker/nginx/ssl/fullchain.pem \\
  -subj "/CN=maskara.bd"
""")

    print("Building images on VPS (15-25 min)...")
    ssh_run(
        client,
        f"cd {REMOTE_ROOT} && docker compose -f docker-compose.hostinger.yml build --no-cache backend frontend",
        timeout=7200,
    )

    ssh_run(client, "docker pull redis:7-alpine postgres:16-alpine nginx:alpine 2>/dev/null || true")

    code, _, _ = ssh_run(
        client,
        f"cd {REMOTE_ROOT} && docker compose -f docker-compose.hostinger.yml up -d --remove-orphans",
        timeout=1800,
    )
    if code != 0:
        print("\n✗ docker compose up failed", file=sys.stderr)
        ssh_run(client, f"cd {REMOTE_ROOT} && docker compose -f docker-compose.hostinger.yml logs --tail 50")
        client.close()
        sys.exit(1)

    print("Waiting for services...")
    healthy = False
    for _ in range(60):
        code, out, _ = ssh_run(
            client,
            "docker exec maskara-backend wget -qO- http://127.0.0.1:4000/health/live >/dev/null 2>&1",
        )
        if code == 0:
            healthy = True
            print("Backend healthy")
            break
        time.sleep(5)

    frontend_ok = False
    for _ in range(24):
        code, _, _ = ssh_run(
            client,
            "docker exec maskara-nginx wget -qO- http://frontend:3000/ >/dev/null 2>&1 || true",
        )
        if code == 0:
            frontend_ok = True
            print("Frontend reachable from nginx")
            break
        time.sleep(5)

    if not healthy:
        print("\n✗ DEPLOY FAILED — maskara-backend not healthy", file=sys.stderr)
        ssh_run(client, f"cd {REMOTE_ROOT} && docker compose -f docker-compose.hostinger.yml ps -a")
        ssh_run(client, "docker logs maskara-backend --tail 50 2>&1")
        client.close()
        sys.exit(1)

    if not frontend_ok:
        print("\n⚠ Frontend not reachable — checking logs", file=sys.stderr)
        ssh_run(client, "docker logs maskara-frontend --tail 40 2>&1")

    ssh_run(
        client,
        f"docker exec -e ADMIN_EMAIL=admin@maskara.bd "
        f"-e ADMIN_INITIAL_PASSWORD={admin_pass} maskara-backend node scripts/ensure-admin.js",
        timeout=120,
    )

    for url in ["https://api.maskara.bd/health/live", "https://app.maskara.bd"]:
        _, out, _ = ssh_run(client, f"curl -sk -o /dev/null -w '%{{http_code}}' {url}")
        print(f"Verify {url}: HTTP {out.strip()}")

    client.close()
    print("\n=== DEPLOY FINISHED ===")
    print("App:  https://app.maskara.bd")
    print("API:  https://api.maskara.bd/health")
    print("Admin: admin@maskara.bd /", admin_pass)
    print("Cloudflare SSL mode: Full (not strict)")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"FATAL: {e}", file=sys.stderr)
        sys.exit(1)
