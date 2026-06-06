# Phase 1.3: Docker Compose PostgreSQL runtime plan

## Цель

Подключить реальный локальный PostgreSQL runtime через Docker Compose без расширения продуктового scope.

## Архитектура

`docker-compose.yml` отвечает за локальную БД. `packages/persistence` отвечает за connection factory и repositories. `apps/api` получает зависимость data source через `createApp`, а `server.ts` выбирает Postgres runtime только при наличии `DATABASE_URL`.

## План работ

1. Добавить phase doc и этот implementation plan.
2. Добавить RED DB integration test для repositories.
3. Добавить RED API boundary test, который доказывает, что `createApp` может работать с внешним data source.
4. Добавить Docker Compose PostgreSQL service.
5. Добавить root scripts `db:up`, `db:down`, `test:db`.
6. Реализовать `packages/persistence/src/connection.ts`.
7. Реализовать `packages/persistence/src/repositories.ts`.
8. Обновить `apps/api/src/app.ts`, чтобы route handlers работали через data source interface.
9. Обновить `apps/api/src/server.ts`, чтобы при `DATABASE_URL` использовать Postgres repositories.
10. Добавить явный migration runner для SQL-файлов, потому что `drizzle-kit migrate` в текущей среде падает без диагностической ошибки.
11. Запустить:
    - `pnpm test`;
    - `pnpm typecheck`;
    - `docker compose up -d postgres`;
    - `pnpm db:migrate`;
    - `pnpm test:db`;
    - markdown link check.

## Границы

В 1.3 не делаем seed command и не обещаем полный DB-backed dev login после чистой БД. Это следующий маленький шаг, чтобы не смешивать runtime plumbing и fixture lifecycle.
