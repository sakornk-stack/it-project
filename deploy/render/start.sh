#!/bin/sh
# Start-up for deploy/render/Dockerfile: apply pending migrations, start the
# API on 127.0.0.1:3001, then the web on $PORT. If either process exits, stop
# the other and exit, so Render restarts the whole container.
set -eu

: "${DATABASE_URL:?DATABASE_URL is not set}"

# Render passes bare hosts; the API needs full https URLs.
with_scheme() { case "$1" in http://*|https://*|'') printf '%s' "$1" ;; *) printf 'https://%s' "$1" ;; esac; }
if [ -n "${FRONTEND_URL:-}" ]; then export FRONTEND_URL="$(with_scheme "$FRONTEND_URL")"; fi
if [ -n "${CORS_ORIGIN:-}" ]; then export CORS_ORIGIN="$(with_scheme "$CORS_ORIGIN")"; fi

WEB_PORT="${PORT:-3000}"

cd /app/api/apps/backend
node /app/api/node_modules/prisma/build/index.js migrate deploy --schema=prisma/schema.prisma

PORT=3001 node /app/api/apps/backend/dist/main.js &
api_pid=$!

# Wait for the API before the web takes traffic (up to 60 s).
i=0
until node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; do
  i=$((i + 1))
  if [ "$i" -ge 60 ] || ! kill -0 "$api_pid" 2>/dev/null; then echo "API did not start" >&2; exit 1; fi
  sleep 1
done

cd /app/web
PORT="$WEB_PORT" node apps/frontend/server.js &
web_pid=$!

trap 'kill "$api_pid" "$web_pid" 2>/dev/null' INT TERM
# Exit as soon as either one stops.
while kill -0 "$api_pid" 2>/dev/null && kill -0 "$web_pid" 2>/dev/null; do sleep 5; done
kill "$api_pid" "$web_pid" 2>/dev/null || true
exit 1
