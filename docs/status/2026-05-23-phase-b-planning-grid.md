# Phase B — Planning Grid (2026-05-23)

## Status

**Завершено** — WBS spreadsheet + Gantt + Task Inspector + server-authoritative query layer + batch apply API.

## Changed

- `docs/32_PHASE_B_PLANNING_UI_DECISIONS.md` — инженерные решения Phase B.
- `packages/domain` — команда `task.update_progress`.
- `packages/planning-client` — API wrapper, парсеры predecessor/duration, unit-тесты.
- `apps/api/src/planningRoutes.ts` — `apply-command-batch`, E2E test hook `bump-plan-version`.
- `apps/web/src/features/planning/` — shell, grid, gantt, inspector, hooks, CSS.
- `e2e/planning/` — smoke сценарии workspace и conflict.
- `apps/web/src/features/planning/planning.health.test.ts` — line budgets.

## Files (ключевые)

| Область | Путь |
| --- | --- |
| Decisions | `docs/32_PHASE_B_PLANNING_UI_DECISIONS.md` |
| Batch API | `apps/api/src/planningRoutes.ts` |
| Client | `packages/planning-client/src/` |
| UI | `apps/web/src/features/planning/` |
| Route | `apps/web/src/app/projects/[projectId]/schedule/page.tsx` |
| E2E | `e2e/planning/` |

## Tests / verification

| Команда | Назначение |
| --- | --- |
| `pnpm --filter @kiss-pm/planning-client test` | парсеры predecessor/duration |
| `pnpm test` | domain + api parsers + web health |
| `pnpm test:db` | planning routes incl. batch |
| `pnpm test:e2e:smoke` | incl. `e2e/planning/` |

## Decisions / assumptions

- Прогресс задачи — `task.update_progress`, не через work_model.
- Batch apply — один audit `planning.command_batch.applied`.
- Phase C вкладки (Ресурсы, Сценарии, Baseline, Аудит проекта, Настройки) остаются disabled с tooltip.

## Phase C scope (перенос)

- Вкладки Project Shell: Ресурсы, Назначения, Календари, Сценарии, Baseline, Аудит, Настройки.
- `subscribeToPlanEvents` → SSE/WebSocket + auto-invalidate.
- Context menu shadcn registry (полный Radix), drag-fill series, Excel paste 10×6 E2E parity.
- Compensating undo для applied commands.

## Risks / follow-up

- E2E conflict-тест требует `KISS_PM_E2E_TEST_HOOKS=1` на API (включено в `playwright.config.ts`).
- Seed должен содержать активный проект с plan read-model для стабильного open schedule.
