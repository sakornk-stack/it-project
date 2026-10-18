# Environment variables

Names and purpose only. Never put values in this file. Templates:
`apps/backend/.env.example` and `apps/frontend/.env.example`.

## Backend (runtime, `apps/backend/.env`)

"Required in prod" means the server refuses to start in `NODE_ENV=production` without it.

| Name | Required in prod | Purpose |
|---|---|---|
| `NODE_ENV` | yes | `production` turns on Secure cookies and hides Swagger. Set by the backend image. |
| `PORT` | no | API port (default 3001). |
| `CORS_ORIGIN` | yes | Comma-separated browser origins allowed to call the API. |
| `FRONTEND_URL` | yes | Base URL for post-login redirects and email links. |
| `TRUST_PROXY_HOPS` | no | Reverse-proxy hops in front of the API (default 0 = trust none). Needed for correct per-IP rate limiting behind nginx or a CDN. |
| `ALLOW_PROD_SEED` | no | Set to `yes` for a single command to let a seed/import script run under `NODE_ENV=production`. Do not store it in `.env`. |
| `DATABASE_URL` | yes | Postgres connection string. The Docker image builds its own from the two `POSTGRES_*` names below. |
| `POSTGRES_USER` | compose | Postgres user (read by the postgres service and the backend image). |
| `POSTGRES_PASSWORD` | compose | Postgres password (same). |
| `JWT_ACCESS_SECRET` | yes | Signs access tokens. 32+ characters recommended. |
| `JWT_ACCESS_EXPIRES_IN` | no | Access token lifetime (default 15m). |
| `JWT_REFRESH_SECRET` | yes | Signs refresh tokens. 32+ characters recommended. |
| `JWT_REFRESH_EXPIRES_IN` | no | Refresh token lifetime (default 7d). |
| `SESSION_ABSOLUTE_MAX_HOURS` | no | Hard session cap from login (default 8). Keep equal to `NEXT_PUBLIC_SESSION_MAX_HOURS`. |
| `JWT_2FA_PENDING_SECRET` | yes | Signs the short-lived pending-2FA token. 32+ characters recommended. |
| `JWT_2FA_PENDING_EXPIRES_IN` | no | Pending-2FA token lifetime (default 5m). |
| `GOOGLE_CLIENT_ID` | no | Google OAuth client id. |
| `GOOGLE_CLIENT_SECRET` | no | Google OAuth client secret. |
| `GOOGLE_CALLBACK_URL` | no | Public URL of the OAuth callback. |
| `GOOGLE_REQUIRE_HOSTED_DOMAIN` | no | `true`: a new Google sign-up must also carry the Workspace `hd` claim for an allowed domain (default false). Returning users are not affected. |
| `SELF_SIGNUP_ALLOWED_DOMAINS` | no | Email domains self-service sign-up accepts, comma-separated, exact match (default `ku.th`; `sub.ku.th` and `evilku.th` are refused). Applies to email+password and Google sign-up, not to staff invitations. **Production must be `ku.th` only, never `test.local`.** Dev/test may add `test.local` in their own `.env` only. Keep equal to `NEXT_PUBLIC_SELF_SIGNUP_DOMAINS`. |
| `SMTP_HOST` | no | Mail server for reset, invite and sign-up verification emails. Without it, email+password sign-up cannot be finished. |
| `SMTP_PORT` | no | Mail server port (default 587). |
| `SMTP_USER` | no | Mail account. |
| `SMTP_PASS` | no | Mail app password. |
| `SMTP_FROM` | no | Sender address. |
| `TOTP_ENCRYPTION_KEY` | yes | Encrypts 2FA secrets (64 hex characters). Losing it makes every 2FA secret unreadable, so back it up separately. |
| `ANTHROPIC_API_KEY` | no | Enables AI analysis. Empty or `disabled` turns it off: the endpoint answers 503 before any student data is read or sent. **Production keeps it `disabled`** until the privacy policy names the transfer of student data to this outside provider and the university has approved it. |
| `ANTHROPIC_MODEL` | no | Model override for AI analysis. |

## Container only (backend and migrator images)

| Name | Default | Purpose |
|---|---|---|
| `POSTGRES_HOST` | `postgres` | Database host the image entrypoint puts in `DATABASE_URL`. |
| `POSTGRES_DB` | `eduanalyze_ai` | Database name the image entrypoint puts in `DATABASE_URL`. |

Inside a container `DATABASE_URL` is always built from `POSTGRES_USER`, `POSTGRES_PASSWORD` and the two above.

## Docker Compose (`docker-compose.yml`)

Compose variables: read from the shell or from a `.env` next to `docker-compose.yml`, not from `apps/backend/.env`.
Local dev needs none of them. On the VPS, `deploy/make-env.sh` writes them to `~/eduanalyze/.env`.

| Name | Local default | VPS value | Purpose |
|---|---|---|---|
| `COMPOSE_PROJECT_NAME` | folder name (`eduanalyze-ai`) | `eduanalyze` | Prefix of container, volume and network names. Do not set it locally: the dev volume is `eduanalyze-ai_postgres_data`. |
| `APP_ENV_FILE` | `apps/backend/.env` | `.env` | Env file for the backend and migrator. |
| `DB_ENV_FILE` | same as `APP_ENV_FILE` | `db.env` | Env file with only `POSTGRES_USER`/`POSTGRES_PASSWORD`. postgres and the migrator read only this file (no JWT/SMTP/TOTP); the backend reads it plus `APP_ENV_FILE`. Kept apart so a deploy that rewrites `IMAGE_TAG` does not restart postgres. |
| `BACKEND_IMAGE` | `eduanalyze-ai-backend` | `ghcr.io/patcharadnaimingchua/eduanalyze-ai-backend` | Backend image name. |
| `FRONTEND_IMAGE` | `eduanalyze-ai-frontend` | `ghcr.io/patcharadnaimingchua/eduanalyze-ai-frontend` | Frontend image name. |
| `MIGRATOR_IMAGE` | `eduanalyze-ai-migrator` | `ghcr.io/patcharadnaimingchua/eduanalyze-ai-migrator` | Image that runs `prisma migrate deploy` and exits. |
| `IMAGE_TAG` | `latest` (also when empty) | empty at first, then `sha-xxxxxxx` (set by each deploy) | Tag used for the three app images; rollback means an older tag (history in `~/eduanalyze/.image-tag-history`). |
| `BACKEND_PORT` | 3001 | 3401 | Host port, always bound to 127.0.0.1. |
| `FRONTEND_PORT` | 3000 | 3400 | Host port, always bound to 127.0.0.1. |

## Frontend (build time, `apps/frontend/.env.local` or Docker build args)

`NEXT_PUBLIC_*` values are inlined into the browser bundle at build time. Changing one needs a rebuild.
Do not put secrets in any of them. The Docker image takes each as a build arg
(`docker-compose.yml` passes them with the defaults shown).

| Name | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001/api` | Browser-reachable API base URL. Must end in `/api`. |
| `NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES` | 30 | Idle minutes before sign-out. |
| `NEXT_PUBLIC_IDLE_WARNING_SECONDS` | 60 | Warning shown this long before idle sign-out. |
| `NEXT_PUBLIC_SESSION_MAX_HOURS` | 8 | Early-warning cap. Must match backend `SESSION_ABSOLUTE_MAX_HOURS`; the backend enforces it. |
| `NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN` | false | Shows the Google sign-in buttons when `true`. |
| `NEXT_PUBLIC_SELF_SIGNUP_DOMAINS` | `ku.th` | **Production must be `ku.th` only, never `test.local`.** Domains named in the sign-up form hint and checked before submit. Display only; the backend `SELF_SIGNUP_ALLOWED_DOMAINS` decides. |
