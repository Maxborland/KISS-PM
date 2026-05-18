# Phase 1.5: Browser/API E2E smoke plan

## Цель

Добавить первый настоящий browser smoke, который доказывает, что web, API и Docker PostgreSQL связаны в один минимальный runtime.

## Архитектура

API остается Hono server. Web остается React/Vite shell, но получает маленький API client. Playwright запускает API и web как webServer-процессы, перед этим разработчик выполняет `db:up`, `db:migrate`, `db:seed:dev`.

## План работ

1. Добавить phase doc и этот plan.
2. Добавить Playwright dependency/config и script `test:e2e:smoke`.
3. RED: написать `e2e/smoke/phase1-db-shell.spec.ts`.
4. Обновить `apps/web/vite.config.ts` proxy на `127.0.0.1:4173`.
5. Добавить `apps/web/src/api.ts`.
6. Обновить `apps/web/src/App.tsx` и `styles.css` под API status/users.
7. Запустить:
   - `pnpm db:migrate`;
   - `pnpm db:seed:dev`;
   - `pnpm test`;
   - `pnpm test:db`;
   - `pnpm typecheck`;
   - `pnpm test:e2e:smoke`;
   - markdown link check.

## Границы

В 1.5 не добавляем auth/session UI. Dev users остаются диагностическим списком, который нужен только чтобы доказать, что runtime связан end-to-end.
