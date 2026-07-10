# Schedule backend/API/data-state audit

Date: 2026-07-10
Scope: Schedule live screen, its planning write/read path, supporting project/resource lookups, and the separate scheduled-task aggregate. Source and tests only; no product, test, matrix, or persistent shared-data edits.

## Findings first

### F1 - HIGH - Planning can read and mutate non-active projects

**Confirmed defect.** The regular project/task API treats only `status === "active"` as addressable (`apps/api/src/project-work/taskCommandGuards.ts:20-26`, `apps/api/src/project-work/taskReadWorkspace.ts:209-215`). Planning does not preserve that lifecycle invariant:

- `getPlanSnapshot` selects by `(tenantId, projectId)` without a status predicate (`packages/persistence/src/planningRepository.ts:196-202`).
- Read-model, preview, single apply, and batch apply trust that snapshot (`apps/api/src/planning/registerPlanningRoutes.ts:95-106,141-170,258-341,454-545`).
- Therefore a paused/closed/cancelled/draft project with a snapshot is returned as `200`, and authorized commands can be committed. The Schedule header's separate active-only project-detail request can fail to its neutral fallback while planning data remains editable (`apps/web/src/delivery/lib/project-chrome.ts:44-75`).

**Minimum safe fix:** enforce active project state in the transactional planning data port, ideally `getActivePlanSnapshot`, and re-check after acquiring the planning lock. Return one stable lifecycle code (`404 project_not_found` if existence must be hidden, otherwise `409 project_not_active`). Add DB-route tests for draft, paused, closed, and cancelled read/preview/apply/batch.

### F2 - HIGH - A post-write readback failure commits and then returns 404

**Confirmed transactionality defect.** Single and batch apply mutate rows, increment version, append audit, then read the snapshot back. If that final read returns missing, the transaction callback returns `{ ok:false, status:404 }` rather than throwing (`apps/api/src/planning/registerPlanningRoutes.ts:301-328,501-532`). Drizzle commits a callback that resolves normally (`packages/persistence/src/repositories.ts:740-747`), so the route can commit changes and answer `404 project_not_found`.

The normal PostgreSQL repository should usually read its own writes, so this is a low-frequency failure path, but its semantics are unsafe and directly violate error-response atomicity.

**Minimum safe fix:** after the first mutation, every failure path must abort the transaction. Throw a typed rollback sentinel for missing post-write snapshot, catch/map it outside `withTransaction`, or restructure so the callback can return a non-success result only before any write. Add a fault-injected transaction test proving task/version/audit/idempotency all roll back when post-write readback fails.

### F3 - MEDIUM - Schedule write affordances do not match resource-command RBAC

**Confirmed UI/API defect.** The screen uses only `tenant.project_plan.manage` to expose every write control (`apps/web/src/delivery/schedule/schedule-surface.tsx:34-42,174-178`). Backend authorization is command-specific:

- Normal task/schedule/dependency commands require `tenant.project_plan.manage`.
- `assignment.upsert/delete/allocations.replace` and `resource.reserve` require `tenant.project_resources.manage`.
- `task.create` with embedded assignments requires both (`apps/api/src/planning/planningCommandPermissions.ts:10-35`).

Schedule nevertheless shows `ResourceEditor` under `canManagePlan` and emits `assignment.upsert` (`schedule-surface.tsx:667-670,748-760,1251-1255`). Work/duration edits on an already assigned task also bundle `assignment.upsert` with `task.update_work_model` (`schedule-surface.tsx:633-665`), so a valid plan manager without resource-manage permission can be blocked from an otherwise plan-scoped edit.

Existing UI tests explicitly treat plan-manage alone as full write access (`schedule-permission-worker09.test.tsx:66-79`, `schedule-productivity-ui.test.tsx:66-75`), while the DB route test proves assignment creation is denied for that profile (`apps/api/src/planningRoutes.db.test.ts:906-969`).

**Minimum safe fix:** derive separate `canManagePlan` and `canManageResources`; hide/disable resource assignment controls without the latter. Do not append assignment synchronization to plan-only work edits unless the actor can manage resources; alternatively make the entire affected edit explicitly require both permissions. Add a UI-to-client command test for a plan-manager/no-resource-manager profile.

### F4 - MEDIUM - The resource picker depends on an unrelated broader permission

**Confirmed integration defect.** Live Schedule loads assignee choices from `GET /api/workspace/users` (`apps/web/src/delivery/lib/planning-client.ts:100-123`; `use-resource-directory.ts:25-48`). That endpoint requires `tenant.users.read` (`apps/api/src/workspaceUserRoutes.ts:27-44`), while assignment mutation requires `tenant.project_resources.manage`. A resource manager can therefore be authorized to assign resources but receive an empty picker. The planning DB fixture demonstrates exactly such a profile: project resource read/manage without tenant user read (`apps/api/src/planningRoutes.db.test.ts:63-71`). All directory errors are swallowed into `[]` (`planning-client.ts:106-122`).

**Minimum safe fix:** add a planning-scoped resource-directory endpoint guarded by `project_resources.read/manage`, returning only fields needed by planning; use it in Schedule. Keep `/workspace/users` for tenant-user administration.

### F5 - MEDIUM - Mutation and session errors reach the UI as raw backend codes

**Confirmed error-mapping defect.** `usePlanning` gives special behavior only to load `403`, `plan_version_conflict`, and `validationIssues`; other mutation errors use `PlanningApiError.message`, which is the raw code (`packages/planning-client/src/api/planningApiClient.ts:10-21,51-56`; `apps/web/src/delivery/lib/use-planning.ts:64-73,107-120,145-158`). Schedule then displays `Отклонено: permission_missing`, `idempotency_key_conflict`, or `persistence_not_configured` (`schedule-surface.tsx:514-548,718-731`). Load mapping also lacks `session_required`, `persistence_not_configured`, and body/transport status distinctions (`project-chrome.ts:78-92`).

**Minimum safe fix:** centralize `PlanningApiError.code -> user-facing message/state`; map `401` to auth/session handling, `403` to forbidden, `404` to not-found, `409` conflict/precondition/idempotency separately, `501` to service unavailable. Preserve codes for telemetry, not visible text. Add hook/UI tests for every server code in the matrix below.

## Endpoint map

### Endpoints actually used by the live Schedule screen

| Endpoint | Purpose | Direct caller |
|---|---|---|
| `GET /api/workspace/projects/:projectId/planning/read-model` | Authoritative plan snapshot + calculated plan + version | `planningApiClient.ts:62-65`, `use-planning.ts:57-74` |
| `POST .../planning/preview-command` | Server preview for one command; no persistence | `planningApiClient.ts:67-79`, `use-planning.ts:88-103` |
| `POST .../planning/preview-command-batch` | Cumulative preview for a non-empty batch; no persistence | `planningApiClient.ts:81-85`, `use-planning.ts:125-141` |
| `POST .../planning/apply-command` | Transactional single command | `planningApiClient.ts:87-91`, `use-planning.ts:103-106` |
| `POST .../planning/apply-command-batch` | Transactional atomic batch | `planningApiClient.ts:93-97`, `use-planning.ts:137-144` |
| `GET /api/workspace/projects/:projectId` | Active project title/header only | `project-chrome.ts:39-75` |
| `GET /api/workspace/users` | Resource picker directory | `planning-client.ts:100-123`, `use-resource-directory.ts:25-48` |

`usePlanning` also exposes revert/scenario/commit methods, but `ProjectSchedule` destructures only `readModel`, `setReadModel`, `status`, `error`, `reload`, `apply`, and `applyBatch` (`schedule-surface.tsx:174-180`). Revert/scenario/audit-history endpoints are therefore outside the executed Schedule surface path.

### Separate scheduled-task aggregate

`GET /api/tenant/current/scheduled-tasks?assigneeUserId&fromDate&toDate` is registered and documented, but no Schedule screen source calls it. It is a read-only tenant aggregate (`apps/api/src/scheduledTasksRoutes.ts:14-58`; OpenAPI entry `apps/api/src/apiDocs/openApiDocument.ts:260`). It is audited here because its name overlaps Schedule and it represents scheduled work state.

## Endpoint x role x state matrix

Role keys are permission sets, not assumed job titles:

- `Anon`: no session.
- `PlanReader`: `tenant.project_plan.read` (resource exceptions included only with project-resource read/manage).
- `PlanManager`: plan read + `tenant.project_plan.manage`, no resource manage.
- `ResourceManager`: plan read + `tenant.project_resources.manage`, no plan manage.
- `Admin`: seeded tenant admin, all relevant permissions.
- `NoPlanRead`: session without `tenant.project_plan.read`.
- `ProjectsReader`: `tenant.projects.read` (used by project detail and scheduled-task aggregate).

| Endpoint/state | Anon | PlanReader | PlanManager | ResourceManager | Admin / exact evidence |
|---|---|---|---|---|---|
| planning read-model, valid active project | `401 session_required` | `200` read-only; personal resource exceptions masked unless resource read/manage | `200` | `200` | `registerPlanningRoutes.ts:81-106`; plan-only reader DB evidence `planningRoutes.db.test.ts:258-331,2461-2473` |
| planning read-model, no plan-read | `401` | n/a | if manage-only: `403 permission_missing` | if no plan-read: `403` | Permission is independent and explicit (`planningRouteAuth.ts:10-18`) |
| planning read-model, malformed project id | `400 invalid_project_id` before auth | same | same | same | `app.test.ts:2986-3016` |
| planning read-model, absent/cross-tenant id | `401` | `404 project_not_found` after permission | `404` | `404` | Tenant is always actor tenant; lookup at `registerPlanningRoutes.ts:91-96` |
| planning read-model, inactive project | `401` | **currently `200`** | **currently `200`** | **currently `200`** | F1: repository does not filter lifecycle (`planningRepository.ts:196-202`) |
| preview single/batch, allowed plan-only command | `401` | `403 permission_missing` | `200` preview | `403` | Read permission checked first, command permission second (`registerPlanningRoutes.ts:119-150`; `planningBatchPreviewRoute.ts:39-95`) |
| preview assignment/resource command | `401` | `403` | `403` without resource-manage | `200` | Command split at `planningCommandPermissions.ts:16-35` |
| preview stale version | `401` | permission outcome first | `409 plan_version_conflict` | command-dependent | Single `registerPlanningRoutes.ts:141-145`; batch `planningBatchPreviewRoute.ts:71-83` |
| preview blocking domain/data validation | `401` | permission outcome first | `200` with `validationIssues`; `planVersionAfter` unchanged | command-dependent | Single lines 149-171; batch lines 86-115. UI disables confirmation (`planning-preview-gate.tsx:67-68,96-125`) |
| apply single/batch, allowed command | `401` | `403` | `200` for plan commands | `200` for resource commands | Single `registerPlanningRoutes.ts:175-367`; batch `:369-564` |
| apply malformed body/command/version | `401` after route-id parsing | authenticated: `400` (`planning_command_invalid` or parser's `plan_version_conflict`) | same | same | `planningParsers.ts:52-90,439-461`; body layer also yields `400/413/415` (`jsonBody.ts:24-65`) |
| apply missing persistence capability | `401` | permission may deny first | allowed role: `501 persistence_not_configured` | same | Single `:181-229`; batch `:375-425` |
| apply missing project | `401` | permission may deny first | `404 project_not_found` | command-dependent | Single `:258-260`; batch `:454-456` |
| apply stale version | `401` | permission may deny first | `409 plan_version_conflict` + current version; conflict audit committed | command-dependent | Single `:260-278`; batch `:456-476`; sequential DB evidence `planningRoutes.db.test.ts:1947-1971` |
| apply blocking precondition | `401` | permission may deny first | `409 planning_precondition_failed` + issues; no command/version mutation | command-dependent | Single `:281-299`; batch `:479-499`; no-mutation DB evidence `planningRoutes.db.test.ts:1603-1851,2336-2396` |
| same idempotency key + same actor/hash | `401` | permission may deny first | stored `200` response replayed | command-dependent | Single `:242-256`; batch `:437-451`; concurrent DB evidence `planningRoutes.db.test.ts:1974-2204` |
| same idempotency key + different actor/hash | `401` | permission may deny first | `409 idempotency_key_conflict` | command-dependent | Same source; explicit DB assertions `planningRoutes.db.test.ts:2102-2120,2182-2203` |
| `GET /workspace/projects/:id`, active | `401` | requires `tenant.projects.read`, independent of plan-read | same | same | `projectWorkRoutes.ts:45-60`; `taskReadWorkspace.ts:68-94` |
| `GET /workspace/projects/:id`, inactive/missing | `401` | ProjectsReader: `404 project_not_found` | same | same | Active-only lookup `taskReadWorkspace.ts:83-88,209-215` |
| `GET /workspace/users` | `401` | requires `tenant.users.read`, not plan/resource permission | same | same | `workspaceUserRoutes.ts:27-44`; empty repository result serializes as `{users:[]}` |
| `GET /scheduled-tasks`, valid query | `401` | role irrelevant; requires `tenant.projects.read` | role irrelevant | role irrelevant | `scheduledTasksRoutes.ts:23-43`; authorized result is always `200 {tasks:[...]}` |
| `/scheduled-tasks`, malformed/missing/reversed/>370-day query | **`400 scheduled_tasks_invalid` before auth** | same | same | same | `scheduledTasksRoutes.ts:16-21,61-95`; executed test `app.test.ts:3080-3100` |
| `/scheduled-tasks`, unknown assignee / no overlaps | `401` without session | ProjectsReader: `200 {tasks:[]}`; no assignee 404 | same | same | Repository naturally returns empty (`projectWorkRepository.ts:235-291`) |

## Validation and state semantics

### Planning envelopes

- Route IDs are parsed before auth; malformed IDs return `400 invalid_project_id` (`registerPlanningRoutes.ts:82-86,110-114,176-180,370-374`).
- Bodies are capped at 64 KiB, require JSON media type, and distinguish `400 invalid_json/invalid_content_length`, `413 payload_too_large`, and `415 unsupported_media_type` (`jsonBody.ts:1-65`).
- `clientPlanVersion` must be a positive integer. An invalid/missing value is currently labelled `plan_version_conflict` but returned with HTTP 400 (`planningParsers.ts:439-450`).
- Batch must be non-empty, but has no explicit command-count ceiling; only the byte cap bounds it (`planningParsers.ts:68-90`).
- Idempotency keys are optional, trimmed, 1-120 chars, `[A-Za-z0-9._:-]+` (`planningParsers.ts:455-461`).
- Command variants are strictly parsed. Tests cover all variants, unknown/incomplete payloads, control characters, unsafe custom-field keys, impossible dates, and idempotency format (`planningParsers.test.ts:10-215`).
- Engine validation and data-source preconditions cover dependency/domain rules plus active status/resource existence. Unknown `task.create.statusId` is intentionally normalized to the tenant initial status; other status references and inactive/unknown resources are blocking (`planningRouteHelpers.ts:157-229`; normalization DB test `planningRoutes.db.test.ts:974-1023`).

### Scheduled-task query

- `assigneeUserId` must pass the shared user-id parser.
- Dates must be real strict `YYYY-MM-DD`, inclusive range, `to >= from`, maximum 370 days (`scheduledTasksRoutes.ts:61-95`).
- Result includes non-archived tasks whose authored date interval overlaps the query and where the assignee is owner or has an assignment. Assignment task IDs are deduplicated before the task query (`projectWorkRepository.ts:235-279`).
- Ordering is deterministic by `task.createdAt`, then `task.id`; hard limit is 50. There is no pagination token, total, or truncation marker (`scheduledTasksRoutes.ts:37-43`; repository lines 278-279).
- Project lifecycle is not filtered, so tasks from non-active projects can appear if not archived. This is a contract risk aligned with F1, but consumer intent for historical schedules is not documented.

## Transactionality, persistence, duplicates, and races

- Single and batch apply execute through `dataSource.withTransaction`, backed by `db.transaction` (`apps/api/src/app.ts:186-194`; `packages/persistence/src/repositories.ts:740-747`).
- Both acquire `pg_advisory_xact_lock(hashtext(tenantId), hashtext('kiss_pm_resource_planning'))` before idempotency/version checks (`repositories.ts:749-755`; routes `:233-234,428-429`). This serializes all planning writes per tenant, broader than per-project but race-safe.
- Success transaction contents: command row mutations -> one plan-version increment -> audit -> authoritative snapshot readback -> notifications -> optional idempotency response record (`registerPlanningRoutes.ts:301-355,501-557`). Plan-version event emission occurs after transaction completion (`:359-366,560-563`).
- Batch preview is cumulative and non-mutating; batch apply validates the cumulative result before executing any command (`planningBatchPreviewRoute.ts:86-116`; `registerPlanningRoutes.ts:479-508`).
- Idempotency primary key is `(tenant_id, project_id, idempotency_key)` (`packages/persistence/src/schema/planning.ts:675-705`). Hash includes actor, client version, and command(s), preventing cross-actor/payload reuse (`registerPlanningRoutes.ts:234-256,429-451`).
- Fresh DB tests in source cover concurrent identical single schedule updates, baseline capture, and batches; both callers receive the same `200` body and version advances once (`planningRoutes.db.test.ts:1974-2204`).
- Without an idempotency key, the advisory lock + optimistic version makes concurrent same-version writers deterministic: first commits, later writer sees `409`. There is no explicit concurrent-distinct-key test.
- Scheduled-task reads are not transactional and have no duplicate response rows because assignment IDs are collapsed to a task-ID set. They read only committed PostgreSQL state under normal isolation.

## Persistence/readback and empty data

- A successful apply response is constructed from a fresh repository snapshot, not from the preview's in-memory snapshot (`registerPlanningRoutes.ts:327-342,531-546`). DB tests then issue a separate GET and verify persisted dates/version after concurrent `task.update_schedule` (`planningRoutes.db.test.ts:2167-2180`).
- Planning read-model preserves empty authored arrays and derives calculated/resource/baseline structures from the snapshot (`planningReadModel.ts:54-95`). UI row mapping has empty-task fixtures (`apps/web/src/delivery/schedule/schedule-rows.test.ts:90-113`), but there is no end-to-end API -> `ProjectSchedule` empty-plan test.
- `/scheduled-tasks` naturally returns `{tasks:[]}` for unknown assignee, no assignment/ownership, or no date overlap, but no route/repository test asserts this.
- `/workspace/users` naturally returns `{users:[]}`; Schedule silently converts any error to the same empty directory, so empty-authorized and forbidden/unavailable are indistinguishable (`planning-client.ts:106-122`).

## Error code -> Schedule UI mapping

| Backend response | `usePlanning` behavior | Visible Schedule behavior | Status |
|---|---|---|---|
| load `403 permission_missing` | `status="forbidden"` | Forbidden surface; RU text via `planningErr` | Correct |
| load `404 project_not_found` | `status="error"`, code retained | Error surface with RU not-found text | Correct, though distinct not-found state is absent |
| load `401 session_required` | generic error | Raw `session_required` + retry | Missing mapping (F5) |
| load `501 persistence_not_configured` | generic error | Raw code + retry | Missing mapping (F5) |
| apply `409 plan_version_conflict` | reload authoritative model; `{conflict:true}` | RU conflict toast | Correct |
| apply `409 planning_precondition_failed` + issues | issues extracted | first server issue in toast; entity issues stored inline | Correct |
| apply `403 permission_missing` | generic `{message: raw code}` | `Отклонено: permission_missing` | Defect (F3/F5) |
| apply `409 idempotency_key_conflict` | generic raw code | raw code toast | Defect (F5) |
| apply `404 project_not_found` / `501 persistence_not_configured` / transport failure | generic raw message | raw code/message toast; no surface transition | Missing mapping/recovery policy |
| resource directory `401/403/501/network` | caught and replaced with `[]` | empty picker / anonymized existing IDs | Defect (F4), failure indistinguishable from empty |

## Missing tests and minimum additions

1. **Inactive lifecycle:** no read/preview/apply/batch tests for draft/paused/closed/cancelled. Add DB route cases and assert no task/version/audit/idempotency mutation.
2. **Post-write rollback:** no fault-injected readback disappearance test. Add a transactional fake or DB hook that fails the second `getPlanSnapshot`; assert rollback and non-2xx mapping.
3. **Schedule permission parity:** no UI/client test for plan-manage without resource-manage, or resource-manage without user-read. Assert controls and emitted commands match backend capabilities.
4. **Error mapping:** no `usePlanning` tests for 401/403/404/409-idempotency/501/invalid JSON/network on load and mutation. Assert user-facing text/state and retry/auth behavior.
5. **Scheduled-task route happy/RBAC/empty:** only malformed query is tested. Add anonymous-valid 401, projects-read deny 403, capability 501, owner hit, assignment hit, owner+assignment dedupe, overlap boundaries, archived exclusion, tenant isolation, empty/unknown assignee, exact 370-day acceptance, 371-day rejection, deterministic limit behavior.
6. **Scheduled-task persistence DB test:** `projectWorkRepository.db.test.ts` has no `listScheduledTasks` case. Add date overlap, duplicate assignment, project lifecycle decision, and null/zero work semantics.
7. **Planning not-found matrix:** malformed IDs are covered, but explicit 404 assertions per read/preview/apply/batch and no-existence leakage across permission roles are incomplete.
8. **Batch size:** parser has no explicit maximum command count. Add a product limit, reject over-limit before preview/permission loops, and test boundary values.
9. **Concurrent distinct requests:** same-key races are covered; add two same-version requests with different/no keys and assert exactly one success, one `409`, one version increment, one successful audit.
10. **Empty plan E2E:** add API read-model with zero tasks through Schedule rendering and first task creation/readback.
11. **Transaction side effects:** assert notifications, audit, version, command rows, and idempotency record roll back together on a mid-batch persistence exception.

## Verification performed

CodeGraph was synchronized before investigation. Initial index: 2,228 files, 24,825 nodes, 53,167 edges. Structural entry used `codegraph_context/search/explore/callees`; targeted `rg`/source reads were used only after identifying concrete files/symbols or for literal route/error/test strings.

Executed, non-destructive verification:

```text
pnpm vitest run \
  apps/api/src/planningParsers.test.ts \
  apps/api/src/planning/planningCommandPermissions.test.ts \
  apps/api/src/planning/planningBatchPreviewRoute.test.ts \
  packages/planning-client/src/api/planningApiClient.test.ts \
  apps/web/src/delivery/lib/planning-preview-gate.test.tsx \
  apps/web/src/delivery/schedule/schedule-permission-worker09.test.tsx \
  apps/web/src/delivery/schedule/schedule-productivity-ui.test.tsx

Result: 7 files passed, 15 tests passed.

pnpm vitest run apps/api/src/app.test.ts \
  -t "rejects malformed scheduled-task query before session and persistence lookup"

Result: 1 passed, 56 skipped.
```

`planningRoutes.db.test.ts` and persistence DB suites were inspected but not executed: their setup/teardown performs destructive `TRUNCATE ... RESTART IDENTITY CASCADE` against `DATABASE_URL` (`planningRoutes.db.test.ts:243-255`). Running them would violate this lane's no-shared-data-mutation constraint without a proven disposable database. Their assertions are cited as existing test evidence, not claimed as freshly executed.

## Change index

- Report-only change: `.superloopy/evidence/schedule-closeout-2026-07-10/lane-api-data.md` added.
- Source symbols added/changed/removed: none.
- Product/test/matrix files changed: none.
- Persistent shared data changed: none.
- CodeGraph global index before -> post-sync checkpoints: files `2,228 -> 2,230`; nodes `24,825 -> 24,873` at the first final checkpoint and `24,875` at the last status read; edges `53,167 -> 53,260` and then `53,262`. This lane changed no source symbol; the moving global delta came from concurrent repository activity by other lanes and must not be attributed to this report-only change.

SUPERLOOPY_AUDIT: .superloopy/evidence/schedule-closeout-2026-07-10/lane-api-data.md
