# Phase 3 ledger: CRM intake, ресурсная проверка, активный проект

## Scope

- Ручное создание opportunity в single-workspace shell.
- Расчет `plannedHours = floor(contractValue / plannedHourlyRate)`.
- Demand строками `должность + часы`.
- Feasibility по доступным часам должностей между плановым стартом и финишем.
- Активация opportunity в `active` project через permission-checked command.
- Audit для `opportunity.created`, `opportunity.feasibility_checked`, `project.activated`.
- Restricted user: скрытые разделы и API `403`.

## Decisions

- `ProjectDraft` не вводится как отдельная runtime сущность. В Phase 3 проект становится активным проектом из opportunity.
- Внешние CRM/intake-коннекторы остаются TODO backlog и не становятся core dependency.
- `hoursPerDay = 8` для Phase 3.
- Активные пользователи с должностью дают capacity; активные проекты создают reservations по пересечению дат.
- Activation single-use: одна opportunity может породить только один active project.
- Activation пересчитывает текущую capacity перед созданием проекта; stale feasibility не считается достаточным доказательством.
- Финальный activation recheck выполняется внутри транзакции под tenant resource lock.
- Phase 3 API ограничивает длину строк, planning horizon, demand rows и integer ranges.
- Authenticated `/api/*` responses получают `Cache-Control: no-store, private`.
- Denied Phase 3 mutation attempts пишутся в audit как `*_denied` с `executionResult.status = denied`.

## Red / Green evidence

| Блок | RED | GREEN |
| --- | --- | --- |
| Domain feasibility | `pnpm vitest run packages/domain/src/projectIntake.test.ts` падал на missing module | `pnpm vitest run packages/domain/src/projectIntake.test.ts` прошел, 4 tests |
| Access permissions | `pnpm vitest run packages/access-control/src/policy.test.ts` падал на missing function | `pnpm vitest run packages/access-control/src/policy.test.ts` прошел, 9 tests |
| Persistence migration | `pnpm vitest run packages/persistence/src/migration.test.ts` падал на missing `0005` | `pnpm vitest run packages/persistence/src/migration.test.ts` прошел, 6 tests |
| Persistence repository | targeted DB test падал на missing table before migration | `pnpm db:migrate` применил `0005`; targeted DB test прошел |
| API routes | targeted DB test ожидал 201/403, получал 404 before routes | targeted DB test прошел: opportunity create, feasibility, activation, audit, restricted 403 |
| Web foundation | web tests падали на missing routes/query keys/form validation | `pnpm vitest run apps/web/src` прошел, 48 tests |
| Review hardening | parser/migration/repository/API tests падали на JS date rollover, missing `0006`, duplicate project и повторный feasibility | parser/migration tests прошли, targeted repository/API DB tests прошли после strict date, unique source index, single-use transition и activation recheck |
| Security hardening | parser/API DB tests падали на oversized input и missing cache-control; security review выявил concurrent capacity risk | targeted parser/API DB tests прошли после input bounds, tenant resource lock, transactional recheck и cache-control |
| Denied audit | DB test ожидал `*_denied` audit events для restricted Phase 3 mutations и получал пустой audit | targeted API DB test прошел после `opportunity.create_denied`, `opportunity.feasibility_denied`, `project.activation_denied` |

## Review cycle

- Bug Hunt: выявлены stale feasibility, duplicate activation, concurrent capacity race, oversized input, missing cache-control и missing denied audit; все Critical/Important исправлены.
- Code Review: финальный read-only review не нашел Critical/Important; minor doc drift по audit action редактирования opportunity исправлен удалением неподдержанного action из Phase 3 документа.
- Security Review: финальный read-only security review не нашел Critical/Important.

## Fresh verification

- `pnpm typecheck`: passed, exit 0.
- `pnpm --filter @kiss-pm/web typecheck`: passed, exit 0.
- `pnpm --filter @kiss-pm/web build`: passed, exit 0.
- `pnpm test`: passed, exit 0, 110 tests.
- `pnpm test:db`: passed, exit 0, 27 tests.
- `pnpm test:e2e:smoke`: passed, exit 0, 1 Chromium smoke.
- `git diff --check`: passed, exit 0; warnings only about future CRLF normalization in `apps/api/src/app.db.test.ts` and `apps/web/src/WorkspaceShell.tsx`.
- `docker compose ps`: `postgres` healthy on `55432`, `web` published on `3000`, `api` running in compose.

## Smoke proof points

- Admin видит `Возможности` и `Проекты`.
- Admin создает opportunity вручную.
- Карточка opportunity считает `960000 / 6000 = 160` плановых часов.
- Demand задан двумя строками: `Руководитель проекта: 80 ч`, `Инженер: 80 ч`.
- Feasibility показывает достаточный ресурс и доступные/требуемые часы.
- Admin активирует проект.
- Проект появляется в разделе `Проекты`.
- Audit показывает `Возможность создана`, `Ресурсная проверка сделки выполнена`, `Проект активирован`.
- Restricted user не видит `Возможности`/`Проекты`, deep-link возвращает на dashboard, API endpoints Phase 3 отвечают `403`.
- Restricted mutation attempts пишутся в audit как denied action events.

## Remaining follow-up after Phase 3

- Полная дневная resource matrix переносится в следующую фазу ресурсного планирования.
- Gantt/WBS/tasks не входят в Phase 3 и должны строиться поверх активного проекта.
- Intake connectors остаются отдельным integration slice.
