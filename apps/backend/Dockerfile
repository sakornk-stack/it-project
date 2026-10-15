# Build context is the repo root (npm workspaces monorepo) — see
# docker-compose.yml's `build.context: .` for this service. Run as:
#   docker build -f apps/backend/Dockerfile .
#
# node:22-slim (Debian, glibc) rather than an alpine base — avoids Prisma's
# musl-libc engine binary-target complications; nothing in schema.prisma
# had to change to make this work.

# node:22-slim ships without OpenSSL, and Prisma's engine needs to detect
# its version at both `prisma generate`/`prisma migrate deploy` time and
# Prisma Client runtime — each stage below is a fresh image (multi-stage
# COPY --from doesn't carry over apt packages), so it's installed
# independently wherever Prisma actually runs.
FROM node:22-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --schema=apps/backend/prisma/schema.prisma
RUN npm run build --workspace=apps/backend

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --chown=node:node --from=build /app/apps/backend/prisma ./apps/backend/prisma
COPY --chown=node:node --from=build /app/apps/backend/package.json ./apps/backend/package.json
COPY --chown=node:node --from=build /app/node_modules/.prisma ./node_modules/.prisma

# node:22-slim ships a built-in non-root `node` user (uid 1000) — run as it
# instead of root (docker:S6471). All app files above are chown'd to it, so
# reads/writes it needs at runtime (Prisma engine binary, migration state
# via the DB) work without it owning anything outside /app.
USER node

EXPOSE 3001

# Probes GET /api/health (public, DB `SELECT 1`). node:22-slim has no curl, so
# it uses Node's built-in fetch. start-period covers `prisma migrate deploy`
# running before the server starts — failures during it are not counted.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# prisma migrate deploy applies any pending migration on every container
# start — safe to run repeatedly (no-op if nothing pending), and means a
# fresh environment (new machine, CI) needs no manual migration step.
#
# DATABASE_URL is built here, inside the container, from POSTGRES_USER/
# POSTGRES_PASSWORD (both already injected via docker-compose.yml's
# `env_file: apps/backend/.env` on this service) rather than being set as
# a fixed value in docker-compose.yml — avoids committing/duplicating the
# password anywhere, and "postgres" (the compose service name) is only
# resolvable from inside the compose network, unlike the host-side
# DATABASE_URL in apps/backend/.env (localhost:5433) which this
# intentionally does NOT use.
CMD ["sh", "-c", "export DATABASE_URL=\"postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/eduanalyze_ai?schema=public\" && npx prisma migrate deploy --schema=apps/backend/prisma/schema.prisma && node apps/backend/dist/main.js"]
