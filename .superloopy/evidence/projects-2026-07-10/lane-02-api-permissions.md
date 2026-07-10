# Projects backend: API permissions and data behavior audit

Дата: 2026-07-10
Ветка: `codex/pre-prod-hardening-on-master`
Репозиторий: `E:\KISS-PM`
Режим: product files read-only; записан только этот отчёт.

## Итог

Проверены 25 HTTP endpoint в `projectWork*`, `projectIntake*` и `taskStatus*`, соответствующие service/command boundaries, PostgreSQL repositories, tenant predicates и audit writes.

Авторизация в этом контуре не привязана к фиксированному имени роли: фактическая роль — это `AccessProfile.permissions`. Исключение — task participant roles (`requester`, `executor`, `co_executor`, `controller`), которые дают узкие права на status transition/comment и requester-owned edit/accept. Все object reads/writes передают `actor.tenantId` в repository; PostgreSQL запросы повторно фильтруют `tenant_id`. Cross-tenant id поэтому маскируется как `404`, а не раскрывается через `403`.

Основные findings:

1. **HIGH:** opportunity create молча заменяет неизвестную demand-позицию первой позицией тенанта; несколько неизвестных строк могут схлопнуться. Поведение подтверждено существующим DB-тестом как `201`, но оно меняет бизнес-смысл ресурсного спроса.
2. **MEDIUM:** тот же неизвестный `demand.positionId` на opportunity update не нормализуется и уходит в FK violation, то есть одинаково валидный по parser payload даёт `201` на create, но `500 internal_error` на update.
3. **MEDIUM:** duplicate client-supplied id на workspace-inbox task create не преобразуется в `409 task_id_taken`; unique violation уходит в `500`.
4. **MEDIUM:** collision client-supplied project id при activation и unique name/sort-order collision при task-status PATCH также уходят в `500` вместо стабильного conflict response.
5. **LOW / audit gap:** intake пишет denied audit для mutation permissions, project-work/task-status denied mutations — нет. Это не access bypass, но снижает расследуемость.

Успешные focused проверки: **42 tests passed** (`26` project-work API DB + `9` intake service + `3` intake/activation API DB + `3` persistence DB + `1` demand-normalization DB regression).

## Точный scope

Включено:

- `apps/api/src/projectWorkRoutes.ts`, `apps/api/src/project-work/*`, `projectWorkParsers*`, `projectWorkRoutes.db.test.ts`;
- `apps/api/src/projectIntakeRoutes.ts`, `projectIntakeService.ts`, `projectIntakeService/*`, parsers/tests, focused `app.db.test.ts` и CRM regression evidence;
- `packages/access-control/src/index.ts` для permission semantics;
- `packages/persistence/src/projectIntakeRepository.ts`, `projectWorkRepository.ts`, schema и focused repository tests;
- endpoint/method, session/permission/participant role, status/error precedence, persistence/readback, tenant isolation, transaction/audit behavior.

Не включено:

- UI, styling и frontend behavior;
- planning/closure/retrospective routes вне task compatibility calls, уже покрываемых project-work командами;
- agent proxy endpoints;
- product fixes или новые tests;
- дублированное дерево `.claude/worktrees/full-eval-uiux/**` (CodeGraph видел его, но выводы и line evidence ниже относятся только к текущему `apps/**` / `packages/**`).

## Метод и команды

1. Обязательный structural entry: `codegraph sync`, затем `codegraph_status`, `codegraph_context`, `codegraph_files`, `codegraph_search`, два capped `codegraph_explore`.
2. Baseline CodeGraph: **2,176 files / 24,132 nodes / 52,137 edges**.
3. После structural entry использованы `rg -n` для literal route strings, permission strings, SQL constraints и test names; точные implementation blocks прочитаны line-numbered `Get-Content`.
4. Focused tests запускались установленным локальным Vitest. `pnpm vitest ...` не дошёл до tests из-за wrapper install и `ERR_PNPM_IGNORED_BUILDS`; sandbox direct run упал на `spawn EPERM`, после чего те же read-only test commands успешно выполнены вне sandbox.

Команды проверки:

```text
.\node_modules\.bin\vitest.cmd run \
  apps/api/src/projectWorkRoutes.db.test.ts \
  apps/api/src/projectIntakeService.test.ts

# projectWork DB фактически запускался отдельно с DB config:
.\node_modules\.bin\vitest.cmd run --config vitest.db.config.ts \
  apps/api/src/projectWorkRoutes.db.test.ts

.\node_modules\.bin\vitest.cmd run --config vitest.db.config.ts \
  apps/api/src/app.db.test.ts \
  -t "creates an opportunity, checks feasibility, activates a project and writes audit|keeps project drafts out of the active projects workspace API|denies opportunity and project reads and mutations for users without Phase 3 permissions"

.\node_modules\.bin\vitest.cmd run --config vitest.db.config.ts \
  packages/persistence/src/repositories.db.test.ts \
  packages/persistence/src/projectWorkRepository.db.test.ts \
  -t "persists opportunities with demand and active projects inside one tenant|creates a tenant-scoped project task and returns it in project and My Work views|updates task status and keeps tenant/project boundaries"

.\node_modules\.bin\vitest.cmd run --config vitest.db.config.ts \
  apps/api/src/crmActivityRoutes.db.test.ts \
  -t "normalizes an unknown demand position instead of failing on opportunity create"
```

Результаты:

- `projectIntakeService.test.ts`: **9/9 passed**.
- `projectWorkRoutes.db.test.ts`: **26/26 passed**, 31.26s.
- focused `app.db.test.ts`: **3 passed / 28 skipped**.
- focused persistence: **3 passed / 6 skipped**.
- demand normalization regression: **1 passed / 6 skipped**.
- Во всех Vitest runs есть существующее esbuild warning о дублирующем `case "assignment.delete"` в `packages/domain/src/planning/commandReducer.ts:582`; к этой lane не относится.

## Role / permission legend

| Код | Реальная проверка |
|---|---|
| `ANON` | Нет session cookie / actor. Для mutation без корректного same-origin header глобальный middleware раньше route вернёт `403 same_origin_action_required`; с header — `401 session_required`. |
| `NONE` | Authenticated profile без нужного permission: обычно `403 permission_missing`. |
| `PR` | `tenant.projects.read`. |
| `PM` | `tenant.projects.manage`. |
| `TC/TE/TD/TS` | `tenant.tasks.create` / `tenant.tasks.edit` / `tenant.tasks.delete` / `tenant.task_statuses.manage`. |
| `PP/RM` | `tenant.project_plan.manage` / `tenant.project_resources.manage`. |
| `OR/OM` | `tenant.opportunities.read` / `tenant.opportunities.manage`. |
| `RF/PA` | `tenant.resource_feasibility.read` / `tenant.project_activation.manage`. |
| `PART` | Task participant role. Transition: requester/executor/co_executor/controller; comment: любой participant; observer не может transition, но может comment. |

`tenantPermission` сначала сравнивает tenant, затем permission (`packages/access-control/src/index.ts:105-108,175-193`). В этих routes `targetTenantId` всегда равен `actor.tenantId`, поэтому реальная защита от guessed cross-tenant ids обеспечивается tenant-scoped repository query.

## Endpoint x role x expected result matrix

Общий status precedence:

- Любой mutation (`POST/PATCH/DELETE`) сначала проходит глобальный same-origin gate: отсутствие/невалидность `x-kiss-pm-action: same-origin` или untrusted Origin -> `403 same_origin_action_required` до route auth (`apps/api/src/app.ts:106-115`).
- Path id парсится до session lookup; malformed id -> `400` даже для anonymous (`projectWorkRoutes.ts:45-50,99-104`; `projectIntakeRoutes.ts:66-74,240-251`).
- `authorizeRoute` для list/detail intake использует порядок `401 -> 501 -> 403` (`routeAuth.ts:53-70,99-106`).
- Почти все intake/task mutations делают permission preflight до body parse, поэтому denied actor получает `403` даже с malformed JSON. Исключение: task-status POST/PATCH читает/парсит body до permission, поэтому malformed JSON у authenticated unauthorized actor -> `400`, valid body -> `403` (`taskStatusRoutes.ts:24-39,44-66`).

### Project work and task status

| Method / endpoint | `ANON` | `NONE` | Minimum allowed profile/role | Success / expected data | Other expected errors | Audit on success / denied |
|---|---|---|---|---|---|---|
| `GET /api/workspace/projects/:projectId` | `401` (`400` bad id first) | `403` | `PR` | `200 {project,tasks}`; only active project | `404 project_not_found`, `501` | none / none |
| `GET /api/workspace/projects/:projectId/tasks` | `401` (`400` bad id) | `403` | `PR` | `200 {tasks}`; non-archived tasks | `404 project_not_found`, `501` | none / none |
| `GET /api/workspace/my-work` | `401` | `403` | `PR` | `200`; only actor as executor/co_executor | `501` | none / none |
| `GET /api/workspace/tasks/:taskId` | `401` (`400` bad id) | `403` | `PR` | `200 {task,activities,attachmentItems}` | `404 task_not_found`, `501` | none / none |
| `GET /api/workspace/tasks/:taskId/activity` | `401` (`400` bad id) | `403` | `PR` | `200 {activities,attachmentItems}` | `404 task_not_found`, `501` | none / none |
| `POST /api/workspace/tasks` | `401` after same-origin gate | `403` | `(TC or PM) + PP + RM` for required executor assignment | `201 {task,project,planVersion}` in tenant workspace-inbox project | `400` parser/participant/status, `501`; duplicate supplied id currently `500` bug | `task.created` / none |
| `POST /api/workspace/projects/:projectId/tasks` | `401` (`400` bad id) | `403` | `(TC or PM) + PP + RM` | `201 {task}`; active project only | `400`, `404 project_not_found`, `409 task_id_taken`, `501` | `task.created` / none |
| `PATCH /api/workspace/tasks/:taskId` | `401` (`400` bad id) | `403` | `TE` or `PM` or task requester; plus `RM` only when assignment commands change | `200 {task}`; transaction readback; optional planVersion internal | `400` participant/status, `404`, `409 task_version_conflict`, `501` | `task.updated` / none |
| `DELETE /api/workspace/tasks/:taskId` | `401` (`400` bad id) | `403` | `TD` only (requester/PM are not substitutes) | `200 {task}`; repeat is idempotent `200` | `404`, `501` | `task.archived` first write only / none |
| `PATCH /api/workspace/projects/:projectId/tasks/:taskId/status` | `401` (`400` bad id) | `403` | (`PR` or `PM`) and then (`PM` or PART transition role) | `200 {task}`; status/progress read back | `400 task_status_not_found`, `404`, `409 transition/acceptance/conflict`, `501` | `task.status_changed` / none |
| `POST /api/workspace/tasks/:taskId/comments` | `401` (`400` bad id) | `403` | `PR` and (any PART or TE/PM/requester edit basis) | `201 {activity}`; same `clientRequestId`+body replays same activity | `400`, `404`, `409 idempotency_key_conflict`, `501` | `task.comment_created` once per keyed intent / none |
| `GET /api/workspace/task-statuses` | `401` | `403` | `PR` | `200 {taskStatuses}` tenant list | `501` | none / none |
| `POST /api/workspace/task-statuses` | `401`; malformed body after auth -> `400` | valid body `403`; malformed -> `400` | `TS` | `201 {taskStatus}` | `400`, specific `409` id/name/sort conflict, `501` | `task_status.created` / none |
| `PATCH /api/workspace/task-statuses/:statusId` | `401` (`400` bad id) | valid body `403`; malformed -> `400` | `TS` | `200 {taskStatus}` | `404`; `409` system archive/category lock; unique collision currently `500`; `501` | `task_status.updated` / none |
| `DELETE /api/workspace/task-statuses/:statusId` | `401` (`400` bad id) | `403` | `TS` | `200`; archived repeat returns existing row | `404`, `409 system_task_status_required`, `501` | `task_status.archived` first write only / none |

Task create's effective `PP+RM` requirement comes from `permissionForCommand`: a `task.create` containing assignments first requires project-plan manage, then resource manage (`planningCommandPermissions.ts:17-30`). Existing DB test explicitly covers missing resource permission (`projectWorkRoutes.db.test.ts:509-540`).

### Project intake and activation

| Method / endpoint | `ANON` | `NONE` | Minimum allowed profile | Success / expected data | Other expected errors | Audit on success / denied |
|---|---|---|---|---|---|---|
| `GET /api/workspace/opportunities` | `401` | `403` | `OR` | `200 {opportunities}` tenant list | `501` | none / none |
| `GET /api/workspace/opportunities/:opportunityId` | `401` (`400` bad id) | `403` | `OR` | `200 {opportunity}` | `404 opportunity_not_found`, `501` | none / none |
| `POST /api/workspace/opportunities` | `401` after same-origin gate | `403` before body parse | `OM` | `201 {opportunity}` | `400` parse/link/custom-field/demand; `409 opportunity_id_taken`; `501`; unknown valid-format position is silently rewritten and still `201` | `opportunity.created` / `opportunity.create_denied` |
| `PATCH /api/workspace/opportunities/:id` | `401` (`400` bad id) | `403` before body parse | `OM` | `200 {opportunity}`; feasibility fields reset by repository | `404`; `409 opportunity_update_locked` or stage rule; `422` stage conditions; unknown position currently `500`; `501` | `opportunity.updated` / `opportunity.update_denied` |
| `PATCH /api/workspace/opportunities/:id/stage` | `401` (`400` bad id) | `403` | `OM` | `200`; same stage is no-op `200` without new audit | `404 opportunity/stage`; `409` final/forbidden/cross-pipeline/race; `422 condition_probability|condition_feasibility`; `501` | `opportunity.stage_updated` / `opportunity.stage_update_denied` |
| `PATCH /api/workspace/opportunities/:id/pipeline` | `401` (`400` bad id) | `403` | `OM` | `200`; exact same pair is no-op | `404 opportunity/pipeline/stage`; `409 cross_pipeline_move` or domain/finalization race; `501` | `opportunity.pipeline_changed` / `opportunity.pipeline_update_denied` |
| `PATCH /api/workspace/opportunities/:id/finalize` | `401` (`400` bad id) | `403` | `OM` | `200`; status `won_closed` or `lost_rejected` | `404`, `409 opportunity_final_action_locked`, `501` | `opportunity.won_closed` / `opportunity.lost_rejected`; denied `opportunity.final_action_denied` |
| `POST /api/workspace/opportunities/:id/feasibility` | `401` (`400` bad id) | `403` | `RF + OM` | `200 {opportunity,assessment}`; status becomes ready_to_activate or feasibility | `404`; `409 opportunity_not_feasible`; `501` | `opportunity.feasibility_checked` / `opportunity.feasibility_denied` |
| `POST /api/workspace/opportunities/:id/activate` | `401` (`400` bad id) | `403` | `PA + PM` (OM/RF not required here) | `201 {project}` active; source opportunity becomes won_closed | `400 feasibility_required`/parser; `404`; `409 not activatable/risk required/single-use`; project id collision currently `500`; `501` | `project.activated` / `project.activation_denied` |
| `GET /api/workspace/projects` | `401` | `403` | `PR` | `200 {projects}` filtered to `status === active` | `501` | none / none |

Fixture role evidence: `app.db.test.ts:24-100` defines an Administrator with all Phase-3 permissions and a Reader with only `tenant.users.read`; the focused permission test asserts `403` for opportunity/project reads and create/feasibility/activation/finalize and confirms denied audit events (`app.db.test.ts:1244-1392`). Project-work fixture profiles are explicit at `projectWorkRoutes.db.test.ts:20-66`.

## Persistence, readback and tenant isolation

### Tenant boundary

- `listOpportunities` and `findOpportunityById` use `WHERE opportunities.tenant_id = tenantId`; detail additionally matches id (`projectIntakeRepository.ts:217-246`).
- `listProjects` uses `WHERE projects.tenant_id = tenantId` (`projectIntakeRepository.ts:482-495`); API additionally filters active status (`projectIntakeRoutes.ts:269-281`).
- Project draft source lookup, activation project lookup and source opportunity update all include tenant id (`projectIntakeRepository.ts:576-589,639-688`).
- Task list/detail/my-work and participant/status joins are tenant-qualified (`projectWorkRepository.ts:221-232,358-439`).
- My Work intentionally includes only `executor` / `co_executor`, not requester (`projectWorkRepository.ts:380-416`); repository DB test confirms requester exclusion (`projectWorkRepository.db.test.ts:171-200`).
- Cross-tenant repository readback is executable evidence: opportunities/projects exist for alpha and return `[]` for beta (`repositories.db.test.ts:391-451`).

No route accepts a caller-controlled tenant id. Because repository miss is returned as `*_not_found`, an actor with valid permission in tenant B probing tenant A's id receives `404`; this avoids existence disclosure.

### Project intake write/readback

- Create/update/stage/pipeline/finalize/feasibility append audit through the transaction-scoped data source; failed transaction rolls back entity and audit.
- Activation takes tenant resource-planning lock, rereads opportunity, recomputes feasibility, creates draft, activates it, finalizes source opportunity and writes audit inside one outer transaction (`activateProjectCommand.ts:27-123`).
- Repository activation performs conditional update of a non-final source opportunity before changing draft -> active (`projectIntakeRepository.ts:636-693`). Unique `(tenant,sourceOpportunity)` prevents two projects per opportunity (`schema/projects.ts:61-64`).
- Focused API test verifies `201`, active project readback, source opportunity `won_closed`, `project.activated` audit with before draft/after active, and project-list readback (`app.db.test.ts:677-972`).
- Draft projects are deliberately hidden from `GET /api/workspace/projects`; focused DB test confirms empty list for a persisted draft (`app.db.test.ts:974-1026`).

### Project work write/readback

- Project/workspace task create uses one transaction for planning command, metadata, post-write `findTaskById`, plan version, audit and system activity (`taskCreateCommands.ts:67-174,202-312`).
- Task PATCH rereads under planning lock, checks `clientUpdatedAt`, applies planning commands, writes metadata, rereads task, increments plan version when needed, audits and appends system activity (`taskUpdateCommands.ts:41-155`).
- Status transition rereads active project/task/status under lock and reads updated task before audit/response (`taskLifecycleCommands.ts:125-267`).
- Archive is state-idempotent; only first write emits `task.archived`. Comment idempotency is scoped by tenant+actor+task surface and request hash (`taskCommentCommands.ts:28-103`).
- Full project-work DB suite confirms create -> project detail -> My Work -> activity/audit readback; permissions; task/status/comment idempotency; stale PATCH; participant status transitions (`projectWorkRoutes.db.test.ts:288-1995`).
- Task-status mutations and audit share a transaction; create maps id/name/sort unique conflicts to specific `409`, archive repeat returns the prior archived record and emits one audit (`taskStatusWorkspace.ts:95-278`; DB test `:802-1005`).

## Audit event inventory

| Flow | Success actionType | Denied actionType | Transactional with write? |
|---|---|---|---|
| Opportunity create | `opportunity.created` | `opportunity.create_denied` | success yes; denied standalone |
| Opportunity update | `opportunity.updated` | `opportunity.update_denied` | success yes; denied standalone |
| Stage / pipeline | `opportunity.stage_updated` / `opportunity.pipeline_changed` | `opportunity.stage_update_denied` / `opportunity.pipeline_update_denied` | success yes |
| Finalize | `opportunity.won_closed` or `opportunity.lost_rejected` | `opportunity.final_action_denied` | success yes |
| Feasibility | `opportunity.feasibility_checked` | `opportunity.feasibility_denied` | success yes |
| Activation | `project.activated` | `project.activation_denied` | success yes |
| Task create/update/archive/status/comment | `task.created`, `task.updated`, `task.archived`, `task.status_changed`, `task.comment_created` | none | success yes |
| Task-status create/update/archive | `task_status.created`, `task_status.updated`, `task_status.archived` | none | success yes |
| Read/list/detail routes | none | none | n/a |

Denied intake audit has `sourceWorkflow: crm_intake`, `executionResult.status: denied`, decision and error (`projectIntakeService/audit.ts:4-32`). Successful project-work audit uses `sourceWorkflow: project_work`; participant transition audit records authorization basis and participant role (`taskLifecycleCommands.ts:217-257`).

## Bugs and risks

### HIGH-1 — Unknown demand positions are silently reassigned and can be collapsed

Affected: `POST /api/workspace/opportunities`, downstream feasibility and activation.

Steps:

1. Tenant has real positions, for example `position-manager` and `position-engineer`.
2. Send a syntactically valid but nonexistent `demand.positionId`, for example `backend`.
3. Optionally send two different unknown ids with different required hours.
4. Read the created opportunity and run feasibility/activation.

Expected: `400 invalid_demand_position` (or explicit client-controlled mapping); no opportunity is persisted with changed business meaning.

Actual: service selects `positions[0]`, rewrites every unknown id to it, and drops later rows that collide after substitution; API returns `201`. Feasibility and activated project then use the substituted/collapsed demand.

Evidence:

- rewrite and post-rewrite dedupe: `projectIntakeService/createOpportunityCommand.ts:21-41,54-62`;
- parser only checks id syntax, not existence: `projectIntakeParsers.ts:277-304`;
- executable regression explicitly expects `201` and `backend -> position-engineer`: `crmActivityRoutes.db.test.ts:638-672`; focused run passed `1/1`.

Severity rationale: authorization holds, but resource forecast, feasibility and project staffing can be attached to the wrong position without caller visibility.

### MEDIUM-1 — Opportunity update handles the same unknown demand id as an internal error

Affected: `PATCH /api/workspace/opportunities/:id`.

Steps:

1. Create a valid non-final opportunity.
2. PATCH it with a valid-format, nonexistent `demand.positionId`.

Expected: stable `400 invalid_demand_position`, consistent with reference validation.

Actual: update path does not call the create normalization or validate positions; repository deletes old demand and inserts the unknown position. Composite FK `opportunity_demands_position_fk` fails, error is not mapped, global error handler returns `500 internal_error`. Outer transaction should roll back the opportunity update and demand delete.

Evidence: no demand validation between input and repository (`updateOpportunityCommand.ts:50-84`); raw demand insert (`projectIntakeRepository.ts:332-404`); FK (`schema/crm.ts:415-438`); generic uncaught mapping (`appErrors.ts:14-26`). Existing tests do not exercise this update case.

### MEDIUM-2 — Workspace-inbox task duplicate id returns 500, unlike project task create

Affected: `POST /api/workspace/tasks` with client-supplied id.

Steps:

1. Create workspace task with id `task-x` -> `201`.
2. Repeat the same request/id.

Expected: `409 task_id_taken`, matching `POST /projects/:projectId/tasks`.

Actual: `createWorkspaceInboxTask` has no `try/catch taskCreateConflict`; task PK violation escapes to `500 internal_error`. Transaction rolls back second audit/activity, so data remains single-row but HTTP contract is unstable.

Evidence: workspace command has no catch (`taskCreateCommands.ts:49-175`); project command maps the same conflict (`:202-319`); app fallback is 500 (`appErrors.ts:14-26`). Project-work DB suite covers duplicate project task but only unique workspace task ids (`projectWorkRoutes.db.test.ts:409-642`).

### MEDIUM-3 — Activation project-id collision and task-status PATCH uniqueness collision return 500

Affected:

- `POST /api/workspace/opportunities/:id/activate` with id already used by another project in the same tenant;
- `PATCH /api/workspace/task-statuses/:id` changing name/sortOrder to another status's unique value.

Steps A:

1. Persist project `(tenant-alpha, project-x)`.
2. Activate a different feasible opportunity with body `{ "id": "project-x" }`.

Expected: `409 project_id_taken` or equivalent stable conflict.

Actual: `projects_pkey` violation is not included in `isSingleUseActivationError`; it escapes to `500 internal_error` and activation transaction rolls back.

Steps B:

1. Create active statuses A and B with distinct name/sortOrder.
2. PATCH B to A's name or sortOrder.

Expected: `409 task_status_name_taken` / `task_status_sort_order_taken`, same as create.

Actual: create has unique-error catch, update does not; database `23505` escapes to `500 internal_error` and transaction rolls back.

Evidence A: caller-supplied project id accepted (`projectIntakeParsers.ts:215-233`); PK `(tenantId,id)` (`schema/projects.ts:42-45`); activation catch only recognizes source/single-use markers (`activateProjectCommand.ts:123-132`; `activationErrors.ts:1-10`).

Evidence B: unique indexes (`schema/tasks.ts:34-43`); repository update has no precheck (`projectWorkRepository.ts:322-338`); only create is wrapped in conflict mapper (`taskStatusWorkspace.ts:95-141` vs `:144-215`).

### LOW-1 — Project-work denied mutations have no management audit

Steps:

1. Login with `tenant.projects.read` but without task create/edit/delete or task-status manage.
2. Submit valid same-origin task/task-status mutation.
3. Query tenant audit events as an administrator.

Expected (inferred from intake security behavior): denied write attempt with actor, entity, decision and error.

Actual: route/service returns `403`, but project-work preflights and task-status permissions do not call `appendManagementAuditEvent`. Intake mutation authorization does (`projectIntakeService/authorization.ts:36-45,159-191,224-256`). Existing tests assert project-work denial response but not denied event (`projectWorkRoutes.db.test.ts:802-917,1964-1995`).

This is an auditability gap, not an authorization bypass. Whether it is a product bug depends on the formal audit policy.

## Positive findings

- No cross-tenant data leak found in route/service/repository path. Every object lookup is tenant-scoped; repository DB tests prove alpha records are absent from beta reads.
- Active-project visibility is consistent for list and project detail: drafts are filtered/404. Cross-tenant and inactive project probes are non-enumerating `404` after permission.
- Activation is the strongest flow in scope: resource lock, in-transaction reread, feasibility recomputation, single-source uniqueness, source finalization, project activation and audit are atomic.
- Task PATCH uses optimistic `clientUpdatedAt` and lock-protected reread; DB tests cover stale/concurrent writes.
- Task status transition combines tenant permission and participant role correctly; observer is denied, executor/requester/controller paths are bounded, acceptance-required completion is guarded.
- Comment idempotency checks request hash; same key/different body returns `409` rather than silently dropping content.
- Project task create, task-status create and archive paths have executable conflict/idempotency coverage.
- Response cache policy is `no-store, private`; focused intake test asserts it for opportunities/projects (`app.db.test.ts:969-971`).

## Doubts / assumptions

1. The unknown-demand substitution is deliberately preserved by `BUG-CRM-05` regression. I still classify it HIGH because a transport/UI workaround silently changes persisted staffing demand; product owners may instead consider this temporary compatibility policy.
2. No repository-wide audit policy was found requiring denied audit for every mutation. Intake clearly implements it, project-work does not; LOW-1 is therefore an evidence-backed parity/risk finding, not a claimed violated written requirement.
3. `501 persistence_not_configured` paths mainly support partial/in-memory data sources. Production uses a complete PostgreSQL data source, but route contracts expose these statuses and they are included.
4. Static `500` findings follow deterministic constraints -> uncaught error -> `appErrors` mapping. They were not dynamically reproduced because this lane could not add temporary/new test files and existing suites do not contain those exact cases.

## Unverified zones

- No new exploit/repro tests were written; the three uncaught-constraint `500` cases are static path proofs, not captured HTTP responses.
- Cross-tenant HTTP calls for every individual endpoint were not exhaustively run with two logged-in tenants. Repository predicates and focused alpha/beta readback were verified.
- Attachment authorization/storage behavior inside task detail/activity was not audited beyond confirming task/tenant-scoped lookup and optional attachment serialization.
- Full app DB suite was not run; only three target scenarios. Full project-work DB suite was run.
- Trusted Origin permutations, cookie flags and session lifecycle were outside scope; only same-origin mutation gate precedence was inspected and the existing project-work test for the header passed.
- Pipeline transition domain rules were inspected for HTTP mapping but not exhaustively enumerated across every stage-rule combination.

## Evidence references

- Route inventory: `apps/api/src/projectWorkRoutes.ts:35-328`, `project-work/taskStatusRoutes.ts:9-88`, `projectIntakeRoutes.ts:41-283`.
- Permission model: `packages/access-control/src/index.ts:71-89,103-108,143-170,175-193`.
- Project read behavior: `project-work/taskReadWorkspace.ts:68-216`.
- Task authorization: `project-work/taskCommandGuards.ts:20-165`, `taskPreflightGuards.ts:16-123`, `taskCreateSupport.ts:54-110`.
- Intake authorization: `projectIntakeService/authorization.ts:14-259`, `finalizeOpportunityAuthorization.ts:9-46`, `updateOpportunityAuthorization.ts:9-50`.
- Tenant repositories: `projectIntakeRepository.ts:217-246,482-495,569-695`; `projectWorkRepository.ts:221-232,293-439`.
- Executable API evidence: `projectWorkRoutes.db.test.ts:235-1995`, `app.db.test.ts:677-1392`, `crmActivityRoutes.db.test.ts:638-672`.
- Executable persistence evidence: `repositories.db.test.ts:260-452`, `projectWorkRepository.db.test.ts:91-320`.

## CodeGraph change index

- Product files touched: **none**.
- Report added: `E:\KISS-PM\.superloopy\evidence\projects-2026-07-10\lane-02-api-permissions.md`.
- Symbols added/changed/removed: **none** (Markdown evidence only).
- Baseline CodeGraph: **2,176 files / 24,132 nodes / 52,137 edges**.
- Final CodeGraph after `codegraph sync`: **2,176 files / 24,132 nodes / 52,149 edges**. Nodes unchanged; the +12 edge delta appeared while other lanes were active in the shared worktree. This lane changed no source symbol, and the Markdown report is not an indexed source node.

SUPERLOOPY_EVIDENCE: E:\KISS-PM\.superloopy\evidence\projects-2026-07-10\lane-02-api-permissions.md
