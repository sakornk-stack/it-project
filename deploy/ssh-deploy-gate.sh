#!/usr/bin/env bash
# Forced command for the GitHub Actions deploy key. In /root/.ssh/authorized_keys
# the key's line starts with:
#   restrict,command="/root/eduanalyze/deploy/ssh-deploy-gate.sh" ssh-ed25519 AAAA... github-actions-eduanalyze
# so whatever the client asks for, sshd runs this script instead, with the
# requested command in SSH_ORIGINAL_COMMAND. The only request allowed is
#   deploy sha-<7-40 hex>
# which runs deploy/remote-deploy.sh with that tag. No shell, no scp, no port
# forwarding (`restrict`). Anything else is refused without echoing it back.
#
# This file and remote-deploy.sh must stay owned by root and not writable by
# anyone else; update them by hand with scp (docs/DEPLOY.md).
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/eduanalyze}"
request="${SSH_ORIGINAL_COMMAND:-}"
allowed='^deploy (sha-[0-9a-f]{7,40})$'

if [[ "$request" =~ $allowed ]]; then
  exec bash "$APP_DIR/deploy/remote-deploy.sh" "${BASH_REMATCH[1]}"
fi

echo "Refused: this key may only run 'deploy sha-<hex>'." >&2
if command -v logger > /dev/null; then
  logger -t eduanalyze-deploy "refused a command from the deploy key" || true
fi
exit 1
