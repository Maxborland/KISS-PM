# 03. Архитектура SaaS/self-hosted

## Статус

Этот документ задает целевую архитектуру новой реализации. Старый код не используется как foundation.

## Целевой стек

- Frontend: React, TypeScript, Vite или Next.js после отдельного решения.
- UI: shadcn/ui + Tailwind CSS как стартовый вариант, если не принято другое решение.
- Server state: TanStack Query.
- Backend: TypeScript, Hono/Bun или Node runtime после технического spike.
- Database: PostgreSQL.
- ORM/schema/migrations: Drizzle как стартовое решение Phase 1.2.
- Validation: Zod или аналогичная runtime validation.
- Tests: unit для engines, integration для API, E2E для управленческих потоков.

## Архитектурные слои

1. Domain engines: чистая логика без UI, сети и базы.
2. Application services: use cases, permission checks, action commands.
3. Persistence: repositories, migrations, transactions, projections.
4. API: validation, auth, route handlers, DTO.
5. UI: pages, widgets, forms, state/query bindings.
6. E2E: доказательство пользовательских контуров.

## Будущая структура

```txt
apps/
  web/
  api/
packages/
  domain/
  access-control/
  tenant-config/
  crm-intake/
  project-core/
  scheduling-engine/
  resource-planning/
  kpi-engine/
  control-surfaces/
  action-engine/
  audit/
  integrations/
```

Эта структура создается только после утверждения phase-detail плана. До этого репозиторий остается docs-first.

## SaaS/self-hosted требования

- Tenant isolation на уровне данных, API, поисков, projections и E2E.
- Конфигурация tenant хранится в БД и версионируется там, где влияет на расчеты.
- Self-hosted deployment не должен требовать внешних SaaS-сервисов для базовой работы.
- Интеграции отключаемы: проект не ломается без Bitrix24, AmoCRM, MS Project или Slack.
- Все внешние payload считаются недоверенными.

## Что нельзя делать

- Нельзя класть KPI formulas в React.
- Нельзя проверять права только в UI.
- Нельзя делать tenant-specific if в domain code.
- Нельзя давать control surface прямую запись в таблицы проекта.
- Нельзя начинать реализацию с красивого dashboard без action/audit модели.

## Открытые решения

- Финальный runtime backend: Bun/Hono или Node/Hono.
- Auth/session модель для SaaS и self-hosted.
- Первый CRM-адаптер.
- Billing/licensing модель.
- Граница MS Project parity для первой коммерческой версии.
