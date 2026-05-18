# 17. Phase 1.4: Dev seed and DB API smoke

## Статус

Phase 1.4 продолжает Docker Compose PostgreSQL runtime из Phase 1.3.

## Цель

Сделать повторяемый dev seed для локальной БД и доказать, что текущие API endpoints работают не только на in-memory fixtures, но и на Postgres-backed data source после миграции и seed.

## Выбранный подход

- `pnpm db:seed:dev` заполняет Docker PostgreSQL детерминированными demo tenants, access profiles и users.
- Seed идемпотентный: повторный запуск не создает дубликаты и обновляет demo labels/permissions.
- Быстрые unit/API тесты остаются без Docker.
- `pnpm test:db` проверяет seed и API smoke против Docker PostgreSQL.

## Закрытый backlog Phase 1.4

1. Добавить generic seed helper в `packages/persistence`.
2. Добавить dev seed script.
3. Добавить root script `db:seed:dev`.
4. Добавить DB tests:
   - seed создает demo tenants/users/access profiles;
   - seed можно запускать повторно;
   - API `/api/session/dev-users` читает seeded users из БД;
   - API `/api/tenant/current` читает tenant из БД;
   - API запрещает cross-tenant чтение users на Postgres data source.
5. Обновить docs и README команды.

## Non-scope

- Настоящая authentication/session модель.
- UI login.
- CRUD пользователей.
- Production seed.
- Tenant admin onboarding.

## Acceptance criteria

- `pnpm db:up` поднимает PostgreSQL.
- `pnpm db:migrate` применяет migration.
- `pnpm db:seed:dev` заполняет demo данные.
- `pnpm test` проходит без Docker-зависимости.
- `pnpm test:db` проходит против Docker PostgreSQL.
- API smoke against DB возвращает seeded users.

## Следующий шаг после Phase 1.4

Phase 1.5 добавляет минимальный browser/API E2E smoke для web shell + API health + DB-backed dev session. После него можно закрывать Phase 1 platform skeleton и переходить к Phase 2 tenant/users/access/config.
