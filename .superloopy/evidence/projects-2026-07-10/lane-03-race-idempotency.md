# Projects write-flow duplicate/race/idempotency matrix

Дата: 2026-07-10
Ветка: `codex/pre-prod-hardening-on-master`
Репозиторий: `E:\KISS-PM`
Режим: product files read-only; изменён только этот отчёт; production/browser side effects отсутствуют.

## Итог

Проверено 22 HTTP write-flow/семейства команд. Надёжный replay одного и того же успешного ответа есть только у:

- planning `apply-command` / `apply-command-batch` при переданном `idempotencyKey`;
- task comment при переданном `clientRequestId`;
- project closure retry, который возвращает уже созданную closure model;
- архивирования task/task-status как state-idempotent no-op после первого успеха.

Opportunity finalize, project activation, task PATCH и scenario/solver apply защищены от повторного side effect, но это **single-use**, а не replay-idempotency: retry после потерянного ответа получает `409`, а не исходный success. Opportunity update/stage/pipeline/feasibility, task-status definition update и planning revert допускают повторные side effects или last-writer-wins. Project task create безопасен только при стабильном client-supplied `id`; без `id` повтор создаёт вторую задачу.

## Точный scope

Включено:

- project intake: opportunity create/update/stage/pipeline/feasibility/finalize и activation opportunity -> project;
- active project lifecycle: closure/close;
- project work: workspace-inbox task create, project task create, task PATCH, archive, status transition, comment;
- task assignment: `participants` в task create/PATCH и planning `assignment.upsert` / `assignment.delete`;
- task-status definition create/update/archive;
- project-scoped planning mutations, способные менять task/assignment: single apply, batch apply, scenario apply (оба route alias), auto-solver proposal apply, revert-last;
- agent execution только как proxy: `agentRoutes.ts` dispatch-ит в те же project/task/planning routes и не образует отдельной transaction boundary.

Не включено:

- UI/browser behavior;
- project-adjacent Knowledge, Control, documents, meetings и retrospective lesson-only CRUD, не меняющие project/task/assignment lifecycle;
- fixes или product-file edits;
- planning preview/solver-run creation, потому что они не применяют task/assignment mutations;
- `.claude/worktrees/**` как дублированная копия, не текущая ветка.

Прямого `POST/PATCH /api/workspace/projects` для ручного project create/update не найдено. Реальный project create/activate выполняется только через `POST /api/workspace/opportunities/:id/activate`; поля будущего проекта меняются через opportunity update до activation. После activation core project write — closure/close.

## Метод и команды

1. Обязательный structural entry: `codegraph sync`, затем `codegraph_context`, `codegraph_files`, `codegraph_search`, два capped `codegraph_explore`; baseline index: 2,176 files / 24,132 nodes / 52,137 edges.
2. После получения точных путей использован `rg -n` только для literal HTTP routes, SQL constraints, conflict strings и test names.
3. Прочитаны command/service/repository/schema boundaries с line-numbered `Get-Content`.
4. Выполнен безопасный mock/unit набор без БД и сети:

```text
.\node_modules\.bin\vitest.cmd run \
  apps/api/src/projectIntakeService.test.ts \
  apps/api/src/projectIntakeParsers.test.ts \
  apps/api/src/projectWorkParsers.test.ts \
  apps/api/src/retrospectiveRoutes.test.ts \
  apps/api/src/planningParsers.test.ts \
  apps/api/src/planning/planningCommandCore.test.ts \
  apps/api/src/planningAutoSolverRoutes.test.ts
```

Результат: **7 files passed, 64 tests passed**, Vitest 3.2.6, duration 4.13s. Есть существующее esbuild warning: дублирующий `case "assignment.delete"` в `packages/domain/src/planning/commandReducer.ts:582`; к текущей lane не относится, product code не менялся.

Первый запуск через `pnpm vitest` не дошёл до тестов: wrapper попытался выполнить install и остановился с `ERR_PNPM_IGNORED_BUILDS`. Повтор через локальный Vitest в sandbox упал на `spawn EPERM`; тот же unit-only command вне sandbox прошёл.

DB suites **не запускались намеренно**. Они используют `DATABASE_URL` либо fallback `postgres://kiss_pm:...@127.0.0.1:55432/kiss_pm` и делают широкие `TRUNCATE ... CASCADE` в `beforeEach/afterAll` (`crmRoutes.db.test.ts:13-15, 104-115`; `projectWorkRoutes.db.test.ts:13-15, 220-239`). `DATABASE_URL` и `TEST_DATABASE_URL` в среде отсутствовали, поэтому запуск не был доказанно изолированным.

## Transaction/constraint evidence

- API transaction wrapper вызывает repository `withTransaction`; тот создаёт transaction-scoped data source: `packages/persistence/src/repositories.ts:740-747`.
- Planning-sensitive task/project flows могут брать tenant advisory xact lock `pg_advisory_xact_lock(hashtext(tenantId), hashtext('kiss_pm_resource_planning'))`: `repositories.ts:749-755`.
- Opportunity mutations и audit находятся в одной outer transaction; update/finalize SQL дополнительно фильтрует final statuses: `projectIntakeRepository.ts:306-480`.
- Activation: advisory lock, reread opportunity, create draft, conditional source finalization, activate draft и audit внутри одной transaction: `activateProjectCommand.ts:27-123`. Уникальность одного проекта на source opportunity: `schema/projects.ts:61-64`.
- Task create/update/archive/status and their audit/activity execute in one outer transaction. Project work create/update/status/archive additionally acquire planning lock: `taskCreateCommands.ts:67-174,203-312`; `taskUpdateCommands.ts:41-155`; `taskLifecycleCommands.ts:46-95,125-267`.
- Task PK is `(tenant_id,id)` plus redundant tenant/project/id unique: `schema/tasks.ts:97-125`. Task-status unique constraints cover id, tenant/name, tenant/sortOrder: `schema/tasks.ts:34-43`.
- Generic write-flow idempotency key PK is `(tenant,surface,actor,clientRequestId)`, with request hash: `schema/core.ts:165-188`; claim is `INSERT ... ON CONFLICT DO NOTHING` then hash compare: `repositories.ts:765-811`.
- Planning apply takes advisory lock before idempotency lookup/version check, applies mutation, increments planVersion, writes audit/notifications/idempotency response in one transaction: `registerPlanningRoutes.ts:210-355,408-555`.

## Exhaustive matrix

Legend: **PASS** = invariant is implemented and covered by executable or strong repository evidence; **PARTIAL** = data duplication is blocked but timeout replay is not success-equivalent or audit semantics are weak; **FAIL** = lost update/duplicate side effect/unstable HTTP failure is possible; **STATIC** = DB behavior was not re-executed in this lane.

| # | Write-flow / endpoint | Boundary and guard | Duplicate click | Concurrent same payload | Concurrent conflicting payload | Retry after timeout | Expected status/data invariant | Current evidence/status |
|---:|---|---|---|---|---|---|---|---|
| 1 | Opportunity create `POST /api/workspace/opportunities` | create + demand + audit transaction; PK; catch any `23505` | Stable id: `409 opportunity_id_taken`; no replay | Expected `[201,409]`, one row | Same id/different body: one winner, loser `409` | `409`; caller must GET | Exactly one opportunity and one success audit; no 500 | **PARTIAL/STATIC**. DB test asserts `[201,409]` and one row (`crmRoutes.db.test.ts:380-454`). No response replay. |
| 2 | Opportunity full update `PATCH /opportunities/:id` | transaction + final-status predicate; no version, lock or request key | Two sequential `200`; resets feasibility and writes two audits | Two `200`; same final data, duplicate audits | Both may `200`; last writer wins all fields/demand | Reapplies and returns a fresh `200` | At most one accepted revision from a shared base; stale writer `409`, no duplicate audit | **FAIL**. Read/validation occur before transaction (`updateOpportunityCommand.ts:24-70`); SQL has no expected version (`projectIntakeRepository.ts:344-379`). |
| 3 | Opportunity stage `PATCH /opportunities/:id/stage` | transaction for update+audit; no lock/version; same-state fast no-op | After committed success: `200`, same object, no second audit | Both can read old stage, both `200`, two audits | Both can `200`; final stage is last writer; each guard used the same stale source stage | Usually `200` no-op if first committed; ambiguous if first still in flight | One legal transition from observed version; loser/retry should replay or `409`; audit matches final transition chain | **FAIL**. DB test explicitly accepts two conflicting `200` and three total stage audits (`crmRoutes.db.test.ts:690-720`). |
| 4 | Opportunity pipeline `PATCH /opportunities/:id/pipeline` | transaction + final-status predicate; no version/lock | Sequential `200` no-op, no second audit | Both can update/audit if they read old state | Cross-pipeline concurrent moves: both can `200`, last writer wins | Committed retry becomes `200` no-op | One pipeline/stage pair; stale conflicting writer `409`; no duplicate audit | **FAIL/STATIC**. No-op covered (`crmRoutes.db.test.ts:754-792`); concurrent pipeline conflict not covered. |
| 5 | Feasibility `POST /opportunities/:id/feasibility` | assessment built before transaction; conditional non-final update + audit | Recomputes, `200`, another audit | Both may `200` and audit; same snapshot usually same result | Opportunity/demand can change between assessment and write; stale assessment may overwrite newer feasibility | Recomputes and writes again | Persist assessment derived from the same opportunity/demand revision; one logical audit per intent | **FAIL/STATIC**. Finalization race maps to `409`, but no revision/lock protects assessment inputs (`checkOpportunityFeasibilityCommand.ts:20-75`). |
| 6 | Opportunity finalize `PATCH /opportunities/:id/finalize` | conditional `UPDATE ... status NOT IN final` + audit transaction | First `200`, later `409 opportunity_final_action_locked` | One `200`, one `409` | won/lost compete: one final status, loser `409` | `409`, not original success | Exactly one final status and one success audit | **PASS single-use/STATIC**. Conditional SQL `projectIntakeRepository.ts:459-480`; service race test `projectIntakeService.test.ts:519+`. |
| 7 | Activate opportunity -> project `POST /opportunities/:id/activate` | advisory lock + reread + unique source + conditional opportunity finalize + audit | First `201`, retry `409 opportunity_not_activatable` | One `201`, one `409` | Different project ids for same opportunity: one project only | `409`, not original project response | One active project per source, opportunity `won_closed`, one audit, all atomic | **PASS single-use**. Unit duplicate test `projectIntakeService.test.ts:54-180`; unique index `projects_tenant_source_opportunity_uidx`. |
| 8 | Project closure `POST /projects/:id/closure/close` | transaction; repository conditional close + unique closure snapshot; conflict path rereads existing model | `200` then `200` with same snapshot/audit id | Expected one close; loser maps persistence conflict to existing `200` model | Different close reason/lessons race: first persisted model is replayed; later payload is ignored, not hash-conflicted | `200` existing model | One closed project, one snapshot/audit/lesson set; retry returns canonical first result | **PASS for same payload; PARTIAL for conflicting payload/STATIC concurrency**. Sequential DB test `backendManagementLoop.db.test.ts:423-480`; route recovery `retrospectiveRoutes.ts:154-170,233-295`. |
| 9 | Workspace inbox task create `POST /api/workspace/tasks` | advisory lock + transaction; workspace inbox unique; task PK | Omitted id: creates two UUID tasks. Stable id: second unique violation is not mapped | Same as duplicate click; stable-id loser likely HTTP 500 | Stable same id: first wins, loser unmapped; generated ids create both intents | No key; omitted id duplicates, stable id likely 500 | One logical task/audit/activity; retry should replay `201` or stable `409` | **FAIL/STATIC**. Unlike project task create, function has no `try/catch taskCreateConflict` (`taskCreateCommands.ts:49-175` vs `202-319`). |
| 10 | Project task create `POST /projects/:id/tasks` | advisory lock + transaction + task PK; `23505 tasks_pkey` -> `409` | Omitted id: two tasks; stable id: `201` then `409 task_id_taken` | Stable id: `[201,409]`, one row/audit/activity | Same id/different payload: one winner, loser `409` | Omitted id duplicates; stable id returns `409`, not replay | One task for stable client intent, one plan increment/audit/activity | **PARTIAL/STATIC**. DB race test `projectWorkRoutes.db.test.ts:409-452`; default parser makes `id` optional (`projectWorkParsers.ts:27-42,86-142`). |
| 11 | Task full update `PATCH /tasks/:id` | advisory lock + transaction + `clientUpdatedAt` compare | One `200`, second `409 task_version_conflict` | `[200,409]`; one audit/activity/version bump | First lock winner persists; stale competitor `409` | `409`; GET required to learn whether first succeeded | Exactly one update from a shared `updatedAt`; no duplicate audit/activity | **PASS single-use/STATIC DB**. DB test `projectWorkRoutes.db.test.ts:1466-1583`; guard `taskUpdateCommands.ts:54-97`. |
| 12 | Assignment via task create/PATCH `participants` | Same boundaries as rows 9-11; participant rows replaced inside transaction | Create follows row 9/10; PATCH follows row 11 | PATCH assignment change: one `200`, one stale `409` | First task PATCH wins, second stale `409`; direct planning changes also advance task `updatedAt` | PATCH retry `409` | Participant set, owner/requester and planning assignments remain atomic and version-consistent | **PASS for PATCH, FAIL for create-without-id**. Assignment stale test starts `projectWorkRoutes.db.test.ts:1585`; participant replace `projectWorkRepository.ts:537-578`. |
| 13 | Task archive `DELETE /tasks/:id` | advisory lock + reread; archive planning command + audit transaction | `200` + `200` existing archived task | Serialized; one applies, one no-op | Archive vs update/status: common lock serializes; later operation sees archived/not found | `200` canonical archived state | One archive audit/version bump, task absent from active list | **PASS/STATIC**. DB test `projectWorkRoutes.db.test.ts:454-483`; no-op both outside and inside tx (`taskLifecycleCommands.ts:44,68-70`). |
| 14 | Task status transition `PATCH /projects/:id/tasks/:id/status` | advisory lock + reread + transition guard + transaction | First `200`; same target retry sees self-transition and gets `409 task_status_transition_not_allowed` | Same target: one `200`, one `409` | Both can apply sequentially when both transitions are legal from evolving state (for example `new->in_progress`, then `in_progress->waiting`), so both may `200` | Usually `409`, not replay | Same-intent executes once; conflicting shared-base intents should have explicit version/CAS outcome | **PARTIAL/STATIC**. Lock prevents stale simultaneous writes, but endpoint has no client task/plan version; transition table `taskCommandGuards.ts:56-68`. |
| 15 | Task comment `POST /tasks/:id/comments` | transaction; optional `(tenant,surface,actor,clientRequestId)` claim + body hash | With key: both `201`, same activity id. Without key: two comments | With key: exact replay; without key: duplicates | Same key/different body: `409 idempotency_key_conflict` | With key: original `201` activity; without key duplicates | One activity/audit per keyed intent; key reuse cannot drop different content | **PASS when keyed; FAIL when omitted**. DB tests `projectWorkRoutes.db.test.ts:1167-1267`; parser makes key nullable (`projectWorkParsers.ts:77-84,212-230`). |
| 16 | Task-status create `POST /task-statuses` | transaction; PK/name/sort-order unique; mapped `23505` -> specific `409` | `201` then specific `409` | `[201,409]`, one row/audit | Conflicting id/name/order: one winner, loser specific `409` | `409`, not replay | No duplicate definitions; stable conflict response, one audit | **PASS single-use/STATIC**. DB test `projectWorkRoutes.db.test.ts:919-965`; mapper `taskStatusWorkspace.ts:33-55,95-141`. |
| 17 | Task-status update `PATCH /task-statuses/:statusId` | transaction only; no version/lock; no unique-error catch | Two `200`, duplicate audit | Both `200`; duplicate audit | Last writer wins. Name/sort collision may escape as 500. Body `id` can differ from path id and update another row | Reapplies and audits again | Path identifies the only row; stale writer `409`; unique conflicts are stable `409`; one logical audit | **FAIL**. Route passes path and body, but repository update uses `input.value.id` (`taskStatusWorkspace.ts:172-213`); catch exists only around create. |
| 18 | Task-status archive `DELETE /task-statuses/:id` | transaction; pre-read; archived-state no-op; no lock/CAS on update | Sequential `200` + `200`, one audit | Both can pre-read active and both update/audit | Archive vs PATCH can last-write status/name/category with no version | Committed retry `200` existing | Archived state, one audit even under concurrency | **PARTIAL/STATIC**. Sequential one-audit DB test `projectWorkRoutes.db.test.ts:967-1005`; concurrent case untested and update predicate lacks `status='active'` (`projectWorkRepository.ts:340-356`). |
| 19 | Planning single apply `POST /projects/:id/planning/apply-command` for task/assignment commands | advisory lock + transaction + planVersion + optional idempotency response record | With key: same `200` response. Without key: first `200`, retry stale `409` | With key: both `200` identical, one mutation/version/audit; without key one `200`, one `409` | Same key/different hash/actor: `409 idempotency_key_conflict`; different keys/shared version: one winner, one `409 plan_version_conflict` | With key: exact replay; without key `409` | One plan commit/version increment/audit; assignment/task rows match returned read model | **PASS when keyed; PASS single-use without key/STATIC DB**. Tests `planningRoutes.db.test.ts:390-467,2103-2183`. |
| 20 | Planning batch apply `POST /projects/:id/planning/apply-command-batch` | same as row 19; all commands and one planVersion increment in one tx | With key exact `200`; without key stale `409` | With key both `200` identical; one batch commit | Hash covers ordered command list/version/actor; conflict `409` | With key exact replay | Batch all-or-nothing, one version/audit/notification set | **PASS when keyed/STATIC DB**. Tests `planningRoutes.db.test.ts:1851-2025`. |
| 21 | Planning scenario aliases and auto-solver proposal apply | advisory lock + planVersion + persisted run `appliedAt`; transaction | First `200`, retry `409 already_applied` or version conflict | One `200`, one `409` | Different proposal/accepted risk on same run: first wins; run becomes single-use | `409`, not replay | Exactly one applied proposal and one plan version/audit | **PASS single-use/STATIC DB**. Scenario DB race `planningRoutes.db.test.ts:2186-2305`; solver checks `planningAutoSolverRoutes.ts:307-408,508-520`; unit solver tests passed. |
| 22 | Planning revert `POST /projects/:id/planning/revert-last` | Selects last revertible audit **outside** tx, then runs compensating commands as separate transactions; no key | A second click may select the revert commit and undo the undo, or replay the same compensation | Two requests can select the same audit before either commits; commands then run serially against fresh versions | Concurrent normal planning mutation can change which commit is actually last while revert still targets old event | Unsafe/ambiguous; no replay token | A revert intent applies once atomically to a specific commit; retry returns same result | **FAIL/STATIC**. Selection at `planningRevertRoute.ts:22-38`; per-command separate commits `:34-55`; no consumed/reverted marker. |

## Bugs and risks

### HIGH-1 — Opportunity updates lose concurrent edits

Affected: full update, stage, pipeline; feasibility is a related stale-derived-write variant.

Steps:

1. Read one non-final opportunity as clients A and B.
2. A and B submit different full updates, or different stage moves, concurrently.
3. Both requests validate against the same old record.
4. Both SQL updates can succeed; the later commit overwrites the earlier state. Stage DB test already demonstrates two conflicting `200` responses.

Expected: one accepted write and one `409` with current revision, or serialized validation against the post-A state. Audit should describe the actual serial transition chain.

Actual: both can return `200`; final data is last-writer-wins. Stage guards can approve B using a source stage that is no longer current. Evidence: `updateOpportunityCommand.ts:24-70`; `changeOpportunityStageCommand.ts:80-111`; `crmRoutes.db.test.ts:690-720`.

Impact: silent loss of commercial/project-intake edits and potentially invalid stage transition history.

### HIGH-2 — `planning/revert-last` is not idempotent and not one atomic revert

Steps:

1. Apply a revertible planning command.
2. Call `revert-last`; compensating command is committed and audited.
3. Retry after a timeout or double-click.

Expected: the same target commit is marked reverted once; retry returns the first revert result.

Actual: route re-queries the latest audit with `compensatingCommands`; the compensation's own audit may become the next revert target, causing an undo/redo oscillation. Multiple compensating commands are separate transactions, so partial revert is possible if a later command fails. Evidence: `planningRevertRoute.ts:22-62`.

Impact: plan can change again on harmless retry; multi-command revert is not atomic.

### HIGH-3 — Task-status PATCH can update a row different from the path and has last-writer-wins

Steps:

1. `PATCH /task-statuses/status-a` with body `{ id: "status-b", ... }`.
2. Route finds `status-a` as `before`, then repository updates `status-b` because body `id` is passed unchanged.
3. Audit uses mixed before/after identities. Concurrent PATCHes have no version and both succeed.

Expected: body id is rejected/ignored; only path row changes; stale update gets `409`; unique name/order collision maps to stable `409`.

Actual: body id selects repository target; concurrent writes are last-writer-wins; update `23505` is not caught (create-only catch), so a constraint race can become 500. Evidence: `taskStatusRoutes.ts:44-66`; `taskStatusWorkspace.ts:144-214`; `projectWorkRepository.ts:322-338`.

Impact: wrong configuration row and misleading audit can be produced by a valid authenticated request.

### MEDIUM-1 — Workspace inbox task duplicate handling is weaker than project task create

Steps:

1. Send two concurrent `POST /api/workspace/tasks` requests with the same explicit task id.
2. Both serialize on planning lock; second task insert hits `tasks_pkey`.

Expected: `[201,409 task_id_taken]` or exact replay, matching `POST /projects/:id/tasks`.

Actual: workspace inbox function lacks the project-create `try/catch taskCreateConflict`, so unique violation propagates to generic 500. If id is omitted, each retry receives a new UUID and creates a second task. Evidence: `taskCreateCommands.ts:49-175,177-319`.

### MEDIUM-2 — Feasibility result can be persisted from stale inputs

Steps:

1. Start feasibility calculation.
2. Concurrently update opportunity dates/hours/demand.
3. Feasibility transaction writes assessment calculated before that update.

Expected: assessment write is conditional on opportunity revision or performed under the same planning lock/snapshot.

Actual: assessment is built before transaction and update only checks that status is not final. Evidence: `checkOpportunityFeasibilityCommand.ts:20-48`; `projectIntakeRepository.ts:306-323`.

### MEDIUM-3 — Optional keys leave default create/comment flows retry-unsafe

Task create `id` and comment `clientRequestId` are optional. Without them, a double click or timeout retry creates a second task/comment. The server has working replay infrastructure, but the core route contract does not require it. Evidence: `projectWorkParsers.ts:27-42,77-84,86-142,212-230`.

### MEDIUM-4 — Conflicting task status transitions are serialized, not compared to a client version

Two shared-base intents can both succeed if the second transition remains legal after the first. Example: concurrent `new -> in_progress` and `new -> waiting`; lock winner moves to `in_progress`, then second is re-read and `in_progress -> waiting` is legal. This is serializable, but it is not first-writer-wins and may violate user expectation that B was based on `new`. No client task/plan version is accepted by the endpoint.

### LOW-1 — Concurrent task-status archive can duplicate audit

Sequential retry is clean, but two transactions may both read `active`, then both run an unconditional archive update and append audit. Add `status='active'` CAS or lock if audit uniqueness matters. Evidence: `taskStatusWorkspace.ts:237-276`; `projectWorkRepository.ts:340-356`.

## Evidence quality by flow

- Executed in this lane: parser/domain/service/mock route behavior, including activation duplicate logic, finalization/update race mappings, closure error mapping, solver route validation. 64/64 passed.
- Strong existing DB evidence, inspected but not rerun: opportunity duplicate create; conflicting stage writes; project task duplicate create/archive; task-status create/archive; comment idempotency/conflict; task PATCH race; planning single/batch idempotency; scenario single-use; closure retry.
- Repository/SQL-only inference: opportunity full-update race, pipeline race, feasibility stale write, workspace inbox explicit-id 500, task-status PATCH body/path mismatch and update conflict, concurrent task-status archive, solver concurrent apply, revert retry/concurrency.

## Doubts

- PostgreSQL transaction isolation is not explicitly set in these flows; analysis assumes Drizzle/Postgres default `READ COMMITTED`. Advisory lock behavior is definitive for flows that call it.
- Opportunity stage/pipeline concurrent response ordering is nondeterministic by design. Existing DB test proves two stage writes can both succeed, but does not prove every timing interleaving.
- `updatedAt` is a timestamp used as task optimistic token. An extremely tight same-millisecond update is theoretically worth a dedicated DB test because application writes use `new Date()` resolution.
- Closure conflicting-payload retry returns the first closure model rather than `idempotency_key_conflict`. This may be acceptable product semantics, but the later close reason/lessons are silently ignored.
- `executeApplyPlanningCommand` and the inline single apply route contain duplicated logic. Revert calls the extracted handler; normal HTTP apply uses inline logic. They currently match on lock/version/idempotency, but drift risk exists.

## Unverified zones

1. No DB test was executed because the suites destructively truncate the configured/fallback database and no isolated test URL was present.
2. No injected network timeout was run. Retry-after-timeout results are derived from persisted key/state behavior and existing DB retry tests.
3. No new concurrent tests were authored due report-only scope. Highest-value missing tests are: opportunity full-update conflict, same-payload concurrent stage/pipeline, feasibility-vs-update, workspace inbox duplicate explicit id, task-status update/path-body mismatch, concurrent task-status archive, revert double-click/partial failure.
4. Auto-solver concurrent apply and project closure concurrent close are transactionally protected but only scenario concurrent apply / sequential closure retry have inspected DB tests.
5. Agent tool execution was not independently tested; it proxies the same routes (`agentRoutes.ts:490-539`) and inherits their guarantees and failures.

## Change index

Only `.superloopy/evidence/projects-2026-07-10/lane-03-race-idempotency.md` was added by this lane. Product symbols added/changed/removed: none.

CodeGraph before -> after first post-write sync:

- indexed files: `2176 -> 2176`;
- nodes: `24132 -> 24132`;
- edges: `52137 -> 52149`.

The report is Markdown and does not add AST nodes/edges. The `+12` edges therefore came from index lag or parallel changes in the shared dirty worktree, not from this lane's product edits. `codegraph sync` reported `Already up to date`.

SUPERLOOPY_EVIDENCE: E:\KISS-PM\.superloopy\evidence\projects-2026-07-10\lane-03-race-idempotency.md
