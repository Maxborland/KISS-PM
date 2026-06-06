# План исправления UI/UX KISS PM (2026)

## Статус

Документ фиксирует полный аудит пользовательских поверхностей и дорожную карту исправлений.
Дополняет Phase C follow-up (Gantt parity, matrix SSOT, routes split, SSE ADR).

Источники истины: [10_UX_UI_РЕФЕРЕНСЫ.md](../10_UX_UI_РЕФЕРЕНСЫ.md), [27_UX_UI_DESIGN_SYSTEM.md](../27_UX_UI_DESIGN_SYSTEM.md), [31_PLANNING_WORKSPACE_UI_DESIGN.md](../31_PLANNING_WORKSPACE_UI_DESIGN.md).

## Сводка проблем

| Severity | Тема |
|----------|------|
| P0 | Фейковые вкладки Task Inspector; нет indent/outdent; Gantt read-only; неверный mobile-copy; SSE multi-instance |
| P1 | 8+ reference surfaces из docs/10 не реализованы; слабый axe-охват; неполный Inspector |
| P2 | Dark theme; portfolio Gantt; KPI/control surfaces; design-system consolidation |

## Фазы

### UX-0 — Честность интерфейса

- Task Inspector: только реальные вкладки или скрытые до реализации
- `NarrowFallback`: copy без несуществующего «Обзора»
- Убрать внутренний жаргон («Phase N») с пользовательских экранов
- Матрица «экран → affordance» (этот документ + чеклист в PR)

### UX-1 — Planning parity (docs/31)

- **1A** WBS: `task.move_wbs`, меню, `Ctrl+]` / `Ctrl+[`
- **1B** Gantt: drag move/resize баров, drag-create FS
- **1C** Task Inspector: work model, dependencies, assignments, advanced
- **1D** Scenarios compare, resource drilldown, stale preview indicator

### UX-2 — Продуктовые surfaces (docs/10)

- Role dashboard, portfolio Gantt, CRM wizard, closed projects retrospective
- CRM activity feed (замена placeholder)
- Free capacity heatmap, notifications/help

### UX-3 — Realtime scale

- Redis/NATS `PlanningEventPublisher` ([planning-realtime-sse.md](../decisions/planning-realtime-sse.md))
- UI: reconnect / «план обновлён»

### UX-4 — Accessibility

- axe на shell, CRM, settings, my-work (не только planning critical)
- Dark theme parity для planning + CRM

### UX-5 — Design system

- shadcn Dialog вместо legacy Modal где интерактивно
- Shared DataTable, token audit

## Включено из «не в scope» Phase C follow-up

| Пункт | Фаза |
|-------|------|
| Drag-edit баров Gantt | UX-1B |
| Indent/outdent WBS | UX-1A |
| Redis SSE | UX-3 |
| Полный e2e axe | UX-4 |

## Матрица reference surfaces (docs/10)

| # | Surface | Статус | Фаза |
|---|---------|--------|------|
| 1 | Portfolio Gantt | нет | UX-2 |
| 2 | CRM → project wizard | частично | UX-2 |
| 3 | Project Gantt/WBS | базово | UX-1 |
| 4 | Project settings | частично | UX-2 |
| 5 | Role dashboard | нет | UX-2 |
| 6 | My Tasks / Kanban | есть | polish |
| 7 | Guided task creation | есть | — |
| 8 | Resource matrix | есть | UX-1D |
| 9 | Resource drilldown | частично | UX-1D |
| 10 | Availability editor | есть | — |
| 11 | Free capacity heatmap | нет | UX-2 |
| 12 | Active projects grid | есть | UX-2 signals |
| 13 | Closed retrospective | нет | UX-2 |
| 14 | Profile/help/notifications | частично | UX-2 |

## Verification gate

```bash
pnpm typecheck
pnpm test
pnpm test:db -- apps/api/src/planningRoutes.db.test.ts
pnpm --filter @kiss-pm/web build
pnpm test:e2e:smoke  # при изменении e2e
```

## Журнал выполнения

| Дата | Фаза | Сделано |
|------|------|---------|
| 2026-05-23 | UX-0, UX-1A (старт) | Документ; Inspector tabs (general/deps/resources); NarrowFallback; dashboard copy; indent/outdent (menu + Ctrl+[ ]) |
| 2026-05-23 | UX-0…UX-5 | [ux-ui-truth-matrix.md](./ux-ui-truth-matrix.md); Gantt drag+FS; Inspector work/deps add; stale preview; Redis publisher; Remote banner; Role dashboard; Portfolio strip; closed retrospective; heatmap MVP; axe e2e (shell/CRM/settings/planning); help panel |
| 2026-05-23 | UX-6 closeout | Employee-day SSOT в domain; Capacity API tree/summary; матрица ресурсов и дашборд на live API; Redis retry + `/api/health/realtime`; Modal→Radix Dialog; ADR [employee-capacity](../decisions/employee-capacity-source-of-truth.md), [capacity-summary-api](../decisions/capacity-summary-api.md); runbook [e2e-smoke](../runbooks/e2e-smoke.md) |

### UX-6 closeout (решения и риски)

- **SSOT:** `packages/domain/src/planning/employeeCapacity.ts`; перегруз считается по сумме минут сотрудника за день по всем проектам.
- **API:** `apps/api/src/capacity/*`; кеш 60s; инвалидация при смене версии плана.
- **Realtime:** production — Redis (`PLANNING_EVENTS_BACKEND=redis`, `REDIS_URL`); dev fallback in-memory с `console.warn`.
- **Риск:** сборка дерева через plan snapshots всех активных проектов — при росте tenant возможен perf slice (materialized view / SQL read model).

См. также матрицу affordances: [ux-ui-truth-matrix.md](./ux-ui-truth-matrix.md).
