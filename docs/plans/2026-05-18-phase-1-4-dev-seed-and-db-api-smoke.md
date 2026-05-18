# Phase 1.4: Dev seed and DB API smoke plan

## Цель

Сделать локальную Docker БД пригодной для разработки сразу после `db:migrate`: добавить demo seed и DB-backed API smoke.

## Архитектура

`packages/persistence/src/seed.ts` содержит generic seed helper, который не зависит от test fixtures. Root script `scripts/seed-dev.ts` собирает demo dataset из `packages/test-fixtures` и вызывает persistence helper. DB tests живут отдельно от быстрых unit tests.

## План работ

1. Добавить phase doc и этот plan.
2. Обновить demo fixtures так, чтобы access profile id были tenant-specific.
3. RED: добавить `packages/persistence/src/seed.db.test.ts`.
4. RED: добавить `apps/api/src/app.db.test.ts`.
5. Реализовать `packages/persistence/src/seed.ts`.
6. Реализовать `scripts/seed-dev.ts`.
7. Добавить scripts:
   - `db:seed:dev`;
   - `db:reset:dev` как удобный порядок `db:migrate + db:seed:dev`.
8. Обновить README/docs.
9. Запустить:
   - `pnpm test`;
   - `pnpm typecheck`;
   - `pnpm db:migrate`;
   - `pnpm db:seed:dev`;
   - `pnpm test:db`;
   - API smoke against DB;
   - markdown link check.

## Границы

В 1.4 не делаем настоящий login, password auth, invite flow или UI формы пользователей. Demo seed нужен только для локальной разработки и проверки runtime plumbing.
