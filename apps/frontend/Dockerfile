# Build context is the repo root (npm workspaces monorepo) — required so
# npm can resolve @eduanalyze-ai/shared-types via its workspace symlink.
# Run as: docker build -f apps/frontend/Dockerfile .

FROM node:22-slim AS deps
WORKDIR /app
# Every workspace package.json is copied because npm checks the lockfile
# against all of them, but only the frontend's dependencies are installed.
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm ci --workspace=@eduanalyze-ai/frontend

FROM deps AS build
COPY packages packages
COPY apps/frontend apps/frontend

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, not
# read at runtime — this MUST be a URL the browser can reach directly
# (production: https://eduanalyze.itkukps.tech/api, same origin through
# nginx; local compose: http://localhost:<BACKEND_PORT>/api), never a
# Docker-internal service hostname like http://backend:3001, which only
# resolves inside the compose network.
# Must include the /api prefix (NestJS global prefix) — every backend route
# lives under it.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
# The remaining NEXT_PUBLIC_* the code reads (apps/frontend/.env.example).
# .dockerignore excludes every .env*, so without these ARGs they silently fall
# back to code defaults inside the image. Defaults below match .env.example;
# IDLE_*/SESSION_MAX_HOURS fall back to 30 / 60 / 8 in
# src/lib/session-timeout-config.ts when unset or invalid.
ARG NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES=30
ARG NEXT_PUBLIC_IDLE_WARNING_SECONDS=60
ARG NEXT_PUBLIC_SESSION_MAX_HOURS=8
ARG NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN=false
# Sign-up form hint only; production must be ku.th (never test.local).
ARG NEXT_PUBLIC_SELF_SIGNUP_DOMAINS=ku.th
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES=${NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES} \
    NEXT_PUBLIC_IDLE_WARNING_SECONDS=${NEXT_PUBLIC_IDLE_WARNING_SECONDS} \
    NEXT_PUBLIC_SESSION_MAX_HOURS=${NEXT_PUBLIC_SESSION_MAX_HOURS} \
    NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN=${NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN} \
    NEXT_PUBLIC_SELF_SIGNUP_DOMAINS=${NEXT_PUBLIC_SELF_SIGNUP_DOMAINS} \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
RUN npm run build --workspace=apps/frontend

# Standalone output (see next.config.mjs): server.js plus only the
# node_modules files it traced, so no npm install in this stage. Static
# assets are not part of standalone and are copied next to it.
FROM node:22-slim AS runtime
WORKDIR /app
LABEL org.opencontainers.image.source="https://github.com/Patcharadnaimingchua/eduanalyze-ai"
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --chown=node:node --from=build /app/apps/frontend/.next-build/standalone ./
COPY --chown=node:node --from=build /app/apps/frontend/.next-build/static ./apps/frontend/.next-build/static

# node:22-slim ships a built-in non-root `node` user (uid 1000) — run as it
# instead of root (docker:S6471). All app files above are chown'd to it.
USER node

EXPOSE 3000

# /login is a public page; any non-5xx answer means the server is up.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"]

# HOSTNAME=0.0.0.0 above matters: Docker sets HOSTNAME to the container id,
# and server.js binds to whatever HOSTNAME holds.
CMD ["node", "apps/frontend/server.js"]
