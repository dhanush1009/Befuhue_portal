# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
# Production-optimised Dockerfile for Deep Impression (Next.js 14 + Prisma)
#
# Stages:
#   1. base        — shared Alpine base with OS deps
#   2. deps        — production npm install (layer-cached by package-lock.json)
#   3. builder     — compile Next.js app + compile seed script to JS
#   4. runner      — minimal production image (~200 MB vs ~1 GB naive)
#
# Key decisions:
#   • next.config.mjs output:"standalone" → runner copies only .next/standalone
#     which bundles its own minimal node_modules — no full node_modules copy
#   • seed.ts compiled to JS in builder → no ts-node / TypeScript at runtime
#   • Non-root "nextjs" user in runner (UID 1001)
#   • --mount=type=cache for npm cache between builds
#   • NEXT_TELEMETRY_DISABLED=1 throughout
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Shared Alpine base ───────────────────────────────────────────────
FROM node:20-alpine AS base
# openssl required by Prisma client binaries; libc6-compat for Alpine ABI compat
RUN apk add --no-cache libc6-compat openssl


# ── Stage 2: Install production dependencies ──────────────────────────────────
FROM base AS deps
WORKDIR /app

# Copy only the files that affect dependency installation.
# Changing source code won't bust this cache layer.
COPY package.json package-lock.json ./

# Use BuildKit cache mount so npm download cache persists across builds.
# --legacy-peer-deps handles tiptap v3 / react 19 peer resolution.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps


# ── Stage 3: Build application ────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Bring in installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the full source (respects .dockerignore — no .next, .env, node_modules)
COPY . .

# Generate Prisma client for the target platform (linux-musl / linux-musl-openssl-3.0.x)
RUN ./node_modules/.bin/prisma generate

# Compile seed.ts → dist/seed/prisma/seed.js  (no ts-node needed at runtime)
# tsconfig.seed.json outputs CommonJS to dist/seed/
RUN ./node_modules/.bin/tsc --project tsconfig.seed.json

# Build Next.js production bundle (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


# ── Stage 4: Production runner ────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user/group (principle of least privilege)
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# ── Static assets ─────────────────────────────────────────────────────────────
# Public folder (fonts, images) — not owned by nextjs because it's read-only
COPY --from=builder /app/public ./public

# ── Next.js standalone bundle ─────────────────────────────────────────────────
# .next/standalone contains server.js + its own minimal node_modules tree.
# This is the ONLY node_modules we need — no full copy of 500 MB node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static

# ── Prisma — client, CLI, engines, schema + migrations ───────────────────
# Copy the full Prisma ecosystem from builder:
#   .prisma/         — generated query engine binary (platform-specific)
#   @prisma/         — client, engines, debug, fetch-engine, get-platform, etc.
#   prisma/          — CLI package (references @prisma/engines at runtime)
# Copying all three scopes together avoids MODULE_NOT_FOUND errors from
# missing transitive Prisma dependencies (e.g. @prisma/engines).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma   ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma   ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma    ./node_modules/prisma
# Copy the entire .bin dir so prisma_schema_build_bg.wasm (and any other
# sibling assets the Prisma CLI needs) are present next to the prisma script.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin      ./node_modules/.bin
COPY --from=builder --chown=nextjs:nodejs /app/prisma                  ./prisma

# ── Seed runtime dependencies (not bundled by Next.js standalone) ────────────
# seed.js requires these directly via CommonJS require() at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs   ./node_modules/bcryptjs
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/date-fns   ./node_modules/date-fns

# ── Compiled seed (plain JS — no ts-node needed) ──────────────────────────────
COPY --from=builder --chown=nextjs:nodejs /app/dist/seed ./dist/seed

# ── Entrypoint script ─────────────────────────────────────────────────────────
COPY --chown=nextjs:nodejs scripts/migrate-and-seed.sh ./scripts/migrate-and-seed.sh
RUN chmod +x ./scripts/migrate-and-seed.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# migrate-and-seed.sh runs prisma db push (MongoDB has no SQL migrations) + node seed.js, then exec "$@"
ENTRYPOINT ["sh", "./scripts/migrate-and-seed.sh"]
CMD ["node", "server.js"]
