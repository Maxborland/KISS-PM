FROM node:22-alpine AS builder

WORKDIR /workspace

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/access-control/package.json packages/access-control/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/persistence/package.json packages/persistence/package.json
COPY packages/tenant-org-structure/package.json packages/tenant-org-structure/package.json
COPY packages/test-fixtures/package.json packages/test-fixtures/package.json

RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY packages packages

RUN pnpm --filter @kiss-pm/api build

FROM node:22-alpine

WORKDIR /workspace

ENV NODE_ENV=production

COPY --from=builder /workspace/apps/api/dist apps/api/dist

EXPOSE 4000

CMD ["node", "apps/api/dist/server.js"]
