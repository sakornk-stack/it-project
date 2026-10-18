#!/usr/bin/env bash
# Creates the first SUPER_ADMIN on the VPS (once, on an empty database).
# Usage (asks for the email and full name):
#   bash ~/eduanalyze/deploy/create-first-admin.sh
# Then open https://eduanalyze.itkukps.tech/forgot-password, enter the same
# email and set the password from the link that arrives.
#
# What it does: see apps/backend/src/cli/create-first-admin.ts. Refuses if a
# SUPER_ADMIN already exists or the email is taken. Prints the account id and
# a masked email only. Runs in a one-off backend container (no ports).
# The email and name travel as environment variables of that one-off
# container (removed with --rm), never as command-line arguments, so they
# do not show up in `ps` or in shell history.
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/eduanalyze}"

if [ -z "${FIRST_ADMIN_EMAIL:-}" ]; then
  read -r -p "SUPER_ADMIN email: " FIRST_ADMIN_EMAIL
fi
if [ -z "${FIRST_ADMIN_NAME:-}" ]; then
  read -r -p "SUPER_ADMIN full name: " FIRST_ADMIN_NAME
fi
if [ -z "$FIRST_ADMIN_EMAIL" ] || [ -z "$FIRST_ADMIN_NAME" ]; then
  echo "Both the email and the full name are required." >&2
  exit 2
fi
export FIRST_ADMIN_EMAIL FIRST_ADMIN_NAME

cd "$APP_DIR"
# `-e NAME` without a value copies it from this shell's environment.
docker compose run --rm --no-deps -T -e FIRST_ADMIN_EMAIL -e FIRST_ADMIN_NAME backend \
  node apps/backend/dist/cli/create-first-admin.js --confirm
