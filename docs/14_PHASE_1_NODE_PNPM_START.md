# 14. Phase 1: Node + pnpm старт реализации

## Статус

Phase 1 начинается после docs-first reset. Старый код не используется.

## Цель фазы

Создать новый минимальный monorepo на Node + pnpm, заложить API shell, web shell, domain package, access-control package и первый проверяемый tenant/access vertical slice.

## Выбранный стек для старта

- Runtime: Node.js.
- Package manager: pnpm.
- API: Hono.
- Web: React + Next.js App Router + TypeScript.
- Tests: Vitest.
- Database: PostgreSQL в целевой архитектуре, но не в первом skeleton-шаге.

## Почему без PostgreSQL в первом шаге

Первый шаг должен проверить границы модулей и tenant/access invariant без смешивания с миграциями и ORM-выбором. PostgreSQL и migrations идут следующим шагом Phase 1.2.

## Закрытый backlog Phase 1.1

1. Создать pnpm workspace.
2. Создать `apps/api`, `apps/web`, `packages/domain`, `packages/access-control`, `packages/test-fixtures`.
3. Добавить TypeScript/Vitest конфигурацию.
4. Реализовать минимальную tenant/user domain model.
5. Реализовать минимальный access-control evaluator.
6. Реализовать API endpoints:
   - `GET /health`
   - `GET /api/session/dev-users`
   - `GET /api/session/dev-login?userId=...`
   - `GET /api/tenant/current`
   - `GET /api/tenant/:tenantId/users`
7. Доказать tenant isolation:
   - пользователь tenant A видит свой tenant;
   - пользователь tenant A не может читать users tenant B.
8. Создать минимальный web shell, который показывает русскую стартовую страницу KISS PM. Текущий runtime web после миграции — Next.js App Router, а не предыдущий отдельный dev server.

## Non-scope

- Real auth/session.
- PostgreSQL, migrations, ORM.
- Gantt.
- CRM intake.
- KPI.
- Resource matrix.
- Control surface builder.

## Acceptance criteria

- `pnpm test` проходит.
- `pnpm typecheck` проходит.
- API integration tests доказывают tenant isolation.
- Root scripts работают через pnpm workspace.
- Документы остаются русскоязычными.

## Следующее решение после Phase 1.1

Решение принято в Phase 1.2: стартовый PostgreSQL слой строится на Drizzle, SQL migrations и отдельном `packages/persistence`.
