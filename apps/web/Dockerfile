# syntax=docker/dockerfile:1
# Multi-stage build for @kiss-pm/web (Next.js standalone output).
# Build context is the repo root: docker build -f apps/web/Dockerfile .
# Mirrors apps/api/Dockerfile: install + build happen in one stage so the pnpm
# workspace node_modules (incl. per-package links) stay intact; the runner ships
# only the self-contained Next standalone output.

# ── builder: install the web workspace closure and build the standalone bundle ─
FROM node:22-alpine AS builder

WORKDIR /workspace

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/access-control/package.json packages/access-control/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/planning-client/package.json packages/planning-client/package.json
COPY packages/planning-gantt-ui/package.json packages/planning-gantt-ui/package.json
COPY packages/tenant-org-structure/package.json packages/tenant-org-structure/package.json

RUN pnpm --filter @kiss-pm/web... install --prod=false --frozen-lockfile

COPY apps/web apps/web
COPY packages packages

# next.config.ts sets output: "standalone" + outputFileTracingRoot = repo root,
# so the traced server bundle lands in apps/web/.next/standalone/…
RUN pnpm --filter @kiss-pm/web exec next build

# ── runner: minimal runtime image with only the standalone output ────────────
FROM node:22-alpine AS runner

WORKDIR /workspace

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Non-root runtime user.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# The standalone output already contains a minimal node_modules + the workspace
# layout (apps/web/server.js, top-level node_modules). Static assets and public/
# are NOT part of standalone and must be copied alongside server.js.
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

# server.js honours HOSTNAME/PORT from the environment (0.0.0.0:3000 above).
CMD ["node", "apps/web/server.js"]
