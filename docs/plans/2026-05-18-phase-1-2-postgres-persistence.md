# Phase 1.2: PostgreSQL persistence foundation plan

## Цель

Добавить минимальный persistence foundation без переноса старого кода и без преждевременного product scope.

## Архитектура

`packages/persistence` отвечает только за БД-схему, миграции и минимальные helpers для audit record. Domain logic остается в `packages/domain`, права остаются в `packages/access-control`, API пока использует demo fixtures.

## План работ

1. Создать package skeleton:
   - `packages/persistence/package.json`;
   - `packages/persistence/tsconfig.json`;
   - `packages/persistence/src/index.ts`;
   - `packages/persistence/src/schema.test.ts`;
   - `packages/persistence/src/auditEvent.test.ts`.
2. RED: запустить `pnpm --filter @kiss-pm/persistence test` и получить падение из-за отсутствующей реализации.
3. Добавить зависимости:
   - `drizzle-orm`;
   - `postgres`;
   - `drizzle-kit`.
4. Реализовать:
   - Drizzle schema для `tenants`, `access_profiles`, `tenant_users`, `audit_events`;
   - `tenantScopedTableNames`;
   - `createAuditEventRecord`;
   - validation обязательных audit fields.
5. Добавить migration:
   - `packages/persistence/migrations/0000_phase_1_2_foundation.sql`.
6. Добавить Drizzle config:
   - `drizzle.config.ts`.
7. Обновить root scripts и references:
   - `package.json`;
   - `tsconfig.json`;
   - `README.md`;
   - `docs/README.md`;
   - `docs/14_PHASE_1_NODE_PNPM_START.md`.
8. Проверить:
   - `pnpm --filter @kiss-pm/persistence test`;
   - `pnpm test`;
   - `pnpm typecheck`;
   - markdown link check.

## Границы

В этой фазе нельзя подключать API к реальной БД без отдельного решения о локальном PostgreSQL/test database. Цель 1.2 — schema/migrations/audit foundation, а не полноценный persistence runtime.
