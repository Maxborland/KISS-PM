# Контракт направления «agent-first / PM-as-code»

Продуктово-технический контракт агента «Генри Гантт» — user-delegated PM-агента поверх KISS-PM. Документ фиксирует то, что реально реализовано в коде (`apps/api/src/agent/*`, `apps/web/src/workspace/agent/*`), включая явные ограничения текущей версии. Это не roadmap: всё описанное ниже проверяемо по исходникам и тестам.

## 1. Назначение и модель делегирования

Агент — ассистент сотрудника внутри workspace, который **действует строго от имени пользователя**:

- У агента нет собственной учётной записи, ролей или прав. Каждый запрос агентских роутов аутентифицируется cookie-сессией пользователя (`getSessionActorFromHeaders`), RBAC-профиль — профиль этого пользователя.
- Набор инструментов, который подаётся в LLM, **заранее фильтруется по правам актора** (`allowedToolsForActor`: остаются только инструменты, где `tool.capability({actor, profile}).allowed === true`). Системный промпт прямо говорит модели: «инструменты уже отфильтрованы по уровню доступа сотрудника».
- Агент **никогда не мутирует систему в своём цикле**. LLM-цикл (`runAgentLoop`) исполняет только analyze-инструменты (чтение); вызовы mutation-инструментов превращаются в *предложения*, которые пользователь подтверждает явно, после чего `/execute` переигрывает их через существующие governed-роуты.
- Исполнение идёт **внутренней переотправкой в тот же Hono-app** (`dispatchInternal`/`dispatchBinding` с cookie пользователя): RBAC, валидация, транзакции, version-lock и audit существующих роутов переиспользуются, бизнес-логика не дублируется.
- Defense-in-depth на `/execute`: грубая проверка `tool.capability` до диспатча + точная проверка внутри целевой команды/роута.

Принцип «PM-as-code»: агент работает с планом проекта через тот же командный контракт, что и человек (planning read-model → scenario preview → governed apply с версией плана), а не через привилегированный обходной путь.

## 2. Поверхность API

Все роуты живут в `apps/api/src/agent/agentRoutes.ts` (`registerAgentRoutes`). Аутентификация везде — cookie-сессия; без неё `401 {error:"session_required"}`.

### 2.1. `GET /api/workspace/agent/tools`

Каталог инструментов под права актора + честный статус LLM-канала.

- **200**: `{ tools: AgentToolAvailability[], provider: { model, live, configured } }`. Каждый tool: `name, title, description, kind ("analyze"|"mutation"), allowed, reason` — недоступные инструменты возвращаются с `allowed:false` и причиной, а не скрываются.
- `provider.live=false` для `mock-llm`/`demo-llm`/`scripted-llm` (канал работает, но это не живой LLM — UI обязан показать деградацию); `configured=false` только для `mock-llm`.

### 2.2. `GET /api/workspace/agent/thread`

Create-or-get персистентного треда пользователя (см. §4).

- **200**: `{ conversation, readState }` (conversation сериализована как в collaboration-роутах).
- **501** `collaboration_not_configured` — если collaboration-персистентность не сконфигурирована (partial data-source).

### 2.3. `POST /api/workspace/agent/propose`

LLM-цикл: analyze — вживую, mutation — как предложения.

- **Вход**: `{ goal: string (1..2000 после trim), attachmentIds?: string[], history?: [{role|author, text}], threadId?: string }`.
  - `threadId` опционален: если передан и это не детерминированный `agent-thread-<userId>`, сервер проверяет владение (conversation типа `agent` с `entityId = actor.id`); чужой/произвольный id → **403** `agent_thread_forbidden` (fail-closed). При валидном `threadId` история для LLM собирается **из персистентного треда сервером** (последние ходы, error-квитанции исключаются), а не из клиентского стейта.
  - `history` из тела (клиентская память чата) режется до 12 последних реплик по 4000 символов.
- **Ошибки**: **400** `invalid_goal` / ошибки разбора тела; **429** `agent_busy` (лимит 2 одновременных LLM-циклов на пару тенант:пользователь — защита от denial-of-wallet); **503** `agent_provider_not_configured` + `provider` (при этом user-реплика и error-квитанция всё равно персистятся в тред — ответ несёт `threadId`/`messageIds`).
- **200**: `{ goal, model, reasoning, analyzeResults, proposedActions, iterations, stopReason, outputTokens, threadId?, messageIds?, traceMessageId? }`. Каждое `proposedAction`: `{ tool, input, capability{allowed,reason}, title, preview{before,after}, preconditionVersions{taskUpdatedAt?, planVersion?} }` (`title` всегда присутствует: базово — `tool.title`, для payload-backed карточек обогащается данными сущности).
- Лимиты цикла из env: `KISS_PM_AGENT_MAX_ITERATIONS` (деф. 6), `KISS_PM_AGENT_MAX_OUTPUT_TOKENS` (деф. 16 000), `KISS_PM_AGENT_TIMEOUT_MS` (деф. 60 000).
- Вложения (`attachmentIds`): контент извлекается через **штатный download-роут** внутренней переотправкой (RBAC/audit переиспользуются); максимум 5 файлов и 50 000 символов на контекст; недоступные (RBAC/404), бинарные и опущенные из-за лимитов файлы **честно маркируются** в контексте, а не пропускаются молча.

### 2.4. `POST /api/workspace/agent/propose/stream` (SSE)

Тот же вход, преамбула и коды ошибок, что у `/propose` (единый `parseProposeRequest` — валидация не разъезжается между JSON и SSE). Отличие — ответ потоком `streamSSE`:

- события по мере работы цикла: `reasoning {text}`, `analyze {tool, title, ok}`, `proposal {tool, title}`;
- финальное событие `done` — полный результат в формате ответа `/propose` (включая персистентные `threadId`/`messageIds`/`traceMessageId`);
- при сбое внутри потока — событие `error {error}` (HTTP-статус уже 200, ошибка доносится в теле потока).

### 2.5. `POST /api/workspace/agent/execute`

Применение **подтверждённых пользователем** действий.

- **Вход**: `{ actions: [{ tool, input, preconditionVersions? }] }`, от 1 до 20 действий; иначе **400** `invalid_actions`.
- **200** (всегда, при валидном теле — исходы per-item): `{ results, applied, summary{applied,denied,conflict,failed}, correlationId?, threadId?, messageId? }`.
- Каждый `results[i]`: `{ tool, ok, status: "applied"|"denied"|"conflict"|"failed", error?, result?, currentVersions?, auditEventId?, planningAuditEventId?, planVersion?, projectId? }`. Классификация: `ok` → `applied`; HTTP 403 → `denied`; HTTP 409 или ошибка `*_conflict` → `conflict`; остальное → `failed`. При version-конфликте задачи в ответе есть `currentVersions` (актуальная версия для пересборки карточки).
- Ветки исполнения: ручные (`change_task_status`, `update_task`, `create_task`, `comment_task`, `apply_resource_resolution`, `apply_plan_commands`) + generic-редиспатч декларативных binding-инструментов; неизвестный/не-mutation tool → per-item `400 invalid_action`; mutation без execute-ветки → per-item `501 tool_not_executable_yet`.

### 2.6. Смежный роут: reject-flow сценариев

`POST /api/workspace/projects/:projectId/planning/scenarios/:scenarioId/reject` (`apps/api/src/planning/planningScenarioRejectRoute.ts`) — явное отклонение persisted scenario run. RBAC как у apply (`canApplyPlanningScenarios` + `canReadPlanningReadModel`), тот же tenant-lock, что у apply (сериализует гонку apply↔reject). Ошибки: 404 `scenario_not_found` (единый ответ для «нет такого» и «чужой» — существование чужих run'ов не раскрывается), 409 `planning_scenario_already_applied` / `planning_scenario_already_rejected`. План не мутирует, версия плана не растёт; факт фиксируется audit-событием `planning.scenario.rejected`.

## 3. Жизненный цикл предложения

```
цель пользователя
  → propose / propose/stream (analyze вживую, mutation → предложения)
  → review-карточка (payload-backed preview + preconditionVersions + capability)
  → подтверждение пользователем → execute (governed, per-item outcomes)
  → квитанция (correlationId, auditEventId, planningAuditEventId, planVersion)
  → [для сценариев] альтернатива apply — явный reject
```

### 3.1. Review-карточка (payload-backed)

`buildProposalActionMetadata` собирает карточку **из реальных данных**, а не из слов LLM:

- `change_task_status`: before = текущий статус задачи, after = имя целевого статуса; `preconditionVersions.taskUpdatedAt` из задачи. Метаданные задачи показываются только если у актора есть право их видеть (иначе `capability {allowed:false, reason:"task_participant_role_required"}`).
- `update_task`: карточка показывает **только изменяемые поля** в виде «поле: было → станет» (значения из текущей задачи); неизвестное поле честно помечается «не поддерживается» (execute его отвергнет); `preconditionVersions.taskUpdatedAt` обязателен.
- `create_task`: показываются **все** поля, которые execute реально передаст в governed-роут, включая серверные дефолты — даты, часы (деф. 8 ч), приоритет, участники («исполнитель: вы» при пустом списке), описание; несуществующий проект помечается «создание завершится ошибкой».
- `apply_resource_resolution`: карточка строится из **persisted scenario run** (тот же источник, что governed apply): профиль, версия плана, перегруз, число команд, эффект (устранён/снижен/принят как риск), затронутые задачи/назначения (id, с капом), сдвиг финиша, риск, требуемые согласования, TTL. Уже применённый / отклонённый / истёкший run → `capability {allowed:false}` с причиной `scenario_already_applied` / `scenario_rejected` / `scenario_expired`; не найденный (в т.ч. чужой) — `scenario_not_found` без раскрытия существования. `preconditionVersions.planVersion = run.planVersion`.
- Каждое действие дополнительно аннотировано грубой `capability` инструмента — отказ прав виден **до** подтверждения.

### 3.2. Execute: fail-closed preconditions

- `change_task_status` и `update_task` требуют `preconditionVersions.taskUpdatedAt` **от клиента**; отсутствует/невалиден → per-item `400 missing_precondition_versions`. Сервер версию **не подставляет**.
- `apply_resource_resolution` и `apply_plan_commands` требуют версию плана явно (`input.clientPlanVersion` или `preconditionVersions.planVersion` из карточки); отсутствует → `400 missing_precondition_versions`. Подстановка текущей версии сервером обесценила бы optimistic lock.
- `update_task` fail-closed по составу: неизвестное поле → `400 unsupported_update_field`, невалидный тип значения → `400 invalid_update_field_value` (никаких молчаливых фолбэков «success без применения»). Разрешённые поля: `title, description, priority, plannedStart, plannedFinish, plannedWork, durationWorkingDays`; участники и статус мёржатся из текущего состояния и не затираются.

### 3.3. Квитанция (audit-провенанс)

- На каждое **applied** или **denied** действие пишется отдельное audit-событие `agent.<tool>.applied|denied` с `sourceWorkflow:"agent"`, единым `correlationId` батча (`agent-execute-<uuid>`), before/after и `permissionResult` — попытки агента, отклонённые правами, **не исчезают** из governance trail. Успешные события идут *сверх* штатного аудита governed-команды.
- Квитанция fail-closed: `auditEventId`/`correlationId` попадают в ответ **только** если audit-персистентность сконфигурирована и запись реально произошла; ничего не выдумывается.
- Планообразующие applied-действия (`apply_resource_resolution`, `apply_plan_commands`) дополнительно несут `planningAuditEventId` и `planVersion` из governed-ответа (`auditEventId`/`newPlanVersion`) + `projectId` — именно это событие адресуемо на вкладке «Коммиты».
- Итог батча персистится в тред result-сообщением с per-action `outcomes` (tool, status, auditEventId, planningAuditEventId, planVersion, projectId) — история «запрос → предложение → исход» переживает reload.

### 3.4. Reject-flow

Пользователь может не только применить, но и явно отклонить сценарий (§2.6). После reject карточка `apply_resource_resolution` для этого run честно показывает `scenario_rejected`, а governed apply возвращает 409 — «отклонён» это персистентное состояние run, а не только истечение TTL.

## 4. Персистентный тред

Реализация — `apps/api/src/agent/agentThread.ts` поверх существующей collaboration-модели; отдельной agent-подсистемы хранения нет намеренно.

- **Модель**: у пользователя один приватный тред — conversation с `entityType="agent"`, `entityId=userId`, `conversationType="agent"`, детерминированным id `agent-thread-<userId>` (create-or-get идемпотентен); членство — только владелец.
- **Read-only для клиента**: единственный писатель agent-семантики — серверный модуль, вызываемый из propose/execute; попытка клиентской записи в agent-беседу отклоняется `403 agent_conversation_readonly` (`collaborationRoutes.ts`).
- **Роли ходов** — типизированная `metadata.agent` (`AgentTurnMetadata`):
  - `{role:"user"}` — реплика пользователя (+ `attachmentIds` в metadata);
  - `{role:"agent"}` — ответ агента; `proposal` — компактный снимок предложения (модель, stopReason, до 20 действий: tool/title/before/after/allowed, текст с капом 500); `kind:"error"` — квитанция о недоступном провайдере;
  - `{role:"agent", kind:"result"}` — исход execute: `correlationId` + per-action `outcomes`;
  - `{role:"trace", steps[]}` — завершённый CoT-трейс хода (реальные SSE-шаги; кап 50 шагов по 200 символов), собранный сервером тем же форматом, что live-лейблы клиента.
- Тело хода капится 4000 символами; **полный payload действий в историю не персистится** — источник правды для применения остаётся в live-контракте propose/execute, снимок в треде — история решений.
- **История для LLM** из треда: только user/agent-ходы; error-квитанции и trace в контекст модели не попадают.
- **Realtime**: каждый персистентный ход эмитится в канал беседы (`emitMessageCreated`) тем же событием `message.created`, что и обычные беседы — вторая вкладка видит ходы вживую. Клиент (`agent-surface.tsx`) подписан через `useWorkspaceRealtime`; дубли закрывает дедупликация по id (optimistic-сообщения получают серверные id через `adoptServerIds` из `messageIds` ответа).
- **Гидрация и пагинация** (клиент, `agent-client.ts`): чтение — существующим роутом `GET /api/workspace/conversations/:id/messages` (доступ по членству), страницами `AGENT_HISTORY_PAGE_LIMIT = 30` с курсором «раньше»; признак «есть более ранняя история» — сырое окно сообщений заполнено под лимит (`rawCount`), а не наличие `nextCursor`. Декодер (`decodeAgentThreadTurn`) принимает только сообщения с `metadata.agent`, незнакомое пропускает честно.
- Без collaboration-персистентности (`agentThreadConfigured=false`) тред честно отсутствует: `/thread` → 501, propose/execute работают без персистентности и **не возвращают** `threadId`/`messageIds` (fake persistence с клиента запрещена).

## 5. Инструменты

Реестр — `apps/api/src/agent/toolRegistry.ts`: 10 «ручных» инструментов + декларативные (binding, generic-редиспатч в governed-роут) из `tools/crmTools.ts`, `tools/commsTools.ts`, `tools/adminTools.ts`, `tools/projectTools.ts`. Каждый инструмент — тонкая обёртка над существующим RBAC-гейтнутым роутом с собственной `capability`-проверкой.

Терминология статусов:

- **read-only** = `kind:"analyze"` — только чтение, исполняется вживую в LLM-цикле;
- **offerable** = подаётся в LLM при propose (`isAgentToolOfferable`): все binding-analyze + 4 «ручных» analyze + mutation из `OFFERABLE_MUTATIONS` (только те, для которых review-карточка показывает полный честный before/after);
- **executable** = имеет ветку в `/execute` (все mutation, кроме отсутствующих в списке ниже).

### 5.1. Ручные инструменты (кастомное исполнение в agentRoutes)

| Инструмент | Kind | Offerable | Примечание |
|---|---|---|---|
| `list_my_tasks` | analyze / read-only | да | задачи актора |
| `read_project_plan` | analyze / read-only | да | plan read-model: задачи, перегрузки |
| `detect_resource_overloads` | analyze / read-only | да | перегрузки по тенанту/проекту, топ-30 по минутам |
| `preview_resource_resolution` | analyze / read-only | да | живой governed scenarios/preview (стейджит run'ы, план не меняет) |
| `change_task_status` | mutation | да | precondition `taskUpdatedAt` |
| `update_task` | mutation | да | честный частичный патч, precondition `taskUpdatedAt` |
| `create_task` | mutation | да | карточка со всеми серверными дефолтами |
| `comment_task` | mutation | да | |
| `apply_resource_resolution` | mutation | да | карточка из persisted run, precondition `planVersion` |
| `apply_plan_commands` | mutation | **нет** (executable) | generic-preview «число команд» недостаточно честен для review |

### 5.2. Декларативные инструменты (binding)

Analyze (read-only, offerable): CRM — `list_crm_clients`, `list_crm_contacts`, `list_crm_products`, `list_crm_opportunities`, `read_crm_opportunity`, `list_crm_pipelines`; Comms — `list_communication_channels`, `read_communication_channel`; Admin — `list_workspace_users`, `list_access_roles`, `read_permission_catalog`, `list_positions`, `read_org_structure`, `list_task_statuses`; Projects — `list_projects`, `check_opportunity_feasibility`.

Mutation (executable через generic-редиспатч, **не offerable** — LLM их не предлагает, пока review-карточка не умеет показать их payload): CRM — `create_crm_client`, `update_crm_client`, `create_crm_contact`, `update_crm_contact`, `create_crm_product`, `update_crm_product`, `create_crm_opportunity`, `update_crm_opportunity`, `change_opportunity_stage`, `comment_crm_entity`, `create_crm_pipeline`, `create_crm_pipeline_rule`; Comms — `create_communication_channel`, `update_communication_channel`, `add_channel_member`, `remove_channel_member`, `create_call_room`; Admin — `create_workspace_user`, `update_workspace_user`, `create_access_role`, `update_access_role`, `create_position`, `update_position`, `create_task_status`; Projects — `finalize_opportunity`, `activate_project_from_opportunity`.

## 6. Провайдеры LLM и тестовые гейты

Фабрика — `createAgentLlmProviderFromEnv` (`apps/api/src/agent/llmProvider.ts`); интерфейс провайдера — подмножество Anthropic Messages API (text / tool_use / tool_result). Явное переопределение — `KISS_PM_AGENT_PROVIDER` (`openrouter|anthropic|demo|mock`), модель — `KISS_PM_AGENT_MODEL`, лимит токенов ответа — `KISS_PM_AGENT_MAX_TOKENS`.

Порядок выбора:

1. **scripted** (`scripted-llm`) — только при `KISS_PM_E2E_TEST_HOOKS=1` **и** `KISS_PM_AGENT_SCRIPTED=1`: детерминированный e2e-«мозг» без сети, ведёт полный живой путь (list_my_tasks → comment_task; сценарный флоу перегрузок → preview → apply) через реальные governed-роуты.
2. **openrouter** — при `OPENROUTER_API_KEY` (деф. модель `anthropic/claude-sonnet-4.6`).
3. **anthropic** — при `ANTHROPIC_API_KEY`, `@anthropic-ai/sdk`, ключ только server-side (деф. модель `claude-sonnet-4-6`).
4. **demo** (`demo-llm`) — только за гейтом test-hooks (`KISS_PM_E2E_TEST_HOOKS=1` + `KISS_PM_AGENT_DEMO=true` или explicit `demo`): детерминированный флоу для dev/Storybook без ключа.
5. **mock** (`mock-llm`) — фолбэк; `configured=false` → propose отвечает честным `503 agent_provider_not_configured`.

Гейт test-hooks принципиален: без него `KISS_PM_AGENT_DEMO=true` на боевой инсталляции включал бы фейкового агента с `configured=true`, обходя честный 503. Статус канала (`provider {model, live, configured}`) отдаётся в `GET /tools` и в 503-ответах propose; `live=false` для всех трёх тестовых моделей. В тестах провайдер инъектится через `setAgentLlmProviderOverride`.

## 7. Гарантии честности и ограничения текущей версии

### 7.1. Fail-closed правила (сводка)

1. Нет сессии → 401; чужой threadId → 403; чужие scenario run'ы неотличимы от несуществующих (404/`scenario_not_found`).
2. Preconditions (версия задачи/плана) обязаны прийти от клиента из review-карточки; сервер их **не подставляет** → `missing_precondition_versions`.
3. Review-карточки строятся из payload реальных записей (задача, persisted scenario run, статусы), а не из текста LLM; недоступные данные честно подписываются («Количество комментариев недоступно», «Версия плана недоступна») вместе с `capability {allowed:false, reason}`.
4. Квитанции ссылаются только на реально записанные audit-события; без audit-персистентности `auditEventId`/`correlationId` отсутствуют. Denied-попытки агента фиксируются в audit trail.
5. Клиент (`decodeExecuteResponse`) валидирует ответ execute строго: соответствие results↔actions, инвариант `ok ⇔ status="applied"`, пересчёт summary; расхождение → ошибка `invalid_execute_response`, а не «нарисованный» успех.
6. Тестовые провайдеры за двойным env-гейтом; деградация канала (mock/demo/scripted) видна в `provider.live/configured`.
7. Опущенные/недоступные/бинарные вложения маркируются в контексте LLM — агент и пользователь не принимают решения по молча-обрезанному контексту.
8. Клиентская запись в agent-тред запрещена (`agent_conversation_readonly`); без collaboration-персистентности `threadId`/`messageIds` честно отсутствуют.

### 7.2. Явные ограничения

- `apply_plan_commands` executable, но не offerable: его generic-preview («число команд») не считается достаточно честным для review-карточки.
- Все декларативные binding-mutation (CRM/comms/admin/projects) не offerable по той же причине — LLM их не предлагает, хотя `/execute` их поддерживает.
- Generic-preview для binding-действий («Текущее значение определяется целевым маршрутом») — заглушка, а не полный before/after.
- Снимок предложения в персистентном треде усечён (капы §4) и не является источником правды для применения.
- Память чата ограничена 12 последними репликами; перегрузки в analyze-ответах капятся топ-30; вложения — 5 файлов / 50 000 символов; батч execute — до 20 действий; трейс — 50 шагов.
- `update_task` меняет только 7 разрешённых полей; участники и статус — отдельными инструментами.
- Один LLM-цикл лимитирован итерациями/токенами/таймаутом (env, §2.3), одновременных циклов на пользователя — не более 2.
