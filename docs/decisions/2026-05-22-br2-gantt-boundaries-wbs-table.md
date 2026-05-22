# 2026-05-22. BR2 Gantt boundaries and WBS table decision

## Статус

Accepted for Phase 7 planning workspace preparation.

## Контекст

BR2 Gantt был задуман как отдельный пакет, но фактически остался внутри
`E:\BitrixReports2.0`. Ревизия показала, что BR2 уже содержит package split:

- `packages/gantt-core`;
- `packages/gantt-react`;
- `packages/gantt-bitrix-preset`.

Есть отдельные scripts для standalone export и проверки package shape:

- `scripts/export-gantt-standalone-repo.mjs`;
- `scripts/verify-gantt-standalone-export.mjs`;
- `scripts/verify-gantt-packages-frozen.mjs`;
- `docs/dev/gantt-local-monorepo.md`.

Это подтверждает, что Gantt можно брать из BR2 как implementation asset, а не
только как screenshot reference.

## Решение

KISS PM переносит BR2 Gantt не как готовую бизнес-фичу, а как исходный UI
asset для Phase 7.

Целевой package split:

```txt
packages/planning-gantt-ui
  -> timeline renderer
  -> bars / milestones / summary bars
  -> dependency arrows
  -> timeline header / zoom / scroll sync
  -> drag/resize/dependency gestures as command intents

apps/web/src/planning
  -> KISS PM planning workspace route
  -> read model query
  -> command preview/apply adapters
  -> WBS grid adapter
  -> resource sheet / matrix / scenario UI
```

`packages/planning-gantt-ui` не должен зависеть от Hono, persistence, API route
contracts, Bitrix endpoints, tenant roles, audit или KISS PM domain package.
Он получает normalized view model и возвращает UI intents.

KISS PM backend planning engine остается единственным source of truth для:

- dates;
- dependencies;
- critical path;
- validation issues;
- resource load;
- overloads;
- baseline comparison;
- scenario proposals;
- apply result.

## Что переносим из BR2 Gantt

Переносим и адаптируем:

- `GanttTimeline`;
- `GanttTimelineHeader`;
- `GanttBar`;
- `GanttDependencyArrows`;
- `GanttLegend`;
- `SplitView`;
- controlled scroll sync и row height model;
- drag/resize/dependency interaction model, но только как генерацию command
  intent;
- feature flags/capabilities pattern;
- tests вокруг bars, arrows, timeline, toolbar и grid behavior.

Можно использовать идеи из:

- `packages/gantt-react/src/components`;
- `packages/gantt-react/src/theme/defaultTheme.ts`;
- `packages/gantt-core/src/types.ts` как migration reference.

## Что не переносим как authority

Не переносим в KISS PM как authoritative logic:

- BR2 `scheduling/*`: scheduler, CPM, constraints, leveling, resource conflicts;
- BR2 `planning/*`: scenario/risk/compare logic;
- BR2 role model: `gap`, `rkg`, `rpg`, `rm`, `kd`, `roks` и другие;
- BR2 command endpoints из `gantt-bitrix-preset`;
- BR2 persistence/transport expectations;
- Ant Design dependency как обязательную часть planning workspace.

Если часть BR2 local preview нужна для UX responsiveness, она должна быть
понижена до preview-only helper и всегда reconciled через KISS PM
`preview-command` / `apply-command`.

## Обязательная адаптерная граница

Нужен явный adapter:

```txt
PlanningReadModel
  -> PlanningGanttViewModel
  -> Gantt UI
  -> PlanningUiIntent
  -> PlanningCommand preview/apply
  -> PlanningReadModel reload
```

Пример intent mapping:

| UI intent | Backend command |
|---|---|
| `move-task-bar` | `task.update_schedule` |
| `resize-task-bar` | `task.update_schedule` + maybe `task.update_work_model` |
| `draw-dependency` | `dependency.upsert` |
| `delete-dependency` | `dependency.delete` |
| `move-wbs-row` | `task.move_wbs` |
| `edit-assignment-cell` | `assignment.upsert` |
| `capture-baseline` | `baseline.capture` |

## WBS table decision

BR2 WBS table is not a separate proprietary table engine. In
`packages/gantt-react/src/components/TaskGrid.tsx` it already uses:

- `@tanstack/react-table`;
- `@tanstack/react-virtual`;
- `@dnd-kit/core`.

Therefore the recommended KISS PM direction is:

```txt
TanStack Table + TanStack Virtual + dnd-kit + KISS PM/Radix/shadcn editors
```

This keeps the WBS table controlled, replaceable and visually native to KISS PM.

BR2 `TaskGrid` can be used as a migration reference, but should not be copied
unchanged because it contains:

- BR2 store shape;
- BR2 role permission model;
- context menu behavior tied to old operations;
- lock/collaboration assumptions;
- Ant Design editor dependencies;
- local WBS computation that must be reconciled with backend WBS/order rules.

## WBS candidates

| Candidate | Fit | Strengths | Risks | Decision |
|---|---|---|---|---|
| TanStack Table + TanStack Virtual | High | Headless, MIT, controlled state, column sizing/pinning APIs, virtualization through TanStack Virtual, already used by BR2 TaskGrid | Requires custom UI/editors/tree behavior | Recommended |
| BR2 TaskGrid as-is | Medium | Already implements rows, resizing, virtualization, DnD, context menu | Carries BR2 store/permissions/AntD/collaboration assumptions | Use only as reference or temporary extraction source |
| Glide Data Grid | Medium | Very high performance, canvas grid, MIT, millions-of-rows positioning | Canvas cells make rich React editors, tree WBS and Gantt row sync harder | Keep as fallback for future very large flat resource matrix, not WBS v1 |
| AG Grid Community | Medium/Low | Mature grid, MIT Community, strong built-in grid behavior | Tree data is Enterprise; heavier vendor model; harder to keep package headless/native | Do not use for WBS v1 |
| MUI X Data Grid Community | Low | MIT Community, polished basic grid | Tree data and row reordering require Pro; MUI visual system conflicts with current KISS PM shadcn/Radix baseline | Do not use for WBS v1 |

## Architecture findings

### F1. BR2 `gantt-core` contains duplicate planning authority

Severity: Required

Area: Domain model / Module boundary

Evidence:

- `packages/gantt-core/src/scheduling/*`;
- `packages/gantt-core/src/planning/*`;
- KISS PM already has Phase 5/6 backend planning engine.

Risk:

- If KISS PM imports BR2 `gantt-core` as-is, UI preview and backend read model
  can diverge on calendars, constraints, resource load, critical path and
  scenario proposals.

Required improvement:

- Extract or wrap only UI-safe parts. Any scheduling helper must be marked
  preview-only and reconciled against KISS PM backend preview/apply.

Acceptance criteria:

- No Phase 7 frontend path applies schedule/resource changes without
  `PlanningCommand` preview/apply and read-model reload.

### F2. BR2 preset must not leak into KISS PM

Severity: Required

Area: API / Permissions / Coupling

Evidence:

- `packages/gantt-bitrix-preset/src/commandAdapter.ts` exposes old
  `/projects/:groupId/...` endpoints.
- `packages/gantt-core/src/types.ts` contains BR2 role names and permission
  shape.

Risk:

- KISS PM planning UI would inherit Bitrix-specific route semantics and role
  vocabulary, making Phase 5/6 permission model harder to enforce.

Required improvement:

- Implement `planningGanttAdapter` for KISS PM and keep BR2 preset out of the
  KISS PM package surface.

Acceptance criteria:

- Public KISS PM UI imports no `gantt-bitrix-preset` and maps permissions only
  from Phase 5/6 permission keys.

### F3. WBS table should be replaceable

Severity: Recommended

Area: UI / Module boundary / Performance

Evidence:

- BR2 TaskGrid is already a custom TanStack composition, not a locked widget.
- KISS PM needs dense WBS, pinned columns, virtualization, keyboard navigation,
  inline preview and Gantt scroll sync.

Risk:

- Copying TaskGrid as a black box would make future table improvements harder
  and pull old interaction assumptions into KISS PM.

Required improvement:

- Define WBS table as adapter/component boundary, with TanStack as the default
  implementation.

Acceptance criteria:

- `WbsGrid` receives rows/columns/intents from KISS PM planning workspace and
  can be replaced without changing Gantt timeline or backend command adapters.

## Implementation notes

1. Copy BR2 packages into KISS PM only after a file-level extraction plan.
2. Rename package namespace from `@gungantt/*` to `@kiss-pm/planning-gantt-ui`
   or equivalent.
3. Remove or quarantine `gantt-core/scheduling`, `gantt-core/planning` and
   `gantt-bitrix-preset` from the first KISS PM UI import path.
4. Replace Ant Design editors with KISS PM/Radix/shadcn controls.
5. Add a snapshot/parity fixture that maps one KISS PM `planning/read-model`
   into `PlanningGanttViewModel`.
6. Add browser smoke for row sync: WBS row, Gantt bar and validation marker
   must refer to the same task id after filtering, collapse and scroll.

## Reviewed sources

- Local BR2 repo: `E:\BitrixReports2.0`.
- BR2 package design: `docs/plans/2026-03-19-standalone-gantt-package-design.md`.
- BR2 local monorepo note: `docs/dev/gantt-local-monorepo.md`.
- TanStack Table docs: `https://tanstack.com/table/latest/docs/guide/column-pinning`.
- TanStack Virtual docs: `https://tanstack.com/virtual/latest/docs`.
- AG Grid row dragging docs: `https://www.ag-grid.com/react-data-grid/row-dragging/`.
- AG Grid Community license: `https://www.ag-grid.com/eula/AG-Grid-Community-License.html`.
- MUI X tree data docs: `https://mui.com/x/react-data-grid/tree-data/`.
- MUI X licensing: `https://mui.com/x/introduction/licensing/`.
- Glide Data Grid GitHub/docs: `https://github.com/glideapps/glide-data-grid`.
