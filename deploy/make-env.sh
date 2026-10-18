#!/usr/bin/env bash
# Creates ~/eduanalyze/.env and ~/eduanalyze/db.env on the VPS, once.
# db.env holds only POSTGRES_USER/POSTGRES_PASSWORD (read by postgres, migrate
# and backend); keeping it separate means a deploy, which rewrites IMAGE_TAG in
# .env, never restarts the database. Generates every internal secret
# (database password, JWT secrets, 2FA encryption key) with openssl, so you
# never type or see them, and writes the fixed production settings for
# https://eduanalyze.itkukps.tech. It asks only for what has to come from you:
#
#   SMTP_USER / SMTP_FROM  Gmail address that sends reset/invite/sign-up mail.
#   SMTP_PASS              A Gmail *App Password* for that account (Google
#                          Account > Security > 2-Step Verification > App
#                          passwords), not the normal Gmail password. Typing is
#                          hidden; spaces are removed.
#   GOOGLE_CLIENT_ID /     From Google Cloud Console > APIs & Services >
#   GOOGLE_CLIENT_SECRET   Credentials > OAuth client (Web application), with
#                          Authorized redirect URI
#                          https://eduanalyze.itkukps.tech/api/auth/google/callback
#                          Press Enter to skip: placeholders are written, and
#                          Google sign-in stays hidden as long as the GitHub
#                          variable NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN is not true.
#
# Edit later with `nano ~/eduanalyze/.env`, then `docker compose up -d` in
# ~/eduanalyze. Never paste this file anywhere. Keep a copy somewhere safe
# off the VPS: losing TOTP_ENCRYPTION_KEY makes every user's 2FA unreadable.
#
# Usage: bash ~/eduanalyze/deploy/make-env.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/eduanalyze}"
DOMAIN="eduanalyze.itkukps.tech"
IMAGE_PREFIX="ghcr.io/patcharadnaimingchua/eduanalyze-ai"
target="$APP_DIR/.env"
db_target="$APP_DIR/db.env"

for f in "$target" "$db_target"; do
  if [ -e "$f" ]; then
    echo "$f already exists; not overwriting anything (edit with nano instead)." >&2
    exit 1
  fi
done
command -v openssl > /dev/null || { echo "openssl is required" >&2; exit 1; }

hex() { openssl rand -hex "$1"; }

# ask VAR "prompt" default [secret]
ask() {
  local __var="$1" __prompt="$2" __default="$3" __secret="${4:-}" __value=""
  if [ -t 0 ]; then
    if [ -n "$__secret" ]; then
      read -r -s -p "$__prompt (Enter = skip): " __value
      echo
    else
      read -r -p "$__prompt (Enter = skip): " __value
    fi
  fi
  __value="${__value:-$__default}"
  if [[ "$__value" == *"'"* ]]; then
    echo "Values may not contain a single quote." >&2
    exit 1
  fi
  printf -v "$__var" '%s' "$__value"
}

echo "Creating $target"
echo "Secrets are generated automatically. Answer the questions below (nothing you type is shown back)."
ask SMTP_USER "Gmail address that sends email (SMTP_USER)" "change_me@gmail.com"
ask SMTP_PASS "Gmail App Password for it (SMTP_PASS, hidden)" "change_me_gmail_app_password" secret
SMTP_PASS="${SMTP_PASS// /}"
ask GOOGLE_CLIENT_ID "Google OAuth client ID (GOOGLE_CLIENT_ID)" "change_me_google_client_id"
ask GOOGLE_CLIENT_SECRET "Google OAuth client secret (GOOGLE_CLIENT_SECRET, hidden)" "change_me_google_client_secret" secret

umask 077
mkdir -p "$APP_DIR"
# Backups (deploy/backup-db.sh, cron) and failed-deploy logs: root only.
mkdir -p "$APP_DIR/backups" "$APP_DIR/logs"
chmod 700 "$APP_DIR/backups" "$APP_DIR/logs"
cat > "$db_target" <<EOF
# EduAnalyzeAI database credentials — created by deploy/make-env.sh on $(date +%Y-%m-%d).
# Used by the postgres, migrate and backend containers. Never commit or paste.
# Changing the password here does NOT change it inside an existing database.
POSTGRES_USER=eduanalyze
POSTGRES_PASSWORD=$(hex 24)
EOF
chmod 600 "$db_target"

cat > "$target" <<EOF
# EduAnalyzeAI production settings — created by deploy/make-env.sh on $(date +%Y-%m-%d).
# Contains secrets: permissions 600, never commit, never paste anywhere.

# --- Docker Compose ---
COMPOSE_PROJECT_NAME=eduanalyze
APP_ENV_FILE=.env
DB_ENV_FILE=db.env
BACKEND_IMAGE=${IMAGE_PREFIX}-backend
FRONTEND_IMAGE=${IMAGE_PREFIX}-frontend
MIGRATOR_IMAGE=${IMAGE_PREFIX}-migrator
# Set by each deploy (sha-xxxxxxx); empty = latest until the first deploy.
# Rollback = deploy an older sha tag (see .image-tag-history).
IMAGE_TAG=
# Host ports, bound to 127.0.0.1 only; nginx proxies to them.
FRONTEND_PORT=3400
BACKEND_PORT=3401

# --- App ---
NODE_ENV=production
PORT=3001
CORS_ORIGIN=https://${DOMAIN}
FRONTEND_URL=https://${DOMAIN}
# nginx on this VPS is exactly one proxy hop in front of the API.
TRUST_PROXY_HOPS=1

# --- Database: credentials are in db.env; the DB is never published ---

# --- JWT / sessions ---
JWT_ACCESS_SECRET=$(hex 32)
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=$(hex 32)
JWT_REFRESH_EXPIRES_IN=7d
SESSION_ABSOLUTE_MAX_HOURS=8
JWT_2FA_PENDING_SECRET=$(hex 32)
JWT_2FA_PENDING_EXPIRES_IN=5m
# 64 hex chars. Losing it makes every 2FA secret unreadable: back this file up.
TOTP_ENCRYPTION_KEY=$(hex 32)

# --- Self sign-up: ku.th only (never test.local in production) ---
SELF_SIGNUP_ALLOWED_DOMAINS=ku.th

# --- Google OAuth (placeholders keep the server bootable when unused) ---
GOOGLE_CLIENT_ID='${GOOGLE_CLIENT_ID}'
GOOGLE_CLIENT_SECRET='${GOOGLE_CLIENT_SECRET}'
GOOGLE_CALLBACK_URL=https://${DOMAIN}/api/auth/google/callback
# true = a NEW Google sign-up must also carry the Workspace hd claim of an
# allowed domain. Turn on only after confirming @ku.th accounts send hd=ku.th.
GOOGLE_REQUIRE_HOSTED_DOMAIN=false

# --- Email: Gmail SMTP (STARTTLS on 587) ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER='${SMTP_USER}'
SMTP_PASS='${SMTP_PASS}'
SMTP_FROM='${SMTP_USER}'

# --- AI analysis: OFF in production. With "disabled" (or empty) the API
# answers 503 before any student data is read or sent. A real key would send
# grades to an outside provider (Anthropic): set one only after the privacy
# policy names that transfer and the university has approved it. ---
ANTHROPIC_API_KEY=disabled
EOF
chmod 600 "$target"

echo "Done: $target and $db_target (permissions 600). No secret was printed."
if grep -q "change_me" "$target"; then
  echo "Still placeholders (fill later with nano):"
  grep -oE "^[A-Z_]+='?change_me" "$target" | cut -d= -f1 | sed 's/^/  - /'
fi
echo "Next: keep a copy of both files somewhere safe off the VPS (.env holds TOTP_ENCRYPTION_KEY)."
