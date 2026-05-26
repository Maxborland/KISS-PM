# Design v3 — Planning Mutation Spec

Поведенческая спецификация state-machine планирования, извлечённая из текущей
реализации `apps/web/src/features/dv2/planning/hooks/*` (на ветке
`feature/planning-ui-design-2026-05-23`). Это input для **Phase 9b** —
переписывания data layer с нуля по TDD.

> Цель: сохранить существующий контракт (server protocol, conflict-handling,
> idempotency, undo/redo, SSE), переписать клиентскую state-machine чище и с
> покрытием unit-тестами на каждый transition.

## 1. Источники-референсы

| Файл | Что содержит |
|---|---|
| `apps/web/src/features/dv2/planning/hooks/usePlanMutation.ts` | Главный hook: preview/apply/undo/redo + integration с TanStack Query |
| `apps/web/src/features/dv2/planning/hooks/planMutationState.ts` | Типы `ApplyBarState`, `PendingPreview`, `PlanMutationStore` |
| `apps/web/src/features/dv2/planning/hooks/useCompensatingUndo.ts` | Стек applied undo/redo через `buildCompensatingCommands` |
| `apps/web/src/features/dv2/planning/hooks/usePlan.ts` | Read-hook + SSE подписка + invalidation |
| `apps/web/src/features/dv2/planning/hooks/subscribeToPlanEvents.ts` | Тонкая обёртка над `@kiss-pm/planning-client` SSE |
| `apps/web/src/features/dv2/planning/hooks/planKeys.ts` | `["plan", projectId]` query keys |
| `packages/planning-client/src/api/planningApiClient.ts` | API-клиент: getPlanReadModel / previewCommand / applyCommand / applyCommandBatch |
| `packages/planning-client/src/api/types.ts` | `PlanningReadModel`, `PlanningPreviewResponse`, `PlanningApplyResponse` |
| `packages/planning-client/src/realtime/planRealtimeEvents.ts` | `PlanRealtimeEvent` union |
| `packages/planning-client/src/undo/buildCompensatingCommands.ts` | Построение compensating-команд для undo |

## 2. Состояния (states)

`ApplyBarState` enum — единственный источник истины для UI-баннера:

```ts
type ApplyBarState =
  | "idle"              // нет ожидающего превью, можно начать
  | "preview-pending"   // запрос preview-command летит на сервер
  | "preview-ready"     // preview получен, оверлей применён, ждём apply/cancel
  | "applying"          // запрос apply-command (или batch) летит
  | "applied"           // apply успешен, держим 3000ms потом → idle
  | "error"             // последняя операция упала, errorMessage не пуст
  | "conflict";         // server вернул plan_version_conflict, плана инвалидирован
```

## 3. Stored state (PlanMutationStore)

```ts
type PendingPreview = {
  command: PlanningCommand;
  preview: PlanningPreviewResponse;       // { before, after, planDelta, validationIssues }
  overlayReadModel: PlanningReadModel;    // = preview.after; основа overlay-рендера
  basePlanVersion: number;                // версия плана на момент превью (для stale-detection)
};

type PlanMutationStore = {
  applyBarState: ApplyBarState;
  pendingPreview: PendingPreview | null;
  undoStack: PendingPreview[];           // стек pending-превью (внутри текущей сессии превью)
  redoStack: PendingPreview[];
  errorMessage: string | null;
  previewStale: boolean;                  // server planVersion стал > basePlanVersion
};
```

`undoStack` и `redoStack` — **только для pending-preview**, _не_ для applied. Applied undo/redo живёт в `useCompensatingUndo` отдельным стеком.

## 4. Transitions (state diagram)

```mermaid
stateDiagram-v2
    [*] --> idle
    idle --> preview-pending : preview(command)
    preview-pending --> preview-ready : preview success (generation match)
    preview-pending --> error : preview failure (non-conflict)
    preview-pending --> conflict : preview failure (plan_version_conflict)
    preview-pending --> preview-pending : preview(newCommand) [aborts previous]

    preview-ready --> preview-pending : preview(newCommand) [aborts previous]
    preview-ready --> idle : cancelPreview()
    preview-ready --> applying : apply()
    preview-ready --> preview-ready : markPreviewStale() [previewStale=true]
    preview-ready --> conflict : SSE planVersionChanged + planVersion >= basePlanVersion + apply

    applying --> applied : apply success
    applying --> error : apply failure (non-conflict)
    applying --> conflict : apply failure (plan_version_conflict)

    applied --> idle : timeout 3000ms

    error --> idle : user dismiss / new preview()
    conflict --> idle : user reload / new preview()
```

## 5. Generation counter (race protection)

**Проблема:** пользователь быстро меняет команду превью (например, тащит бар Gantt). Старые preview-ответы не должны перетирать новые.

**Механика:**

```ts
const previewGenerationRef = useRef(0);
const previewAbortRef = useRef<AbortController | null>(null);

function preview(command) {
  const generation = ++previewGenerationRef.current;
  previewAbortRef.current?.abort();           // отменяем предыдущий fetch
  return previewMutation.mutateAsync({ command, generation });
}

// в onSuccess / onError:
if (input.generation !== previewGenerationRef.current) return;  // устаревший ответ — выкидываем
```

`AbortController` гасит in-flight HTTP-запрос; counter добивает race на уровне callback'ов
(в случае если abort пришёл после получения тела, но до post-processing).

## 6. Conflict handling

`PlanningApiError` с `code === "plan_version_conflict"` (HTTP 409) → переход в state `conflict`:

```ts
async function handleConflict() {
  await queryClient.invalidateQueries({ queryKey: planKeys.project(projectId) });
  invalidateWorkspaceCapacityQueries(queryClient);  // workspace-level capacity tree
  setStore(current => ({
    ...initialPlanMutationStore,
    applyBarState: "conflict",
    errorMessage: "План обновлён другим пользователем. Данные перезагружены.",
    previewStale: current.pendingPreview !== null
  }));
}
```

Conflict сбрасывает pending preview и оба undo/redo стека (потому что они построены поверх устаревшего planVersion).

UI должен показывать кнопку "Перезагрузить и попробовать снова" → создаёт новый preview по свежему snapshot.

## 7. Idempotency

`applyCommand` / `applyCommandBatch` посылают `idempotencyKey: crypto.randomUUID()` в каждый запрос. Сервер дедуплицирует повторы (network retry, double-click).

**Текущая реализация:** UUID генерируется в момент клика на Apply.

**Spec для Phase 9b:** UUID генерируется в момент **создания pending preview** (т.е. при успехе `previewCommand`). Это позволяет:

1. Retry apply с тем же ключом при сетевой ошибке.
2. Гарантировать что multiple clicks на Apply не создают дубликатов даже без сервер-side дедупа.

## 8. Apply (single command)

```
preview-ready ──apply()──> applying ──success──> applied ──3000ms──> idle
                                  └──conflict──> conflict
                                  └──other err──> error
```

Side effects на success:

1. `compensatingUndo.pushApplied({ command, before: pending.preview.before })` — кладём в applied-стек для будущего undo.
2. `queryClient.setQueryData(planKeys.project(projectId), result.readModel)` — обновляем кеш, _не_ invalidate (т.к. server вернул свежий read-model).
3. `invalidateWorkspaceCapacityQueries(queryClient)` — workspace capacity мог измениться.
4. Reset pending/undo/redo to initial.

## 9. Apply batch

`applyCommandBatch(commands[])` используется только из undo/redo (compensating commands могут быть множественными — например, undo move-task может потребовать восстановить original parent + sibling order).

**Контракт:**

- На success: если `commands.length === 1`, кладём single-undo entry; если N>1, undo текущей операции **не сохраняется** в applied-стек (это уже сам undo-результат).

## 10. Compensating undo / redo

`useCompensatingUndo` — отдельный стек _applied_ операций. Каждая запись:

```ts
type AppliedUndoEntry = {
  command: PlanningCommand;       // оригинальная команда что была применена
  before: PlanningReadModel;      // снимок плана ДО применения
};
```

```ts
popUndo() → buildCompensatingCommands(entry.command, entry.before): PlanningCommand[]
```

`buildCompensatingCommands` (из `@kiss-pm/planning-client`) — pure-function, разбирает оригинальную команду + before-state и возвращает массив команд, который восстанавливает before-state. Например:

- `move-task` → команда восстановления старого parent + старого order
- `update-task` → команда с предыдущими полями
- `delete-task` → набор команд `create-task` + восстановления связей/назначений

Redo — просто переподача оригинальной команды (`return [entry.command]`).

**Push-on-apply:** `pushApplied` сбрасывает redoStack (новая ветка истории).

## 11. Preview stale detection

Между моментом превью и моментом apply кто-то другой может применить изменение плана.

**Источники сигнала:**

1. SSE event `planVersionChanged` или `planSnapshotInvalidated` → `markPreviewStale()` →
   `previewStale = true` в store.
2. Computed: `loadedSnapshot.planVersion !== pendingPreview.basePlanVersion`.

UI поведение:

- При `previewStale=true` показывает баннер "План изменился, обновите превью" и блокирует Apply.
- Кнопка "Обновить" переподаёт ту же команду через `preview(command)` против свежего snapshot.

## 12. SSE подписка

`subscribeToPlanEvents(apiOrigin, projectId, callback)` создаёт `EventSource` на
`/api/workspace/projects/:id/planning/events`. Слушает два named-event-а:

```ts
type PlanRealtimeEvent =
  | { type: "planVersionChanged"; projectId: string; planVersion: number }
  | { type: "planSnapshotInvalidated"; projectId: string; reason: string };
```

`usePlan` подписывается при mount и:

1. Вызывает callback `onRemotePlanChange?.()` (используется `usePlanMutation` для `markPreviewStale`).
2. `queryClient.invalidateQueries({ queryKey: planKeys.project(projectId) })` — TanStack Query перезагрузит read-model.
3. `invalidateWorkspaceCapacityQueries(queryClient)` — workspace capacity tree.

При unmount: `subscription.unsubscribe()` (закрывает `EventSource`).

**Spec для Phase 9b:** добавить reconnect/backoff логику (текущая реализация полагается на нативный EventSource auto-reconnect).

## 13. Permissions

`usePlanningPermissions(permissions: readonly string[])` — pure useMemo. Маппит массив permission-ключей в булевы флаги:

```ts
{
  canReadProjectPlan: "tenant.project_plan.read",
  canManageProjectPlan: "tenant.project_plan.manage",
  canManageProjectBaselines: "tenant.project_baselines.manage",
  canReadProjectResources: "tenant.project_resources.read",
  canManageProjectResources: "tenant.project_resources.manage",
  canPreviewPlanningScenarios: "tenant.planning_scenarios.preview",
  canApplyPlanningScenarios: "tenant.planning_scenarios.apply",
  canReadAbsences: "tenant.absences.read",
  canReadOrgStructure: "tenant.org_structure.read",
  canReadAuditEvents: "tenant.audit_events.read"
}
```

`planningPermissionTitle(permissions, key)` возвращает русскоязычное сообщение для tooltip на disabled-кнопках. Без изменений в Phase 9b.

## 14. API endpoints (server contract — без изменений)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/workspace/projects/:id/planning/read-model` | — | `PlanningReadModel` |
| POST | `/api/workspace/projects/:id/planning/preview-command` | `{ command, clientPlanVersion }` | `PlanningPreviewResponse` |
| POST | `/api/workspace/projects/:id/planning/apply-command` | `{ command, clientPlanVersion, idempotencyKey }` | `PlanningApplyResponse` |
| POST | `/api/workspace/projects/:id/planning/apply-command-batch` | `{ commands, clientPlanVersion, idempotencyKey }` | `PlanningApplyResponse` |
| GET (SSE) | `/api/workspace/projects/:id/planning/events` | — | `planVersionChanged` / `planSnapshotInvalidated` events |
| GET | `/api/workspace/projects/:id/planning/baselines` | — | `{ baselines: Baseline[] }` |
| POST | `/api/workspace/projects/:id/planning/scenarios/preview` | `{ target, clientPlanVersion }` | `{ proposals, expiresAt }` |
| POST | `/api/workspace/projects/:id/planning/scenarios/:scenarioId/apply` | `{ clientPlanVersion, acceptedRiskReason? }` | `PlanningApplyResponse & { scenarioRunId }` |

Все запросы — `credentials: "same-origin"` + `x-kiss-pm-action: "same-origin"` header (CSRF protection).

## 15. Error mapping

`PlanningApiError` (из `@kiss-pm/planning-client/api/planningApiClient.ts`):

```ts
class PlanningApiError extends Error {
  status: number;
  code: string;
  body: Record<string, unknown>;
}
```

| HTTP / code | Action |
|---|---|
| 409 / `plan_version_conflict` | `handleConflict()` → state `conflict` |
| 4xx others | state `error`, `errorMessage = error.message` |
| 5xx | state `error`, `errorMessage = "Не удалось..."` (fallback) |
| network/abort | если `controller.signal.aborted` → silent (не trigger state change) |

## 16. Required unit tests (Phase 9b TDD scope)

Каждый transition покрыт минимум одним тестом:

### Preview lifecycle

- [ ] `preview()` от `idle` → `preview-pending`, увеличивает generation.
- [ ] Параллельный `preview()` от `preview-pending` → отменяет предыдущий fetch (AbortController), новый generation.
- [ ] `preview()` success с generation match → `preview-ready`, kладёт в pendingPreview + undoStack.
- [ ] `preview()` success с generation **mismatch** → store без изменений (устаревший ответ).
- [ ] `preview()` reject с code `plan_version_conflict` → `handleConflict()` → state `conflict`.
- [ ] `preview()` reject с другой ошибкой → state `error`, `errorMessage` заполнен.
- [ ] `preview()` reject `error.message === "preview_aborted"` → state без изменений.

### Apply lifecycle

- [ ] `apply()` от `preview-ready` → `applying`, idempotencyKey генерируется.
- [ ] `apply()` success → `applied`, push в `compensatingUndo`, `setQueryData(planKeys, readModel)`, invalidate capacity, reset через 3000ms.
- [ ] `apply()` reject `plan_version_conflict` → state `conflict`, pending очищен.
- [ ] `apply()` reject other → state `error`.
- [ ] `applyBatch([cmd1, cmd2])` от undo → success без push в applied-стек (это уже undo-результат).
- [ ] `applyBatch([single])` от undo → push в applied-стек как обычный apply.

### Stale detection

- [ ] SSE `planVersionChanged` пока `preview-ready` → `previewStale = true`.
- [ ] Computed `previewStale` true когда `loadedSnapshot.planVersion > pendingPreview.basePlanVersion` даже без явного `markPreviewStale`.
- [ ] `cancelPreview()` сбрасывает store в initial.

### Pending undo/redo (внутри сессии превью)

- [ ] `undoPending()` с одним элементом в undoStack → reset в initial.
- [ ] `undoPending()` с N элементами → откатывается на N-1, текущий pending уходит в redoStack.
- [ ] `preview()` после undo → очищает redoStack (новая ветка).

### Applied undo/redo (compensating)

- [ ] `pushApplied(entry)` → размер appliedStack +1, redoStack очищен.
- [ ] `popUndo()` → возвращает `buildCompensatingCommands(entry.command, entry.before)`, переносит в redoStack.
- [ ] `popRedo()` → возвращает `[entry.command]`, переносит обратно в appliedStack.
- [ ] `popUndo()` на пустом стеке → `[]`, никаких изменений.
- [ ] `canUndo` / `canRedo` корректны.

### SSE & invalidation

- [ ] `usePlan` mount подписывает на SSE.
- [ ] `planVersionChanged` event → `invalidateQueries(planKeys.project)` + `invalidateWorkspaceCapacityQueries` + `onRemotePlanChange?.()`.
- [ ] `planSnapshotInvalidated` event → то же самое.
- [ ] `usePlan` unmount → `subscription.unsubscribe()`.

### Permissions

- [ ] `usePlanningPermissions([])` → все флаги false.
- [ ] `usePlanningPermissions(["tenant.project_plan.manage"])` → только `canManageProjectPlan` true.
- [ ] Memoization: same input array → same output ref.

## 17. Что **остаётся как есть** (1-в-1 переезжает)

- `@kiss-pm/planning-client` — package (api/realtime/undo/predecessors/duration/fill).
- `@kiss-pm/domain` — типы команд `PlanningCommand`.
- Server endpoints — никаких изменений.
- `useCompensatingUndo` — функционально без изменений, но переезжает в `apps/web/src/hooks/planning/`.

## 18. Что **переписывается**

- `usePlanMutation` — структурное переписывание: разделение на чистый reducer + thunk-like effects + memoized selectors. Цель: тестируемость state machine отдельно от React/Query.
- `usePlan` — тонкая обёртка над useQuery + useEffect SSE.
- TanStack Query keys остаются `["plan", projectId]`.

## 19. Open questions (отвечать в Phase 9b)

1. **Optimistic updates для apply?** Сейчас apply ждёт ответа сервера полностью. Возможна оптимизация через optimistic update + rollback при conflict, но усложняет undo. **Решение:** оставить как есть в v3, оптимизация — backlog.
2. **Multi-tab sync?** Если пользователь открыл два tab-а одного проекта, SSE приходит в оба, но локальный store не синхронизирован. **Решение:** не делаем в v3 (low priority), полагаемся на per-tab SSE invalidation.
3. **Offline preview?** Невозможно без локального движка планирования. **Решение:** не делаем.

## Ссылки

- [`ARCHITECTURE-DECISIONS.md`](./ARCHITECTURE-DECISIONS.md) — Решение №4
- Phase 9a/9b/9c в `agent-transcripts` плана rebuild v2
