#!/bin/sh
# Entrypoint for the backend and migrator images. Builds DATABASE_URL for the
# compose network from the POSTGRES_* values in the env file, so the password
# is stored once and the host-side DATABASE_URL in apps/backend/.env
# (localhost:5433, for native dev) is never used inside a container.
# Never prints a value. POSTGRES_PASSWORD must be URL-safe (deploy/make-env.sh
# generates hex).
set -eu

# A host that hands over a ready connection string (Render's fromDatabase)
# sets DATABASE_URL itself; everywhere else it is built from POSTGRES_*.
if [ -z "${DATABASE_URL:-}" ]; then
  : "${POSTGRES_USER:?POSTGRES_USER is not set}"
  : "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is not set}"
  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST:-postgres}:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-eduanalyze_ai}?schema=public"
fi

# Render's fromService gives a bare host name; the app needs full https URLs.
with_scheme() { case "$1" in http://*|https://*|'') printf '%s' "$1" ;; *) printf 'https://%s' "$1" ;; esac; }
if [ -n "${FRONTEND_URL:-}" ]; then export FRONTEND_URL="$(with_scheme "$FRONTEND_URL")"; fi
if [ -n "${CORS_ORIGIN:-}" ]; then export CORS_ORIGIN="$(with_scheme "$CORS_ORIGIN")"; fi

exec "$@"
