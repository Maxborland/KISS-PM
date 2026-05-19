# 16. Phase 1.3: Docker Compose PostgreSQL runtime

## Статус

Phase 1.3 продолжает Phase 1.2. PostgreSQL запускается только через Docker Compose.

## Цель

Сделать воспроизводимый локальный database runtime: Docker Compose поднимает PostgreSQL, Drizzle migration применяет схему, persistence repositories читают tenant/users из БД, API server может работать с Postgres через `DATABASE_URL`.

## Выбранный подход

- Docker Compose service: `postgres`.
- Для dev runtime Docker Compose также может поднимать `api` и `web`, чтобы frontend и backend были постоянно доступны с live reload.
- Host port: `55432`, чтобы не конфликтовать с возможным локальным PostgreSQL на `5432`.
- Runtime URL: `postgres://kiss_pm:kiss_pm_dev_password@127.0.0.1:55432/kiss_pm`.
- Dev web URL: `http://127.0.0.1:3000`.
- Dev API URL: `http://127.0.0.1:4000`.
- Команда `pnpm dev:compose` поднимает `postgres`, `api` и `web`; команда `pnpm dev:compose:detached` делает то же самое в фоне.
- В Compose используется bind mount репозитория и отдельные Linux `node_modules` volumes, чтобы изменения кода были видны realtime, а зависимости не брались из Windows `node_modules`.
- `db:migrate` применяет SQL-файлы из `packages/persistence/migrations` через явный migration runner и таблицу `kiss_pm_migrations`.
- Unit/API tests остаются быстрыми и не требуют Docker.
- DB integration tests запускаются отдельной командой.

## Закрытый backlog Phase 1.3

1. Добавить `docker-compose.yml` с PostgreSQL и healthcheck.
2. Добавить scripts:
   - `db:up`;
   - `db:down`;
   - `db:migrate`;
   - `test:db`.
3. Добавить `packages/persistence` connection factory.
4. Добавить repositories для:
   - поиска пользователя по id;
   - чтения tenant по id;
   - чтения users внутри tenant;
   - записи audit event.
5. Добавить DB integration tests, которые через Docker Compose доказывают:
   - tenant A читает только своих users;
   - tenant B не попадает в выборку tenant A;
   - audit event сохраняется с обязательными trace-полями.
6. Подключить API server к Postgres runtime, если задан `DATABASE_URL`.

## Non-scope

- Production secrets management.
- Row-level security.
- Реальная authentication/session модель.
- UI для tenant/users.
- CRUD пользователей.
- Gantt, KPI, CRM, resource matrix.

## Acceptance criteria

- `docker compose up -d postgres` поднимает БД.
- `pnpm db:migrate` применяет migration.
- `pnpm test` проходит без Docker-зависимости.
- `pnpm test:db` проходит против Docker PostgreSQL.
- `pnpm typecheck` проходит.
- API server при `DATABASE_URL` стартует с Postgres-backed repositories.

## Следующий шаг после Phase 1.3

Phase 1.4 добавляет dev seed command и DB-backed API smoke для `/api/session/dev-users`, `/api/tenant/current`, `/api/tenant/:tenantId/users`.
