# ==============================================================================
# BIZOPS AI - PRODUCTION API DOCKERFILE
# Multi-stage, non-root, minimal attack-surface production image for Fastify API
# ==============================================================================

# STAGE 1: Prune & Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install full workspace dependencies for building
RUN pnpm install --frozen-lockfile

# Copy application source & schema
COPY apps/api ./apps/api

# Generate Prisma client & build TypeScript output
WORKDIR /app/apps/api
RUN pnpm run prisma:generate
RUN pnpm run build

# STAGE 2: Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

# Install curl for docker healthcheck
RUN apk add --no-cache curl

# Enable pnpm in runner stage
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency definitions
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy Prisma schema and compiled artifacts from builder
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma

# Switch to standard non-root user
USER node

WORKDIR /app/apps/api

EXPOSE 4000

# Docker Healthcheck targeting Phase 8 liveness endpoint
# Uses Node 20 native fetch (zero external curl/wget binary dependencies) with fallback to curl
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" || curl -f http://localhost:4000/health || exit 1

# Start production service
CMD ["node", "dist/server.js"]
