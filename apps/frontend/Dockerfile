# Build context is the repo root (npm workspaces monorepo) — required so
# npm can resolve @eduanalyze-ai/shared-types via its workspace symlink.
# Run as: docker build -f apps/frontend/Dockerfile .

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, not
# read at runtime — this MUST be a URL the browser can reach directly
# (e.g. http://localhost:3001, the backend's published host port), never
# a Docker-internal service hostname like http://backend:3001, which only
# resolves inside the compose network and is unreachable from the
# browser making the actual fetch calls.
# Must include the /api prefix (NestJS global prefix) — every backend route
# lives under it.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
# The remaining NEXT_PUBLIC_* the code reads (apps/frontend/.env.example).
# .dockerignore excludes .env.local, so without these ARGs they silently fall
# back to code defaults inside the image. Defaults below match .env.example;
# IDLE_*/SESSION_MAX_HOURS fall back to 30 / 60 / 8 in
# src/lib/session-timeout-config.ts when unset or invalid.
ARG NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES=30
ARG NEXT_PUBLIC_IDLE_WARNING_SECONDS=60
ARG NEXT_PUBLIC_SESSION_MAX_HOURS=8
ARG NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN=false
ENV NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES=${NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES} \
    NEXT_PUBLIC_IDLE_WARNING_SECONDS=${NEXT_PUBLIC_IDLE_WARNING_SECONDS} \
    NEXT_PUBLIC_SESSION_MAX_HOURS=${NEXT_PUBLIC_SESSION_MAX_HOURS} \
    NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN=${NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN}
RUN npm run build --workspace=apps/frontend

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/apps/frontend/.next-build ./apps/frontend/.next-build
COPY --chown=node:node --from=build /app/apps/frontend/package.json ./apps/frontend/package.json
COPY --chown=node:node --from=build /app/apps/frontend/next.config.mjs ./apps/frontend/next.config.mjs

# node:22-slim ships a built-in non-root `node` user (uid 1000) — run as it
# instead of root (docker:S6471). All app files above are chown'd to it.
USER node

EXPOSE 3000
WORKDIR /app/apps/frontend

# Invokes `next` directly rather than `npm run start --workspace=...` —
# that npm form needs the repo-root package.json (for workspace
# resolution) which this stage deliberately doesn't copy in, to keep the
# runtime image to just what's actually needed to serve the app.
# NEXT_BUILD_MODE=production matches what the start script sets (see
# apps/frontend/package.json) — required so Next reads .next-build, this
# project's custom distDir, not the default .next.
CMD ["sh", "-c", "NEXT_BUILD_MODE=production ../../node_modules/.bin/next start"]
