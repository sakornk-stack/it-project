#!/usr/bin/env bash
# Proves a backup can actually be restored, without touching the real
# database: restores the dump into a throwaway postgres:16.15 container (the
# same version docker-compose.yml pins; no
# network, removed with its storage on exit) and prints table/row counts.
#
# Usage: ~/eduanalyze/deploy/restore-test.sh ~/eduanalyze/backups/<file>.dump
#        (no argument = newest dump in ~/eduanalyze/backups)
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/eduanalyze}"
# shellcheck disable=SC2012  # names come from backup-db.sh: plain [A-Za-z0-9._-]
dump="${1:-$(ls -1t "$APP_DIR"/backups/eduanalyze_*.dump 2>/dev/null | head -n 1 || true)}"
name="eduanalyze-restore-test"

if [ -z "$dump" ] || [ ! -r "$dump" ]; then
  echo "No readable dump given or found in $APP_DIR/backups" >&2
  exit 1
fi
if docker ps -a --format '{{.Names}}' | grep -qx "$name"; then
  echo "A container named $name already exists; stop it first: docker stop $name" >&2
  exit 1
fi

# --network none: nothing can reach it, so trust auth is safe and no
# password is needed. --rm also removes its anonymous data volume.
docker run --rm -d --name "$name" --network none --memory 384m \
  -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=restore_test postgres:16.15 > /dev/null
trap 'docker stop "$name" > /dev/null 2>&1 || true' EXIT

# TCP check: the image's init phase runs a socket-only server first.
for _ in $(seq 1 60); do
  if docker exec "$name" pg_isready -h 127.0.0.1 -U postgres -d restore_test > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker exec -i "$name" pg_restore -U postgres -d restore_test --no-owner --no-acl --exit-on-error < "$dump"

q() { docker exec "$name" psql -U postgres -d restore_test -tAc "$1"; }
echo "dump:              $dump"
echo "tables:            $(q "select count(*) from information_schema.tables where table_schema = 'public'")"
echo "migrations:        $(q 'select count(*) from _prisma_migrations')"
echo "users:             $(q 'select count(*) from users')"
echo "student_profiles:  $(q 'select count(*) from student_profiles')"
echo "restore test passed (the temporary container is removed on exit)"
