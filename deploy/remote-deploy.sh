#!/usr/bin/env bash
# Runs ON the VPS. GitHub Actions reaches it only through the forced command
# deploy/ssh-deploy-gate.sh (`ssh vps "deploy sha-1a2b3c4"`); by hand:
#   bash ~/eduanalyze/deploy/remote-deploy.sh sha-1a2b3c4
#
# 1. backs up the database (when it is running),
# 2. pulls the app images (migrate, backend, frontend) for that tag — postgres
#    is pinned in docker-compose.yml and never pulled here,
# 3. writes the tag to IMAGE_TAG in .env, runs the migrations on their own
#    (`docker compose run --rm migrate`; the running app is untouched if they
#    fail), then `docker compose up -d --no-build` (postgres -> migrate -> backend -> frontend),
# 4. checks /api/health and /login on the local ports.
# On success the tag is appended to .image-tag-history and the sha tag deployed
# before it goes to .previous-image-tag (`latest` is never recorded).
# On any failure after step 3: IMAGE_TAG in .env goes back to what it was,
# detailed logs go to logs/deploy-*.log (600, on the VPS only; migration output
# always goes there), only `docker compose ps` is printed, and the rollback
# command is shown.
#
# Rollback = deploy an older sha tag (see .image-tag-history). Migrations are
# never undone by a rollback; see docs/DEPLOY.md.
# Never runs `down`, never touches volumes.
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$HOME/eduanalyze}"
HEALTH_TRIES="${HEALTH_TRIES:-36}" # x 5 s
tag="${1:?usage: remote-deploy.sh <sha-xxxxxxx|latest>}"
sha_tag='^sha-[0-9a-f]{7,40}$'

if [[ ! "$tag" =~ ^(latest|sha-[0-9a-f]{7,40})$ ]]; then
  echo "Refusing the tag: expected sha-<hex> or latest" >&2
  exit 2
fi
[[ "$HEALTH_TRIES" =~ ^[0-9]+$ ]] || HEALTH_TRIES=36

cd "$APP_DIR"
if [ ! -f .env ]; then
  echo "$APP_DIR/.env is missing: run deploy/make-env.sh first (docs/DEPLOY.md)" >&2
  exit 1
fi
umask 077
mkdir -p -m 700 logs

env_value() { grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- | tr -d "'\"" || true; }
current="$(env_value IMAGE_TAG)"
backend_port="$(env_value BACKEND_PORT)"
frontend_port="$(env_value FRONTEND_PORT)"
backend_port="${backend_port:-3401}"
frontend_port="${frontend_port:-3400}"
history_file=".image-tag-history"

# Newest sha tag in the history that is not $1.
last_sha_except() {
  [ -f "$history_file" ] || return 0
  awk '{print $2}' "$history_file" | grep -E "$sha_tag" | grep -vxF "$1" | tail -n 1 || true
}

set_image_tag() {
  if grep -qE '^IMAGE_TAG=' .env; then
    sed -i.bak -E "s/^IMAGE_TAG=.*/IMAGE_TAG=$1/" .env && rm -f .env.bak
  else
    printf 'IMAGE_TAG=%s\n' "$1" >> .env
  fi
}

# Everything detailed (migration output, container logs) goes to this file on
# the VPS only; the SSH session (and so the GitHub Actions log) gets `ps` only.
log="logs/deploy-$(date +%Y%m%d_%H%M%S)-${tag}.log"
: > "$log"
chmod 600 "$log"
stage="migrate"

fail() {
  trap - ERR
  local reason="$1" rollback
  docker compose logs --no-color --tail 200 migrate backend frontend >> "$log" 2>&1 || true
  set_image_tag "$current"
  docker compose ps --format 'table {{.Service}}\t{{.Status}}' || true
  echo "Deploy of $tag FAILED during $stage: $reason" >&2
  echo "IMAGE_TAG in .env is back to '${current:-<empty> = latest}'." >&2
  if [ "$stage" = "migrate" ]; then
    echo "The running containers were not replaced; the previous version is still serving." >&2
  else
    echo "Containers may now run the failed version: roll back with the command below." >&2
  fi
  echo "Logs (VPS only): $APP_DIR/$log" >&2
  if [[ "$current" =~ $sha_tag ]]; then
    rollback="$current"
  else
    rollback="$(last_sha_except "$tag")"
  fi
  if [ -n "$rollback" ]; then
    echo "Roll back: Actions > Deploy > Run workflow > rollback_tag=$rollback" >&2
    echo "       or: bash $APP_DIR/deploy/remote-deploy.sh $rollback" >&2
  else
    echo "No earlier sha tag recorded; see $history_file and the GHCR packages page." >&2
  fi
  exit 1
}

if [ -n "$(docker compose ps --status running -q postgres 2>/dev/null)" ]; then
  bash "$APP_DIR/deploy/backup-db.sh" pre-deploy
else
  echo "postgres is not running yet (first deploy?): skipping pre-deploy backup"
fi

# Pull first, so a failed pull leaves .env and the running stack untouched.
IMAGE_TAG="$tag" docker compose pull --quiet migrate backend frontend

set_image_tag "$tag"
trap 'fail "a command failed (line $LINENO)"' ERR

echo "Deploying $tag (was: ${current:-none})"
# Migrations first, on their own: `up` would stop and replace the running
# backend/frontend before it learns that migrate failed, so a bad migration
# must fail here, while the old containers are still serving.
docker compose run --rm -T migrate >> "$log" 2>&1
stage="start"
docker compose up -d --no-build --remove-orphans
stage="health check"

healthy=""
for _ in $(seq 1 "$HEALTH_TRIES"); do
  if curl -fs -o /dev/null "http://127.0.0.1:${backend_port}/api/health" \
    && curl -fs -o /dev/null "http://127.0.0.1:${frontend_port}/login"; then
    healthy=yes
    break
  fi
  sleep 5
done
[ -n "$healthy" ] || fail "not healthy after $HEALTH_TRIES checks"
trap - ERR

if [[ "$tag" =~ $sha_tag ]]; then
  # The sha tag that ran before this one; falls back to the history when the
  # stack ran `latest` or nothing.
  if [[ "$current" =~ $sha_tag ]] && [ "$current" != "$tag" ]; then
    previous="$current"
  else
    previous="$(last_sha_except "$tag")"
  fi
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$tag" >> "$history_file"
  if [ -n "$previous" ]; then
    printf '%s\n' "$previous" > .previous-image-tag
  fi
fi
docker compose ps --format 'table {{.Service}}\t{{.Status}}'
echo "Deploy of $tag is healthy."
