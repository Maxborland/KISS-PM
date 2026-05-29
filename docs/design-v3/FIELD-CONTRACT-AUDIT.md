# Field Contract Audit & UI Sync (design-v3)

Дата аудита: 2026-05-25.

Источник истины: `apps/api/src/apiTypes.ts`, backend parsers/routes и domain/persistence-типы, которые возвращаются API. Этот документ фиксирует расхождения между backend-контрактом и design-v3 frontend surface. Реальный HTTP-wiring в этом срезе не подключается: фронт синхронизируется через type-only DTO, полные mock records и UI-поля в карточках/таблицах/drawers.

## Статусы

| Статус | Значение |
|---|---|
| `present` | Поле уже видно на UI surface или добавлено в текущем sync. |
| `renamed` | UI использует другое имя; требуется явная мапа из backend field. |
| `missing` | Поле есть в backend API, но отсутствует на frontend surface. |
| `fake` | UI показывает декоративное или hard-coded значение вместо API-поля. |
| `out-of-scope` | Поле не нужно показывать на компактной карточке, но должно быть в detail/drawer или DTO. |

## Product Owner Gate

- Проблема: карточки design-v3 выглядят готовыми, но не отражают фактический API-контракт backend. Пользователь видит неполную или местами декоративную карточку и не может сверить сделку, проект, задачу, KPI, аудит или настройки с данными системы.
- Пользователь / роль: PM, sales lead, resource owner, tenant admin, руководитель проекта.
- CN: видеть в одном интерфейсе все поля, которые backend реально возвращает, без fake affordances и без расхождения терминов между API и UI.
- Desired outcome: compact cards показывают ключевые operational fields, а drawers/detail panels дают полный field-level record.
- Business value: меньше ручной сверки, меньше ошибок в lifecycle `Opportunity -> Project -> Task -> KPI -> Action -> Audit`, прозрачнее готовность к real API wiring.
- Non-goals: не менять backend, не подключать fetch/TanStack Query, не строить новый CRUD workflow там, где план требует только field sync.

## Acceptance Criteria

AC1. Backend field visibility
Given backend returns a record from API contract
When the corresponding design-v3 surface renders mock data
Then all top-level fields are either visible in compact UI, visible in detail/drawer, or explicitly marked `out-of-scope` in this audit.

AC2. No fake affordances
Given a card/list/drawer shows a person, activity, date, status, amount, permission or signal
When the value is inspected
Then it maps to a typed mock/API field, not to a decorative hard-coded placeholder.

AC3. Type alignment
Given frontend mock records are edited
When TypeScript checks them
Then missing backend keys fail at compile time through `apps/web/src/lib/api-types`.

AC4. Design-v3 fit
Given additional fields are added to cards/tables/drawers
When Storybook or app UI renders them
Then they use existing domain primitives, BEM classes and shadcn components without inline TSX styles or feature-local CSS.

## Backend Entity Matrix

### Tenant / Workspace

| Entity | Backend fields | Current frontend surface | Status | Action |
|---|---|---|---|---|
| `Tenant` | `id`, `name` | shell sidebar workspace label | renamed | Keep compact shell label; DTO required. |
| `WorkspaceUserRecord` | `id`, `tenantId`, `name`, `accessProfileId`, `email`, `positionId`, `positionName`, `phone`, `telegram`, `status`, `theme`, `accentColor` | `admin-block`, `settings-block`, `avatar-menu-block`, `app-sidebar`, task participant pickers | missing | Add full user rows, position/contact/theme fields, reusable mock users. |
| `AccessProfileRecord` | `id`, `tenantId`, `name`, `permissions[]` | not rendered as entity | missing | Add admin/settings panel with permissions count and assigned users count. |
| `PositionRecord` | `id`, `tenantId`, `name`, `description` | task demand text only, no entity surface | missing | Add admin positions panel and show `positionName` in user surfaces. |

### CRM Reference Entities

| Entity | Backend fields | Current frontend surface | Status | Action |
|---|---|---|---|---|
| `ClientRecord` | `id`, `tenantId`, `name`, `description`, `status`, `createdAt`, `updatedAt` | `entities-block` clients: `name`, `code`, manager, segment, deals, amount | renamed/missing | Replace inline row shape with typed clients; keep related metrics as derived UI fields; show full detail drawer. |
| `ContactRecord` | `id`, `tenantId`, `clientId`, `name`, `email`, `phone`, `telegram`, `role`, `status`, `createdAt`, `updatedAt` | `entities-block` contacts: `name`, `company`, `role`, `email`, fake activity | fake/missing | Use `clientId` + derived clientName, add phone/telegram/status/dates; remove hard-coded activity. |
| `ProductRecord` | `id`, `tenantId`, `name`, `sku`, `type`, `unit`, `price`, `description`, `status`, `createdAt`, `updatedAt` | `entities-block` products: code/category/price/deals/status | renamed/missing | Map `code -> sku`, `category -> type`; show unit/description/dates in detail. |
| `ProjectTypeRecord` | `id`, `tenantId`, `name`, `description`, `status`, `createdAt`, `updatedAt` | deal form uses string project type | missing | Add shared mock/project-type lookup and show label in deal/project detail. |
| `DealStageRecord` | `id`, `tenantId`, `name`, `sortOrder`, `status`, `createdAt`, `updatedAt` | hard-coded `STAGES` in deals block | renamed/missing | Move stages to typed mock data and keep stageId mapping. |

### Opportunity / Deal

| Backend field | Frontend status | Action |
|---|---|---|
| `id`, `tenantId` | `id` present, `tenantId` missing | Keep `id` on card/list; `tenantId` in detail/DTO. |
| `clientId`, `clientName` | `client` renamed | Use `clientName` in compact UI, keep `clientId` in detail. |
| `primaryContactId`, `contactName` | missing | Add contact to cards/detail and create sheet selector field. |
| `ownerUserId` | rendered as decorative `owner` object | Map to typed workspace user and derived avatar. |
| `projectTypeId`, `projectType` | `projectType` missing | Add chip/field. |
| `stageId` | `stage` renamed | Use `stageId` in DTO, derived label/tone in UI. |
| `title`, `description` | title present, description mostly missing | Add description to drawer/detail. |
| `plannedStart`, `plannedFinish` | missing | Add due/planned range in card/detail/create. |
| `contractValue`, `plannedHourlyRate`, `plannedHours` | `amount` renamed, hours/rate missing | Use numeric value and formatter; show rate/hours in detail. |
| `probability` | missing | Add probability chip/metric. |
| `status` | partial through stage | Add lifecycle status chip. |
| `templateId` | missing | Add template reference in detail/create. |
| `feasibilityStatus`, `feasibilityResult`, `feasibilityCheckedAt` | missing | Add read-only feasibility panel. |
| `createdAt`, `updatedAt` | missing | Add detail metadata. |
| `demand[]` | missing | Add demand mini-list. |
| `customFieldValues` | missing | Add custom fields summary/detail. |
| `owner/team avatar` | fake in list (`ВВ`) | Remove fake avatar and derive from `ownerUserId`. |

### Project

| Backend field | Frontend status | Action |
|---|---|---|
| `id`, `tenantId` | `id/code` present, `tenantId` missing | Keep `id`; detail metadata for tenant. |
| `sourceType`, `sourceOpportunityId` | missing | Add source chip and source opportunity reference. |
| `clientId`, `clientName` | `client` renamed | Use `clientName`; keep `clientId` in detail. |
| `projectTypeId` | missing | Add project type field. |
| `title`, `status` | present | Keep. |
| `plannedStart`, `plannedFinish` | `due` renamed | Replace due with planned date range. |
| `contractValue`, `plannedHours` | missing | Add economics columns/detail. |
| `templateId` | shown as separate template rows, not field | Add template reference. |
| `createdAt`, `activatedAt` | missing | Add detail metadata. |
| `demand[]` | missing | Add demand count/detail mini-list. |

### Task / My Work / Gantt

| Backend field | Frontend status | Action |
|---|---|---|
| `id`, `title`, `description` | mostly present | Keep. |
| `tenantId`, `projectId`, `stageId` | partially missing | Add project/stage metadata in drawer. |
| `status`, `statusId`, `statusName`, `statusCategory` | `columnId` renamed | Use status fields and derive kanban column from `statusCategory`. |
| `priority` | present | Keep. |
| `requesterUserId`, `ownerUserId` | rendered as assignees only | Distinguish requester/owner/participants in cards/drawers. |
| `plannedStart`, `plannedFinish`, `durationWorkingDays`, `plannedWork` | present in task forms, compact card partial | Add compact date/work labels. |
| `actualWork`, `progress` | missing in cards | Add progress/work summary. |
| `requiresAcceptance` | present in forms, missing in cards | Add chip. |
| `source`, `createdAt`, `updatedAt`, `archivedAt` | missing | Add drawer metadata and archived indicator. |
| `participants[]` | present in form, compact card as avatars | Keep; derive avatars from typed users. |

### Workspace Config

| Entity | Backend fields | Current frontend surface | Status | Action |
|---|---|---|---|---|
| `CustomFieldDefinitionRecord` | `id`, `tenantId`, `systemKey`, `tenantLabel`, `targetEntity`, `fieldType`, `required`, `status`, `createdAt`, `updatedAt` | not rendered | missing | Add settings workspace-config panel. |
| `ProjectTemplateRecord` | `id`, `tenantId`, `systemKey`, `tenantLabel`, `description`, `status`, `createdAt`, `updatedAt` | templates list uses project-like rows | renamed/missing | Add settings workspace-config panel and use template labels in deal/project detail. |
| `TaskStatusRecord` | `id`, `tenantId`, `name`, `category`, `sortOrder`, `status`, `isSystem`, `createdAt`, `updatedAt` | kanban columns hard-coded | renamed/missing | Add settings status panel and task mock statuses. |

### Planning / Capacity / Calendar

| Entity | Backend fields | Current frontend surface | Status | Action |
|---|---|---|---|---|
| `PlanSnapshot` | `planVersion`, `project`, `tasks`, `assignments`, `dependencies`, `baselines`, `calendars`, `calendarExceptions`, `resources`, `reservations`, `constraints`, `capturedAt` | Gantt widget-specific shape | renamed/missing | Keep widget shape but add bridge metadata and detail fields where visible. |
| `ProductionCalendar` | `calendarId`, `year`, `workingWeekdays`, `workingMinutesPerDay`, `exceptions[]` | project calendars demo weekdays/exceptions | renamed/missing | Use `workingMinutes`/`resourceId` fields and bind date field to state. |
| `Absence` | `id`, `tenantId`, `userId`, `type`, `dateFrom`, `dateTo`, `status`, `reason`, `createdBy`, `approvedBy`, `createdAt`, `updatedAt` | not rendered | missing | Add capacity/admin absence panel. |
| `OrgStructure` | functional/project nodes and placements | not rendered | missing | Add admin org structure panel. |
| `ScheduledTask` | `id`, `title`, `projectId`, `projectTitle`, `plannedStart`, `plannedFinish`, `workMinutes`, `createdAt`, `statusId` | not rendered as backend shape | missing | Add scheduled summary in My Work. |

### KPI / Control / Audit

| Entity | Backend fields | Current frontend surface | Status | Action |
|---|---|---|---|---|
| `KpiDefinition` | `id`, `tenantId`, `entityType`, `code`, `label`, `formula`, `unit`, `period`, `thresholdRules`, `ownerRole`, `allowedActions`, `version`, `status` | `project-kpi-block` label/value/delta | missing | Add definition metadata and threshold summary. |
| `KpiEvaluation` | `id`, `tenantId`, `projectId`, `definitionId`, `definitionVersion`, `formulaVersion`, `sourceData`, `periodStart`, `periodEnd`, `threshold`, `calculatedValue`, `severity`, `evaluatedAt` | value/delta only | missing | Add severity, period, calculated/threshold fields. |
| `ControlSignal` | `id`, `tenantId`, `projectId`, `sourceEntity`, `sourceMetric`, `evaluationId`, `severity`, `explanation`, `ownerUserId`, `allowedActions`, `scenarioProposals`, `status`, `createdAt`, `updatedAt` | narrative title/body/tone | missing | Add signal metadata, action chips, scenario proposal count. |
| `CorrectiveAction` | `id`, `tenantId`, `projectId`, `controlSignalId`, `title`, `description`, `responsibleUserId`, `dueDate`, `status`, `result` | not rendered | missing | Add corrective actions panel. |
| `ActionExecutionRecord` | `id`, `tenantId`, `projectId`, `actionType`, `targetEntity`, `actorUserId`, `input`, `previewPayload`, `resultPayload`, `status`, `auditEventId`, `createdAt` | not rendered | missing | Add action execution log panel. |
| `AuditEventListItem` | `id`, `tenantId`, `actorUserId`, `actionType`, `sourceSurfaceId`, `sourceWorkflow`, `sourceEntity`, `input`, `beforeState`, `afterState`, `permissionResult`, `executionResult`, `correlationId`, `createdAt` | project audit narrative | missing | Show action/source/permission/correlation fields. |

## Architecture Decision

Frontend keeps a separate `apps/web/src/lib/api-types` mirror with JSON-safe date strings. It intentionally does not import runtime backend modules from `apps/api` or `@kiss-pm/persistence`. Where backend types reference domain records, web DTOs preserve the same field names and reduce nested unknown payloads to `Record<string, unknown>`.

## UX Decision

Compact cards show only operationally useful fields. Full API coverage is provided in drawers, admin/settings panels, and audit/KPI detail panels. This keeps design-v3 density without turning every card into a schema dump.

## Close Criteria

- All rows above are either implemented in UI/mocks/types or explicitly accepted as `out-of-scope` for compact card display.
- No hard-coded fake people/activity indicators remain in synced surfaces.
- Typecheck proves mock records satisfy frontend API DTOs.

## Closure Status

Статус после implementation pass:

| Area | Status | Evidence |
|---|---|---|
| API DTO mirror | `present` | `apps/web/src/lib/api-types/*` mirrors backend top-level fields with JSON-safe date strings. |
| Mock records | `present` | `apps/web/src/lib/mock-data/*` contains typed records for CRM, deals, projects, tasks, users, config, capacity, control and audit. |
| Deal / Opportunity surfaces | `present` | `deals-block`, `DealKanbanCard`, `DealCard`, `FunnelBoard` use opportunity fields: contact, probability, planned finish, hours, feasibility, project type and demand/detail metadata. |
| Project surfaces | `present` | `projects-list-block` uses `Project` fields: source, planned range, contract value, planned hours, template and demand. |
| Task / My Work / Gantt | `present` | `my-work-block`, `TaskKanbanCard`, and Gantt drawer expose status, progress, plan/fact work, acceptance and backend identifiers. |
| CRM reference entities | `present` | `entities-block` renders `Client`, `Contact`, `Product` fields and full detail rows; fake activity copy removed. |
| Workspace config / admin | `present` | `admin-block`, `settings-block`, `avatar-menu-block`, `app-sidebar` render WorkspaceUser, Position, AccessProfile, CustomFieldDefinition, ProjectTemplate, DealStage, TaskStatus and OrgStructure data. |
| KPI / control / audit | `present` | `project-kpi-block` and `project-audit-block` render KPI definitions/evaluations, signals, corrective actions, action executions and AuditEvent metadata. |
| Calendar / absence / planning ops | `present` | `project-calendars-block`, `project-baseline-block`, `project-scenarios-block` and admin absence panel use production calendar, absences, baselines and scenario mock contracts. |
| Compact-card overflow fields | `out-of-scope` | Some raw IDs and nested payloads stay in drawers/details instead of compact cards to keep design-v3 density. |

Health guard: `storybook-contract.health.test.ts` now checks that synced surfaces do not reintroduce the removed fake affordances (`ВВ` synthetic avatar in deal cards, hard-coded `12 событий`, hard-coded new-deal owner literal).
