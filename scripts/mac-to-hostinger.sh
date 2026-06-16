#!/bin/bash
# Mac থেকে code upload + Hostinger deploy (১ কমান্ড)
set -euo pipefail
cd "$(dirname "$0")/.."

HOST="${MASKARA_SSH_HOST:-148.135.137.47}"
REMOTE="/opt/maskara"

echo "=== Upload + Deploy → $HOST ==="
[ -z "${MASKARA_SSH_PASSWORD:-}" ] && read -rs -p "VPS password: " MASKARA_SSH_PASSWORD && export MASKARA_SSH_PASSWORD && echo

PYTHON="${PYTHON:-python3}"
$PYTHON -c "import paramiko" 2>/dev/null || $PYTHON -m pip install paramiko -q

$PYTHON <<PY
import os, paramiko
from pathlib import Path

host, pw, remote = "$HOST", os.environ["MASKARA_SSH_PASSWORD"], "$REMOTE"
root = Path("$PWD")
excludes = {"node_modules", ".git", ".next", "__pycache__", ".tools"}

def upload(sftp, local, rem):
    try: sftp.mkdir(rem)
    except: pass
    for item in local.iterdir():
        if item.name in excludes: continue
        r = f"{rem}/{item.name}"
        if item.is_dir(): upload(sftp, item, r)
        else: sftp.put(str(item), r)

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(host, username="root", password=pw, timeout=60, allow_agent=False, look_for_keys=False)
sftp = c.open_sftp()
upload(sftp, root, remote)
sftp.close()

def run(cmd):
    print(">>>", cmd[:80])
    _, o, e = c.exec_command(cmd, timeout=7200)
    code = o.channel.recv_exit_status()
    out = o.read().decode()
    if out: print(out[-5000:])
    if code != 0: print("FAILED:", e.read().decode()[-1000:]); c.close(); exit(1)

run(f"chmod +x {remote}/scripts/hostinger-easy.sh && bash {remote}/scripts/hostinger-easy.sh")
c.close()
print("DONE")
PY

echo "Open: https://app.maskara.bd/admin"
