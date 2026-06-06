# 18. Phase 1.5: Browser/API E2E smoke

## Статус

Phase 1.5 закрывает Phase 1 platform skeleton перед переходом к Phase 2.

## Цель

Доказать минимальный пользовательский контур запуска: Docker PostgreSQL поднят, migration и dev seed применены, API читает seeded tenants/users из БД, web shell открывается в браузере и показывает DB-backed статус.

## Выбранный подход

- Playwright используется для browser smoke.
- Next.js dev server проксирует `/api` и `/health` в API server через rewrites.
- API server запускается с `DATABASE_URL`, поэтому читает PostgreSQL data source.
- Web shell работает как Next.js App Router приложение, но authenticated workspace UI остается client-side shell поверх cookie-сессии.
- Web shell остается простым, но показывает:
  - статус API;
  - список dev users из seeded PostgreSQL;
  - предупреждение, если API недоступен.

## Закрытый backlog Phase 1.5

1. Добавить Playwright config и `pnpm test:e2e:smoke`.
2. Добавить E2E smoke:
   - страница открывается;
   - виден заголовок KISS PM;
   - API status отображается как `ok`;
   - seeded users `Анна Администратор` и `Борис Администратор` видны в UI;
   - прямой API-запрос через Playwright получает 200 и seeded users.
3. Обновить web shell, чтобы он читал `/health` и `/api/session/dev-users`.
4. Обновить docs/README команды.

## Non-scope

- Настоящий login.
- UI routing.
- Tenant admin UI.
- CRUD users/access profiles.
- Phase 2 tenant configuration.

## Acceptance criteria

- `pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed:dev` подготавливают runtime.
- `pnpm test:e2e:smoke` проходит против Docker PostgreSQL.
- `pnpm test`, `pnpm test:db`, `pnpm typecheck` проходят.
- Browser smoke не требует ручных кликов.
- Playwright запускает отдельные процессы `apps/api` и `apps/web` на изолированных smoke-портах, чтобы не переиспользовать живой dev/Docker runtime: web по умолчанию `http://127.0.0.1:3100`, API health — `http://127.0.0.1:4100/health`. Порты можно переопределить через `E2E_WEB_PORT` и `E2E_API_PORT`.

## Следующий шаг после Phase 1.5

Закрыть Phase 1 platform skeleton и начать Phase 2: tenant/users/access/config, где появятся реальные screens для управления tenant, пользователями, профилями доступа, labels и custom fields.
