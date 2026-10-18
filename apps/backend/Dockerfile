# Build context is the repo root (npm workspaces monorepo) — see
# docker-compose.yml's `build.context: .` for this service. Run as:
#   docker build -f apps/backend/Dockerfile .                    (API image)
#   docker build -f apps/backend/Dockerfile --target migrator .  (migrations)
#
# node:22-slim (Debian, glibc) rather than an alpine base — avoids Prisma's
# musl-libc engine binary-target complications; nothing in schema.prisma
# had to change to make this work.
#
# node:22-slim ships without OpenSSL, and Prisma's engine needs it at
# generate, migrate and Client runtime, so every stage starts from `base`.
FROM node:22-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
LABEL org.opencontainers.image.source="https://github.com/Patcharadnaimingchua/eduanalyze-ai"

# Every workspace package.json is copied because npm checks the lockfile
# against all of them, but only the backend's dependencies are installed.
FROM base AS manifests
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

# Backend deps including devDependencies (nest CLI, prisma CLI, ts-node).
FROM manifests AS deps
RUN npm ci --workspace=@eduanalyze-ai/backend

FROM deps AS build
COPY apps/backend apps/backend
RUN npx prisma generate --schema=apps/backend/prisma/schema.prisma \
  && npm run build --workspace=apps/backend

# Runtime deps only, plus the Prisma Client generated in `build`.
FROM manifests AS prod-deps
RUN npm ci --omit=dev --workspace=@eduanalyze-ai/backend && npm cache clean --force
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# One-shot job: `prisma migrate deploy`, then exits. It applies only pending
# migrations, so running it on every deploy is safe. It also carries ts-node
# and seed.ts so the curriculum seed can be run by hand, once
# (docs/DEPLOY.md); seed.ts refuses NODE_ENV=production unless
# ALLOW_PROD_SEED=yes is passed for that single command.
FROM base AS migrator
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY apps/backend/package.json apps/backend/tsconfig.json apps/backend/
COPY apps/backend/prisma/schema.prisma apps/backend/prisma/seed.ts apps/backend/prisma/upsert-active.ts apps/backend/prisma/
COPY apps/backend/prisma/migrations apps/backend/prisma/migrations
COPY apps/backend/src/common/util/seed-guard.ts apps/backend/src/common/util/seed-guard.ts
COPY --chmod=755 apps/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
WORKDIR /app/apps/backend
USER node
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["/app/node_modules/.bin/prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"]

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY apps/backend/package.json apps/backend/package.json
COPY --chmod=755 apps/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# node:22-slim ships a built-in non-root `node` user (uid 1000) — run as it
# instead of root (docker:S6471). The app only reads files under /app; all
# state lives in the database.
USER node

EXPOSE 3001

# Probes GET /api/health (public, DB `SELECT 1`). node:22-slim has no curl, so
# it uses Node's built-in fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# Migrations are no longer run here: the `migrate` service (target
# `migrator`) runs them and the backend starts only after it exits 0.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "apps/backend/dist/main.js"]
