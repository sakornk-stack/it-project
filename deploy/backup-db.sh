#!/usr/bin/env bash
# Dumps the production database to ~/eduanalyze/backups/ as
# eduanalyze_<YYYYMMDD>_<HHMMSS>_<label>.dump (pg_dump custom format), checks
# the dump with pg_restore --list, and deletes dumps of this script older than
# KEEP_DAYS (default 14). Dumps never leave this machine: they hold user data.
#
# Usage: ~/eduanalyze/deploy/backup-db.sh [label]          (label: manual)
# Daily at 03:15 (root crontab, `crontab -e`):
#   15 3 * * * /root/eduanalyze/deploy/backup-db.sh daily >> /root/eduanalyze/backups/backup.log 2>&1
# Also run automatically before every deploy (deploy/remote-deploy.sh).
# Read-only against the database. Check a dump with deploy/restore-test.sh.
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/eduanalyze}"
KEEP_DAYS="${KEEP_DAYS:-14}"
label="${1:-manual}"
label="${label//[^A-Za-z0-9._-]/-}"

cd "$APP_DIR"
umask 077
dir="$APP_DIR/backups"
mkdir -p "$dir"
chmod 700 "$dir"

file="${dir}/eduanalyze_$(date +%Y%m%d_%H%M%S)_${label}.dump"
partial="${file}.partial"

if ! docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$partial"; then
  rm -f "$partial"
  echo "backup failed: is the postgres service running? (docker compose ps)" >&2
  exit 1
fi

tables="$(docker compose exec -T postgres pg_restore --list < "$partial" | grep -c 'TABLE DATA' || true)"
if [ "$tables" -lt 1 ]; then
  rm -f "$partial"
  echo "backup failed: the dump lists no tables" >&2
  exit 1
fi
mv "$partial" "$file"
echo "backup ok: $file ($(wc -c < "$file" | tr -d ' ') bytes, $tables tables)"

# Rotation: only this script's own files, only in this folder.
find "$dir" -maxdepth 1 -type f -name 'eduanalyze_*.dump' -mtime +"$KEEP_DAYS" -print -delete \
  | sed 's/^/removed old backup: /'
