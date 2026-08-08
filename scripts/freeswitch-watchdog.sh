#!/usr/bin/env bash
# Restart Maskara FreeSWITCH when Docker marks it unhealthy / exec is dead.
# Install on VPS: bash scripts/freeswitch-watchdog.sh --install-cron
set -euo pipefail

ROOT="${MASKARA_ROOT:-/opt/maskara}"
COMPOSE="${MASKARA_COMPOSE:-docker-compose.hostinger.yml}"
LOG="${MASKARA_WATCHDOG_LOG:-/var/log/maskara-freeswitch-watchdog.log}"
NAME="${MASKARA_FREESWITCH_CONTAINER:-maskara-freeswitch}"

log() {
  echo "$(date -Is) $*" | tee -a "$LOG" >/dev/null
}

install_cron() {
  local dest=/usr/local/bin/maskara-freeswitch-watchdog.sh
  cp -f "$ROOT/scripts/freeswitch-watchdog.sh" "$dest"
  chmod +x "$dest"
  # every 2 minutes
  local line="*/2 * * * * root $dest >>$LOG 2>&1"
  echo "$line" >/etc/cron.d/maskara-freeswitch-watchdog
  chmod 644 /etc/cron.d/maskara-freeswitch-watchdog
  log "Installed cron: $line"
  exit 0
}

if [[ "${1:-}" == "--install-cron" ]]; then
  install_cron
fi

cd "$ROOT"

if ! docker inspect "$NAME" >/dev/null 2>&1; then
  log "container missing — compose up freeswitch"
  docker compose -f "$COMPOSE" up -d freeswitch
  exit 0
fi

health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$NAME" 2>/dev/null || echo missing)"
running="$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null || echo false)"

# Can we exec fs_cli? (PID exhaustion shows as exec failure while "running")
exec_ok=0
if [[ "$running" == "true" ]]; then
  if docker exec "$NAME" fs_cli -x status >/dev/null 2>&1; then
    exec_ok=1
  fi
fi

if [[ "$running" == "true" && "$health" == "healthy" && "$exec_ok" -eq 1 ]]; then
  exit 0
fi

log "unhealthy freeswitch running=$running health=$health exec_ok=$exec_ok — recreating"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker compose -f "$COMPOSE" up -d freeswitch
sleep 15
if docker exec "$NAME" fs_cli -x "sofia status gateway maskara_trunk" 2>/dev/null | grep -q REGED; then
  log "freeswitch recovered (REGED)"
else
  log "freeswitch up but gateway not REGED yet"
fi
