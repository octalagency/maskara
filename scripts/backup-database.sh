#!/bin/bash
# PostgreSQL backup — run daily via cron on VPS
# cron: 0 2 * * * /opt/maskara/scripts/backup-database.sh

set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="maskara_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

POSTGRES_USER="${POSTGRES_USER:-maskara}"
POSTGRES_DB="${POSTGRES_DB:-maskara}"

echo "Backing up ${POSTGRES_DB}..."

if docker ps --format '{{.Names}}' | grep -q maskara-postgres; then
  docker exec maskara-postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "${BACKUP_DIR}/${FILENAME}"
else
  pg_dump "$DATABASE_URL" | gzip > "${BACKUP_DIR}/${FILENAME}"
fi

echo "✓ Saved: ${BACKUP_DIR}/${FILENAME} ($(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1))"

# Optional S3 upload
if [ -n "${BACKUP_S3_BUCKET:-}" ] && command -v aws &>/dev/null; then
  aws s3 cp "${BACKUP_DIR}/${FILENAME}" "s3://${BACKUP_S3_BUCKET}/db-backups/${FILENAME}"
  echo "✓ Uploaded to s3://${BACKUP_S3_BUCKET}/db-backups/${FILENAME}"
fi

find "$BACKUP_DIR" -name 'maskara_*.sql.gz' -mtime +"$RETAIN_DAYS" -delete
echo "✓ Cleaned backups older than ${RETAIN_DAYS} days"
