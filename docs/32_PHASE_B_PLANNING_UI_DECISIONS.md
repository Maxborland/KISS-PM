# 32. Phase B — решения по Planning UI

## Статус

Документ фиксирует инженерные решения Phase B (WBS spreadsheet + Gantt + realtime-ready state).
Источник продуктового parity: `31_PLANNING_WORKSPACE_UI_DESIGN.md`, раздел spreadsheet parity.

## Grid

- **TanStack Table v8** (`@tanstack/react-table`) — column defs, row model, selection API.
- **TanStack Virtual v3** (`@tanstack/react-virtual`) — row windowing для 500+ строк.
- Keyboard / selection / edit / clipboard / drag-fill — собственные hooks поверх headless API (не AG Grid).

## Server-authoritative state

- Источник истины: `useQuery(['plan', projectId])` → `GET .../planning/read-model`.
- Optimistic overlay только для **pending preview** (до Apply), снимается на success / cancel / 409.
- Каждая мутация: `clientPlanVersion` из текущего снимка + UUID `idempotencyKey` на apply.
- HTTP **409 `plan_version_conflict`** → `invalidateQueries` + Apply Bar `conflict` + banner «План обновлён другим пользователем».
- Phase C: `subscribeToPlanEvents(projectId, callback)` — контракт зафиксирован, реализация no-op; обработчик `planVersionChanged` вызывает тот же `invalidateQueries`.

## Зависимости (predecessor string)

| UI (RU) | Server (`DependencyType`) |
| --- | --- |
| ОН | FS |
| НН | SS |
| ОО | FF |
| НО | SF |

- Парсер (`@kiss-pm/planning-client`) принимает RU и EN коды, lag `+2д -1ч` / `+2d -1h`.
- Сериализатор для рендера — только русские чипы.
- Пакет: `packages/planning-client/src/predecessors/`.

## Длительность и работа

- Парсер: `5 дн`, `40 ч`, `5d`, `40h` → минуты через рабочий календарь проекта (day = `workingMinutesPerDay` из read-model).
- Commit ячейки «Длит» → `task.update_work_model` с пересчётом `durationMinutes` / `workMinutes` по текущему `taskType`.

## Column → PlanningCommand

| Колонка | Команда |
| --- | --- |
| Название | `task.update_identity` |
| Длит / Work | `task.update_work_model` |
| Старт / Финиш | `task.update_schedule` |
| Прогресс | `task.update_progress` (новая доменная команда Phase B) |
| Predecessors | `dependency.upsert` (batch) |
| Назначения | `assignment.upsert` / `assignment.delete` |
| WBS indent/outdent | `task.move_wbs` |
| Delete rows | `task.delete_or_archive` (batch) |

`task.update_progress` добавлена в `@kiss-pm/domain` (payload: `taskId`, `percentComplete` 0–100), т.к. отдельного поля в `update_work_model` / `update_status` нет.

## Undo

- **Pending preview:** локальный стек undo/redo команд preview (Ctrl+Z / Ctrl+Y) до Apply.
- **Applied:** compensating command только если домен поддерживает обратимость; Phase B UI маркирует Ctrl+Z после Apply как «откат несохранённых правок» для pending; applied undo — out of scope unless explicit compensating spec.

## Batch apply

- `POST .../planning/apply-command-batch` — атомарно: lock, planVersion, preview all, blocking → 409 + all `validationIssues`, иначе sequential apply, один `incrementPlanVersion`, один audit `planning.command_batch.applied`.

## Query layer

- TanStack Query v5: `usePlan`, `usePlanMutation` (preview + apply + applyBatch).
- `placeholderData: keepPreviousData` на read query.

## Permissions (UI)

- Маппинг tenant permissions → `usePlanningPermissions`: `tenant.project_plan.read/manage`, `tenant.project_baselines.manage`, `tenant.project_resources.read/manage`, `tenant.audit_events.read`.
- Cell editable = `column.editable && canManageProjectPlan && !previewPendingLock`.

## Realtime sentinel (Phase C)

```typescript
type PlanRealtimeEvent =
  | { type: "planVersionChanged"; projectId: string; planVersion: number }
  | { type: "planSnapshotInvalidated"; projectId: string; reason: string };
```

## Test hooks (E2E only)

- `POST .../planning/test/bump-plan-version` — только при `KISS_PM_E2E_TEST_HOOKS=1`, инкремент `planVersion` без изменения задач.

## Repository health (Phase B)

- `App.tsx` ≤ 200 строк (shell в `features/planning/`).
- `WbsGrid.tsx` ≤ 400 строк (subfiles: selection, keyboard, columns, renderers).
- Ban-list: видимая активная кнопка без handler/permission check; голый `<select>` в planning UI.
## Plan Forecast API decision

Plan Forecast routes are available as read-only Planning Workspace API contracts:

- `POST /api/workspace/projects/{projectId}/planning/forecast-runs`
- `GET /api/workspace/projects/{projectId}/planning/forecast-runs/{runId}`

The API response uses `health`, `managerSummary`, `riskDrivers`, `recommendations`, `expiresAt`, and `createdAt`. It must not expose `engineDebug` in the default manager response. Runtime UI remains blocked until a real panel design, permission mapping, action-link routing, loading/error states, and evidence captures are accepted.
