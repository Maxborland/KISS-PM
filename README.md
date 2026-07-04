# KISS PM

KISS PM — это русскоязычная продуктовая спецификация и будущая реализация SaaS/self-hosted платформы для управления проектами, ресурсной загрузкой и управленческим контролем.

Текущий репозиторий перезапущен в режиме **docs-first**: старый код считается непригодным для продолжения и не является основой новой реализации. История Git сохраняет прежние материалы, но рабочая версия развивается заново: сначала цельная документация, затем новая реализация по утвержденному фазовому плану.

## Что строим

KISS PM — не набор отчетов и не BitrixReports-клон. Это платформа, где CRM-вход, оценка емкости, проектный план, Gantt, задачи, ресурсная матрица, KPI, управленческие действия, аудит и ретроспективы образуют один рабочий контур.

Ключевая идея:

```txt
увидел сигнал -> понял причину -> выбрал разрешенное действие -> система проверила действие -> действие записано в аудит -> состояние пересчитано
```

## Что находится в репозитории сейчас

- `AGENTS.md` — правила работы для Codex/агентов.
- `docs/` — русскоязычный canonical baseline продукта.
- `docs/references/` — обязательные референсы: BR2-скриншоты и русские выжимки по MS Project scheduling.
- `apps/api` — первый Node/Hono API shell.
- `apps/web` — Next.js App Router web shell на React/TypeScript.
- `packages/domain` — минимальная tenant/user domain model.
- `packages/access-control` — минимальная проверка tenant access.
- `packages/persistence` — PostgreSQL/Drizzle schema, первая migration и audit event foundation.
- `packages/test-fixtures` — детерминированные фикстуры для Phase 1.
- Phase 2.2 runtime — single-workspace экран входа, пользователи, роли доступа, должности, профиль, тема и audit-backed CRUD через API.
- Web runtime: Next.js App Router. Authenticated workspace shell остается client-side UI поверх cookie-сессии `kiss_pm_session`; `/api/...` и `/health` в dev проксируются Next rewrites в отдельный Node/Hono backend `apps/api`.

## Команды старта

Репозиторий закрепляет `pnpm@10.33.2` через `packageManager`. Локально включите Corepack и запускайте install через `corepack pnpm ...` или активируйте эту версию `corepack prepare pnpm@10.33.2 --activate`; глобальный `pnpm` 11 для установки зависимостей не используется.

```bash
corepack pnpm install
corepack pnpm test
corepack pnpm typecheck
pnpm dev:api
pnpm dev:web
```

Чтобы держать PostgreSQL, API и web включенными через Docker Compose с live reload:

```bash
pnpm dev:compose
```

Для фонового запуска:

```bash
pnpm dev:compose:detached
```

После запуска web доступен на `http://127.0.0.1:3000`, API — на `http://127.0.0.1:4000`, PostgreSQL — на `127.0.0.1:55432`. Compose сам ставит зависимости в Linux-volume, применяет миграции и выполняет dev seed перед стартом API.

Для локального PostgreSQL слоя через Docker Compose:

```bash
pnpm db:up
pnpm db:generate
pnpm db:migrate
pnpm db:seed:dev
pnpm test:db
pnpm test:e2e:smoke
pnpm db:down
```

Playwright smoke поднимает отдельные web/API процессы на `127.0.0.1:3100` и `127.0.0.1:4100`, чтобы не переиспользовать живой Docker/dev runtime на `3000/4000`. Порты можно переопределить через `E2E_WEB_PORT` и `E2E_API_PORT`.

Локальный вход после seed: `admin@kiss-pm.local` / `admin12345`.

`DATABASE_URL` задается через окружение. Пример без секретов есть в `.env.example`.

## Как работать дальше

1. Сначала читать `AGENTS.md`.
2. Затем читать `docs/README.md` и документы по порядку.
3. Писать код только внутри утвержденной фазы и с тестами.
4. Любая реализация должна иметь E2E-доказательство для управленческих потоков.
5. В пользовательском языке продукт описывается по-русски. Кодовые идентификаторы в будущей реализации могут быть на английском.
