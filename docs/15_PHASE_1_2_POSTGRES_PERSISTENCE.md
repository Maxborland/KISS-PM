# 15. Phase 1.2: PostgreSQL persistence foundation

## Статус

Phase 1.2 продолжает чистый Node + pnpm старт. Старый persistence-код не используется.

## Цель

Заложить минимальный PostgreSQL слой, который поддерживает будущую SaaS/self-hosted архитектуру: миграции, tenant-scoped таблицы, access profiles, users и audit events.

## Выбранный подход

- ORM/schema: Drizzle.
- Database driver: `postgres`.
- Migrations: SQL-файлы в `packages/persistence/migrations`.
- Runtime package: `packages/persistence`.

## Почему Drizzle

Drizzle дает явную TypeScript-схему, читаемые SQL-миграции и не прячет доменную модель за тяжелым runtime. Это хорошо подходит для self-hosted продукта, где схема БД должна быть понятной оператору и проверяемой в коде.

## Закрытый backlog Phase 1.2

1. Создать `packages/persistence`.
2. Добавить Drizzle schema для:
   - `tenants`;
   - `access_profiles`;
   - `tenant_users`;
   - `audit_events`.
3. Добавить первую SQL migration.
4. Добавить root scripts:
   - `db:generate`;
   - `db:migrate`.
5. Добавить тесты, которые доказывают:
   - таблицы, кроме `tenants`, имеют `tenant_id`;
   - audit event содержит обязательные поля;
   - audit event нельзя создать без `tenantId`, `actorUserId`, `actionType`, `permissionResult`, `executionResult`, `correlationId`.
6. Обновить документацию старта.

## Non-scope

- Real auth/session.
- Production connection pool policy.
- Row-level security.
- Docker compose для PostgreSQL.
- Перевод существующего demo API на реальную БД.
- Gantt, KPI, CRM, resource matrix.

## Acceptance criteria

- `pnpm install` завершен и lockfile обновлен.
- `pnpm test` проходит.
- `pnpm typecheck` проходит.
- `pnpm --filter @kiss-pm/persistence test` проходит.
- Миграция существует и содержит tenant-scoped constraints/indexes.
- Документы описывают, что БД-слой появился, но runtime API еще остается demo/in-memory до следующего шага.

## Следующий шаг после Phase 1.2

Phase 1.3 реализует Docker Compose PostgreSQL runtime, connection factory, repository integration tests и API Postgres wiring.
