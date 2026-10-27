# One container for Render's free plan: the NestJS API and the Next.js web
# app run side by side, and Next forwards /api to the API on 127.0.0.1.
# One service means one instance-hours meter (~744 h/month), so it can be kept
# awake all month inside the 750 free hours, and the web never waits for a
# sleeping API (the 502s seen with two services).
# Build context is the repo root: docker build -f deploy/render/Dockerfile .

FROM node:22-slim AS base
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS manifests
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

# ---- API (same steps as apps/backend/Dockerfile) ----
FROM manifests AS api-deps
RUN npm ci --workspace=@eduanalyze-ai/backend

FROM api-deps AS api-build
COPY apps/backend apps/backend
RUN npx prisma generate --schema=apps/backend/prisma/schema.prisma \
  && npm run build --workspace=apps/backend

FROM manifests AS api-prod-deps
RUN npm ci --omit=dev --workspace=@eduanalyze-ai/backend && npm cache clean --force
COPY --from=api-build /app/node_modules/.prisma ./node_modules/.prisma
# The Prisma CLI (a devDependency) for `migrate deploy` at start-up.
COPY --from=api-deps /app/node_modules/prisma ./node_modules/prisma
COPY --from=api-deps /app/node_modules/@prisma/engines ./node_modules/@prisma/engines

# ---- Web (same steps as apps/frontend/Dockerfile) ----
FROM manifests AS web-deps
RUN npm ci --workspace=@eduanalyze-ai/frontend

FROM web-deps AS web-build
COPY packages packages
COPY apps/frontend apps/frontend
# Inlined into the client bundle / routes manifest at build time.
ARG NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN=true
ARG NEXT_PUBLIC_SELF_SIGNUP_DOMAINS=ku.th
ENV NEXT_PUBLIC_API_URL=/api \
    API_PROXY_TARGET=http://127.0.0.1:3001 \
    NEXT_PUBLIC_IDLE_TIMEOUT_MINUTES=30 \
    NEXT_PUBLIC_IDLE_WARNING_SECONDS=60 \
    NEXT_PUBLIC_SESSION_MAX_HOURS=8 \
    NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN=${NEXT_PUBLIC_ENABLE_GOOGLE_LOGIN} \
    NEXT_PUBLIC_SELF_SIGNUP_DOMAINS=${NEXT_PUBLIC_SELF_SIGNUP_DOMAINS} \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
RUN npm run build --workspace=apps/frontend

# ---- Runtime: both apps ----
FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0
# API under /app/api, web under /app/web (each keeps its own node_modules).
COPY --chown=node:node --from=api-prod-deps /app/node_modules /app/api/node_modules
COPY --chown=node:node --from=api-build /app/apps/backend/dist /app/api/apps/backend/dist
COPY --chown=node:node apps/backend/package.json /app/api/apps/backend/package.json
COPY --chown=node:node apps/backend/prisma/schema.prisma /app/api/apps/backend/prisma/schema.prisma
COPY --chown=node:node apps/backend/prisma/migrations /app/api/apps/backend/prisma/migrations
COPY --chown=node:node --from=web-build /app/apps/frontend/.next-build/standalone /app/web
COPY --chown=node:node --from=web-build /app/apps/frontend/.next-build/static /app/web/apps/frontend/.next-build/static
COPY --chmod=755 deploy/render/start.sh /usr/local/bin/start.sh
USER node
# Render sets PORT (the web's public port); the API stays on 3001 inside.
ENV PORT=3000
EXPOSE 3000
CMD ["start.sh"]
