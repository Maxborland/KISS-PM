# Контракт task actions для beta

## Назначение

Это минимальный **Task Action Contract** для beta-контекста.  
Цель — зафиксировать, какие task-actions уже есть в API, какие поля можно безопасно менять, как устроен confirmation-only flow у агента и где наблюдаем пробелы.

Сфера договора: `status`, `blocker`, `due date`, `owner`, `comment` для задач.

## 1) Источник правды в текущем слое API

- `apps/api/src/projectWorkRoutes.ts`
- `apps/api/src/projectWorkParsers.ts`
- `packages/persistence/src/projectWorkRepository.ts`
- `apps/api/src/workspaceAgentRoutes.ts`
- `packages/persistence/src/operationsCockpitReadRepository.ts`

## 2) Existing endpoints / capabilities

### Status

- `GET /api/workspace/task-statuses`  
  Возвращает список статусов для UI.  
  Важно: это только справочник статусов, не изменение статуса задачи.

- `PATCH /api/workspace/projects/:projectId/tasks/:taskId/status`  
  Request: `{ "statusId": string }`  
  Валидация: статус должен существовать и быть `active`; проверяются переходы статусов и права.  
  Side effect: применяются planning-команды (`applyPlanningCommand`), пишет `ManagementAuditEvent` (`actionType=task.status_changed`).

- `PATCH /api/workspace/tasks/:taskId`  
  Рабочая точка для update, но для task actions требует полный body `UpdateTaskBody`:
  - `title`, `description`, `priority`, `plannedStart`, `plannedFinish`, `durationWorkingDays`, `plannedWork`, `requiresAcceptance`, `participants`, `statusId`, `clientUpdatedAt`
  - для изменения статуса **не использовать как fallback**: этот путь не должен обходить transition/acceptance checks project-scoped endpoint-а.
  - если UI-контекст не знает `projectId`, сначала нужно получить task detail и project context; иначе это backend/API gap для `/my-work`, а не повод менять `statusId` через full update.

### Owner

- `PATCH /api/workspace/tasks/:taskId`  
  `owner` моделируется через участника с `role = "executor"` внутри `participants`.  
  Обязательные участники: `executor` и `requester`.  
  Важно: `participants` имеет replace-all семантику. Owner-only action обязан загрузить текущие `participants`, заменить только executor-entry и отправить полный сохранённый список, чтобы не потерять `co_executor`, `controller`, `approver`, `observer` и связанные назначения.
  Server-side пишет `task.updated` + `ManagementAuditEvent`.

### Due date

- `POST /api/workspace/tasks` и `POST /api/workspace/projects/:projectId/tasks`  
  При создании задачи задаются `plannedStart`, `plannedFinish`, `durationWorkingDays`, `plannedWork`.

- `PATCH /api/workspace/tasks/:taskId`  
  Даты меняются через поля `plannedStart` и `plannedFinish`, но endpoint принимает не partial patch, а полный `UpdateTaskBody`.
  Due-date-only action обязан сначала загрузить текущую задачу, сохранить неизменённые поля (`title`, `description`, `priority`, `durationWorkingDays`, `plannedWork`, `requiresAcceptance`, `participants`, `statusId`) и отправить полный body с новым `plannedStart`/`plannedFinish` + актуальным `clientUpdatedAt`.
  Если `/my-work` не может собрать полный body без потери текущих участников/статуса/плановых полей, это backend/API gap для отдельного безопасного due-date endpoint-а, а не повод отправлять неполный update.
  Нет отдельного `dueDate` поля в модели.

### Comment

- `POST /api/workspace/tasks/:taskId/comments`  
  Request: `{ "body": string }`  
  Side effects: создаётся activity type=`comment`, пишет `ManagementAuditEvent` (`actionType=task.comment_created`), response `201` с `{ activity }`.

### Аудит и result visibility

- Для всех task-мутаций, которые в коде реально делают state change (`create/update/status/comment`), выполняется `appendManagementAuditEvent`.
- На уровне HTTP-ответа текущих task endpoint-ов audit-id **не возвращается прямо в теле**, поэтому UI должен читать audit через общий audit flow, если нужен cross-screen proof.

## 3) Missing / explicitly not modeled

- `PATCH /api/workspace/tasks/:taskId/blocker` — **нет endpoint и поля `blocker` в модели**.
- `POST /api/workspace/tasks/:taskId/blocker` / `PATCH /api/workspace/tasks/:taskId/blocker-reason` — **нет**.
- Непосредственно выделенный endpoint `PATCH /api/workspace/tasks/:taskId/owner` — **нет** (owner меняется через `participants`).
- Непосредственный `PATCH /api/workspace/tasks/:taskId/dueDate` — **нет** (даты меняются только через full-task update + `plannedStart/plannedFinish`).
- Прямое возвращение `auditEventId` в ответе task mutation endpoint — **нет**.

Дополнение из model-layer: `operationsCockpitReadRepository` явно фиксирует, что отдельного признака blocker в текущей модели нет; используется только статусная модель (`waiting` как signal).

## 4) Confirmation-only policy для agent-контракта

- `GET /api/workspace/agent-thread` — возвращает contract и текущий thread/proposals.
- `POST /api/workspace/agent-thread/messages`
  - `mutationPolicy.mode = "confirmation_required"`
  - `mutationPolicy.messagePostMutatesWorkspace = false`
  - При posting только создаётся message + optional proposal.  
    **Мутаций workspace через message post нет.**
- `POST /api/workspace/agent-thread/proposals/:proposalId/confirm`
  - На decision `apply` для `workspace.agent.create_task` выполняет изменение (через planning/apply path), proposal закрывается как `applied`.
  - На decision `reject` запись становится `rejected`, mutation не выполняется.
  - Если proposal уже имеет статус `applied` или `rejected`, API возвращает `409 agent_proposal_already_resolved`.
  - Proposal response всегда содержит:
    - `confirmation = { required, status, endpoint, allowedDecisions, mutationOnlyOnApply }`
    - `resultSummary = { status, mutationApplied, changedEntity, auditEventId, description }`
- Для успешного применения ожидается `resultSummary.mutationApplied = true`; для `pending` — `false`.
- Для `pending`/`proposed` `auditEventId` в `proposal.resultSummary` должен быть `null`; top-level `auditEventId` у message-post response не требуется.
- После успешного confirm (`applied`/`rejected`) `auditEventId` должен быть в `proposal.resultSummary` и top-level confirm response; если его нет — это backend/audit gap для UI.

## 5) Минимальные контрактные требования для UI-agent slice

- UI может отображать и отправлять только перечисленные action-capabilities из секции 2.
- Для blocker в этом спринте: показывать как gap и не запускать dedicated blocker-mutation из UI без отдельного backend endpoint-а.
- Любая agent-мутация только через confirm endpoint; перед confirm — только dry-run proposal context.
- После confirm показывать:
  1) `resultSummary.mutationApplied`/`status`
  2) `auditEventId` из confirm response/proposal result (для `applied`/`rejected` всегда должен приходить; для `pending` — null только в `proposal.resultSummary`)
- Рекомендуемый следующий runtime-slice:
  1) контрактная реализация /my-work actions (`status`, `due date`, `owner`, `comment`) на существующих API
  2) blocker UX как read-only placeholder с explicit blocker gap
  3) agent confirmation result surface с audit marker
