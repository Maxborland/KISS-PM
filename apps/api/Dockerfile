FROM node:22-alpine AS builder

WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/access-control/package.json packages/access-control/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/persistence/package.json packages/persistence/package.json
COPY packages/tenant-org-structure/package.json packages/tenant-org-structure/package.json
COPY packages/test-fixtures/package.json packages/test-fixtures/package.json

RUN pnpm --filter @kiss-pm/api... install --prod=false --frozen-lockfile

COPY apps/api apps/api
COPY packages packages

RUN pnpm --filter @kiss-pm/api exec esbuild src/server.ts --bundle --platform=node --format=esm --target=node22 --external:redis --outfile=dist/server.js
# Standalone migration runner so the production image can apply DB migrations
# without the pnpm workspace (docker-compose.prod.yml runs this as a one-shot).
# The bundled file lives at apps/api/dist/migrate.js; its `../migrations` lookup
# resolves to apps/api/migrations, which the runtime stage populates below.
RUN pnpm --filter @kiss-pm/api exec esbuild ../../packages/persistence/scripts/migrate.mjs --bundle --platform=node --format=esm --target=node22 --outfile=dist/migrate.js
RUN CI=true pnpm prune --prod
RUN pnpm --filter @kiss-pm/api install --prod --frozen-lockfile --offline

FROM node:22-alpine

WORKDIR /workspace

ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY --from=builder /workspace/apps/api/package.json apps/api/package.json
COPY --from=builder /workspace/node_modules node_modules
COPY --from=builder /workspace/apps/api/node_modules apps/api/node_modules
COPY --from=builder /workspace/apps/api/dist apps/api/dist
# Migration SQL for the bundled dist/migrate.js runner (see docker-compose.prod.yml).
COPY --from=builder /workspace/packages/persistence/migrations apps/api/migrations

EXPOSE 4000

CMD ["node", "apps/api/dist/server.js"]
