# Runbook: E2E smoke

## Назначение

Проверка критических пользовательских сценариев (Playwright) и базовой a11y (axe) после изменений planning, dashboard, CRM shell.

## Предусловия

- Node 22+, pnpm 10.33.2 через Corepack (`corepack pnpm ...` или `corepack prepare pnpm@10.33.2 --activate`)
- PostgreSQL на `127.0.0.1:55432` (или `DATABASE_URL`)
- Опционально Redis на `6379` для smoke realtime (`REDIS_URL`)

## Быстрый запуск

```powershell
.\scripts\run-e2e.ps1
```

```bash
./scripts/run-e2e.sh
```

Или вручную:

```bash
pnpm db:up
pnpm db:migrate
pnpm db:seed:dev
pnpm test:e2e:smoke
```

Playwright поднимает API (`E2E_API_PORT`, default 4100) и web (`E2E_WEB_PORT`, default 3100), ждёт `GET /health`.

## Типичные сбои

| Симптом | Причина | Действие |
|---------|---------|----------|
| `ECONNREFUSED` 55432 | Postgres не запущен | `pnpm db:up` |
| Login failed | Seed не применён | `pnpm db:seed:dev` |
| Port busy | Старый dev-сервер | Сменить `E2E_API_PORT` / `E2E_WEB_PORT` |
| axe critical на CRM | Регрессия модалки/формы | `e2e/a11y/crm.spec.ts` |

## A11y

Спеки в `e2e/a11y/` (workspace-shell, crm, settings) подхватываются `playwright.config.ts` (`testDir: ./e2e`).

## Realtime smoke (опционально)

```bash
REDIS_URL=redis://localhost:6379 PLANNING_EVENTS_BACKEND=redis pnpm test:db -- planningRedisEventBus.smoke.test.ts
```
