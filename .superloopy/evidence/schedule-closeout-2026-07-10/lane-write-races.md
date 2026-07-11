# Schedule write-flow race/idempotency audit

Date: 2026-07-10
Scope: production `apps/**` / `packages/**`, focused unit/UI/DB/E2E contracts. No product, test, or matrix edits.
Method: `codegraph sync` first; CodeGraph structural context/callers/callees/impact; targeted source reads and `rg` only for literal strings/test names; focused tests executed.

## Findings and evidence

### HIGH-1 - Most Schedule applies have an undefined-outcome failure path

`usePlanning.apply` and `applyBatch` do preview then apply, but only reload on explicit `plan_version_conflict`; a fetch failure, invalid response, timeout/connection loss, or lost response becomes a generic failure without readback ([apps/web/src/delivery/lib/use-planning.ts:88](../../../apps/web/src/delivery/lib/use-planning.ts), lines 88-120; lines 125-160). The transport does no retry and has no request-status/readback endpoint ([packages/planning-client/src/api/planningApiClient.ts:28](../../../packages/planning-client/src/api/planningApiClient.ts), lines 28-59, 87-97).

The server commits mutation, plan-version bump, audit, notifications, response payload, and optional idempotency record inside the transaction before returning HTTP ([apps/api/src/planning/registerPlanningRoutes.ts:301](../../../apps/api/src/planning/registerPlanningRoutes.ts), lines 301-356; lines 501-557). Therefore a response can be lost after commit:

- direct Schedule `applyCmd` restores the optimistic `prev` model and reports rejection, even if the server committed ([apps/web/src/delivery/schedule/schedule-surface.tsx:523](../../../apps/web/src/delivery/schedule/schedule-surface.tsx), lines 523-546);
- generic `runBatch`/undo/calendar/resource/risk writes keep an old model and do not read back;
- no stable idempotency key is sent by ordinary single apply, staged apply, date fill, modal batch, drag/resize batch, undo, calendar exception, resource absence exception, or risk acceptance.

Impact: false failure messaging, stale client state, unsafe manual retry, duplicate audit/version bumps, and possible duplicate entity rows for commands that mint fresh IDs.

### HIGH-2 - Applying a staged package destroys the staged recovery point on cancel or failure

`applyStaged` snapshots `staged`, calls `applyBatch`, then unconditionally consumes the navigation sentinel, clears `staged`, and nulls `batchBaseRef` before inspecting the result ([apps/web/src/delivery/schedule/schedule-surface.tsx:380](../../../apps/web/src/delivery/schedule/schedule-surface.tsx), lines 380-405). This also happens when the preview gate returns `preview_cancelled` ([apps/web/src/delivery/lib/use-planning.ts:129](../../../apps/web/src/delivery/lib/use-planning.ts), lines 129-140), and on a generic transport failure. On non-conflict failure it attempts reload only after the package has been discarded.

Impact: canceling preview silently drops the user's staged work; an ambiguous network failure cannot be retried from the staged package. Existing navigation tests cover successful apply/discard and guards, but not preview cancellation, apply rejection, lost response, or reload failure ([apps/web/src/delivery/schedule/schedule-navigation-guard.test.tsx:211](../../../apps/web/src/delivery/schedule/schedule-navigation-guard.test.tsx), lines 211-238).

### HIGH-3 - Tenant absence writes alter Schedule calculations without changing the plan concurrency token

Tenant absence POST creates a random UUID row and invalidates only the capacity cache; DELETE does the same ([apps/api/src/absencesRoutes.ts:170](../../../apps/api/src/absencesRoutes.ts), lines 170-225; lines 228-284). Neither path increments project `planVersion` nor emits `notifyPlanVersionChanged`.

Planning readback later merges approved tenant absences into every affected project's `calendarExceptions` ([packages/persistence/src/planningRepository.ts:339](../../../packages/persistence/src/planningRepository.ts), lines 339-372), but retains the unchanged plan version ([packages/persistence/src/planningRepository.ts:374](../../../packages/persistence/src/planningRepository.ts), lines 374-415). Thus an absence can be created between preview and apply while `clientPlanVersion` still matches; the confirmed preview and applied calculation can differ without a version conflict.

There is also no active Schedule realtime consumer: CodeGraph found zero callers of `subscribeToPlanEvents`; literal search found only the unused client implementation and server SSE route. Open Schedule/Calendar/Resources surfaces see tenant absence changes only after explicit reload/navigation.

### HIGH-4 - Server `revert-last` is neither operation-atomic nor idempotent

`registerPlanningRevertRoute` reads audit history outside a write transaction, selects the latest event with compensating commands, then applies each inverse as a separate `executeApplyPlanningCommand` transaction ([apps/api/src/planning/planningRevertRoute.ts:22](../../../apps/api/src/planning/planningRevertRoute.ts), lines 22-55). It has no operation id/key, no consumed/reverted marker, and no expected source version.

Consequences:

- a multi-command revert can partially commit before a later inverse fails;
- concurrent/double requests can select the same source event and both begin compensating it;
- retries after a lost response cannot prove whether the revert already happened;
- each inverse creates its own version/audit event, whose own compensation may make a later `revert-last` toggle state accidentally rather than expose explicit redo semantics.

The DB test proves one successful single-command revert only ([apps/api/src/planningRoutes.db.test.ts:1087](../../../apps/api/src/planningRoutes.db.test.ts), lines 1087-1125). There is no concurrent, retry, partial-failure, repeated-revert, or multi-command atomicity test.

### MEDIUM-1 - Redo is absent; Ctrl+Shift+Z is wired to one-shot undo

Schedule stores one in-memory `lastCommitRef`, clears it after undo, and exposes no redo stack ([apps/web/src/delivery/schedule/schedule-surface.tsx:486](../../../apps/web/src/delivery/schedule/schedule-surface.tsx), lines 486-511). `Ctrl+Shift+Z`, conventionally redo, invokes `undo` ([apps/web/src/delivery/schedule/schedule-surface.tsx:1007](../../../apps/web/src/delivery/schedule/schedule-surface.tsx), lines 1007-1024). Reload/navigation also loses local undo state. The server history endpoint does not define redo, only repeated "revert latest" behavior.

### MEDIUM-2 - Staging accepts duplicate commands and can show an optimistic model different from the staged sequence

In batch mode `applyCmd` bypasses `beginOperation`, appends every command, and patches from the render-closure `readModel` rather than a functional latest model ([apps/web/src/delivery/schedule/schedule-surface.tsx:514](../../../apps/web/src/delivery/schedule/schedule-surface.tsx), lines 514-521). Rapid same-tick edits/double events can append multiple commands while each optimistic patch starts from the same model. The server previews/applies the full sequential list atomically, so the eventual result may differ from what was staged visually. No test exercises duplicate staged events or same-tick closure races.

### MEDIUM-3 - Adjacent Schedule-producing surfaces use render-lagged `busy`, not a synchronous in-flight guard

Schedule itself has a synchronous `operationRef` ([apps/web/src/delivery/schedule/schedule-surface.tsx:355](../../../apps/web/src/delivery/schedule/schedule-surface.tsx), lines 355-364), which blocks ordinary double apply. Calendars, Resources, Scenarios, and Commits only call `setBusy(true)` before awaiting ([apps/web/src/delivery/calendars/calendars-surface.tsx:169](../../../apps/web/src/delivery/calendars/calendars-surface.tsx), lines 169-179, 198-212; [apps/web/src/delivery/resources/resources-surface.tsx:98](../../../apps/web/src/delivery/resources/resources-surface.tsx), lines 98-105, 159-180; [apps/web/src/delivery/scenarios/scenarios-surface.tsx:139](../../../apps/web/src/delivery/scenarios/scenarios-surface.tsx), lines 139-152; [apps/web/src/delivery/commits/commits-surface.tsx:77](../../../apps/web/src/delivery/commits/commits-surface.tsx), lines 77-100).

Two events before React commits the disabled state can launch concurrent requests with the same plan version. Production advisory locking makes one ordinary request win and the other conflict, but this is noisy and still unsafe under lost responses. Commits double-click additionally reaches HIGH-4.

### MEDIUM-4 - Tenant absence POST is duplicate-prone and DELETE is not retry-idempotent

POST always mints `randomUUID()` ([apps/api/src/absencesRoutes.ts:195](../../../apps/api/src/absencesRoutes.ts), lines 195-204). The table has only an `id` primary key plus a non-unique lookup index; there is no logical uniqueness or idempotency record ([packages/persistence/src/schema/planning.ts:234](../../../packages/persistence/src/schema/planning.ts), lines 234-269). Repeated/concurrent identical POSTs create multiple approved absences and multiple audit events. DELETE retry returns `resource_absence_not_found` after a successful first delete ([apps/api/src/absencesRoutes.ts:252](../../../apps/api/src/absencesRoutes.ts), lines 252-284).

The DB tests cover CRUD/audit/rollback/validation/permissions, but no duplicate POST, concurrent POST, lost response, or idempotent DELETE ([apps/api/src/absencesRoutes.db.test.ts:75](../../../apps/api/src/absencesRoutes.db.test.ts), tests at lines 75, 121, 150, 232, 241).

### MEDIUM-5 - TSV is the only Schedule flow with a durable key, but UI replay after reload changes the request hash

TSV uses deterministic task IDs, a session fingerprint guard, and `schedule-tsv-<fingerprint>` as batch key ([apps/web/src/delivery/schedule/schedule-surface.tsx:960](../../../apps/web/src/delivery/schedule/schedule-surface.tsx), lines 960-995). Server replay is strong only for the exact original envelope: the request hash includes actor, commands, and `clientPlanVersion` ([apps/api/src/planning/registerPlanningRoutes.ts:428](../../../apps/api/src/planning/registerPlanningRoutes.ts), lines 428-450).

After browser reload the in-memory fingerprint guard is gone and `usePlanning` reconstructs the same keyed import with the new current plan version, so the same key has a different hash and returns `idempotency_key_conflict` rather than replaying the stored result. E2E covers durable replay by resending the captured original envelope, not the normal UI path after reload ([e2e/full-eval/projects-schedule-productivity.spec.ts:160](../../../e2e/full-eval/projects-schedule-productivity.spec.ts), lines 160-178).

### MEDIUM-6 - Navigation guards cover staged dirtiness, not in-flight non-staged writes

The guard is installed only while `staged.length > 0` and handles same-origin anchors, `popstate`, and `beforeunload` ([apps/web/src/delivery/schedule/schedule-surface.tsx:421](../../../apps/web/src/delivery/schedule/schedule-surface.tsx), lines 421-485). A non-batch apply can be in flight with no guard; navigation/close can abandon result handling. Programmatic navigation/form submission is outside the capture handler. Modified/middle clicks intentionally remain native and leave staged changes in the original tab.

The nine navigation tests are good for the implemented anchor/history/unload contract, but do not cover in-flight apply, programmatic router navigation, form navigation, or sentinel cleanup after abrupt unmount.

## Machine-like write-flow matrix

Legend: `Y` protected/implemented; `P` partial; `N` absent; `SV` server plan-version guard; `IK` idempotency key.

| Write action / exact entry | Duplicate | Concurrent | Retry | Idempotency key / guard | Readback | Current coverage | Defect / gap |
|---|---|---|---|---|---|---|---|
| Stage local edits: `ProjectSchedule.applyCmd` batch branch; all Schedule command types (`task.create/update_*`, assignment, dependency, WBS, delete/archive) | N: every event appended | N/A local; same-tick closure race | Session only; lost on reload | `staged[]`; no dedupe | Optimistic local patch only | Navigation guard 9 tests; productivity command builders | MEDIUM-2; staged UI may not equal sequential batch |
| Direct Schedule single apply: inline edits/create, bar move/progress, dependency drag, indent/outdent | Y UI: synchronous `operationRef`; N transport IK | SV + tenant advisory lock; loser 409 | N automatic; unsafe generic manual retry | No IK sent; `clientPlanVersion` only | Success response authoritative; conflict reload; generic failure no reload | API keyed schedule race at `planningRoutes.db.test.ts:2123`; no unkeyed UI lost-response test | HIGH-1; in-flight navigation MEDIUM-6 |
| Schedule atomic batch via `runBatch`: modal create/edit, resize+assignment, milestone, subtree delete, date fill | Y UI `operationRef`; command-list duplicates not normalized | SV + advisory lock; batch transaction atomic | N automatic | Optional IK API, normally absent | Success response; conflict reload; generic failure no reload | `planningRoutes.db.test.ts:1853`, `1974`, `2336`; milestone/productivity tests | HIGH-1; no ordinary batch IK |
| Apply staged package: `applyStaged` | Y UI `operationRef` | SV + advisory lock | N; staged data discarded | No IK | Conflict/generic rejection reload path, but package already cleared | Nav guard successful apply only (`:211`) | HIGH-2 |
| Discard staged / confirmed navigation | Y by state reset | N/A | N/A | History sentinel + anchor/popstate/beforeunload guard | Restores `batchBaseRef`; explicit discard also async reload | `schedule-navigation-guard.test.tsx:155-295` | Programmatic/in-flight paths unguarded; MEDIUM-6 |
| TSV import | Session fingerprint + deterministic task IDs + server IK | Advisory lock + IK replay; exact concurrent duplicates return same response | P: exact envelope replay safe | `schedule-tsv-<fingerprint>`; server request hash | Success response; conflict reload; dialog reopens | Unit `schedule-productivity.test.ts:53`; DB `:1853/:1974`; E2E captured-envelope replay `:160` | UI after-reload replay hash mismatch; MEDIUM-5 |
| Date-fill batch | UI `operationRef`; no IK | SV + advisory lock | N | No IK | Success response; conflict reload | Unit builder/validation `schedule-productivity.test.ts:98/:121/:150`; E2E conflict `projects-schedule-productivity.spec.ts:237-253` | HIGH-1 on lost response |
| Schedule local undo: `undo` -> inverse batch | One-shot ref cleared; UI ref blocks double | Pre-check `afterVersion`, then server SV/lock | N | No IK; expected local `afterVersion` checked before preview | Success response; conflict reload; generic failure no reload | Unit guard `schedule-productivity.test.ts:171`; E2E stale-version guard `:255-262` | No retry key; one session only; no redo |
| Redo | N/A | N/A | N/A | N | N | None | MEDIUM-1: feature/contract absent |
| Commits in-session revert: `onRevert` -> inverse batch | P: render-lagged `busy` | SV + lock; second likely 409 | N | No IK | Success then `loadCommits`; conflict reload via hook | Permission-only UI test | Lost-response and double-click gaps; HIGH-1/MEDIUM-3 |
| Server history revert: `revert-last` / `onRevertLast` | N operation dedupe | N at whole-operation level; inverse commands individually locked | N | No IK/source expected version/consumed marker | Last inverse response only | One single-command DB happy path `planningRoutes.db.test.ts:1087` | HIGH-4; partial multi-command revert; accidental toggle, no defined redo |
| Calendar day holiday/absence toggle and remove: `ProjectCalendars.applyCmd` | P: reuses known row ID, but double event possible | SV + lock; second stale request 409 | N | No IK; React `busy` only | Success response; conflict reload; generic no reload | Permission/navigation and mock contract tests; no race test | HIGH-1/MEDIUM-3 |
| Calendar/Resources range absence (`calendar.exception.upsert` batch) | N: each invocation mints fresh exception IDs | SV + lock; same-version loser 409 | N | No IK; React `busy` only | Success response; conflict reload; generic no reload | Calendar dialog working-day tests; E2E write specs; no duplicate test | Duplicate rows possible on repeated logical range; HIGH-1/MEDIUM-3 |
| Resource assignment/task edits from Resources | P: existing assignment ID reused; task/create IDs fresh | SV + lock | N | No IK; React `busy` only | Success response; conflict reload | Resource permission/E2E write coverage | HIGH-1/MEDIUM-3 |
| Accept overload risk: `risk.accept_overload` from Resources | Persistence state dedupes by accepted-overload key | SV + lock; repository coherent under races | N | No request IK; React `busy` only | Response includes accepted overload; conflict reload | `planningRepository.db.test.ts:370/:459`; mock read-model test | Duplicate logical requests can still add versions/audits; HIGH-1/MEDIUM-3 |
| Apply planning scenario with accepted risk reason | Server scenario run is single-use | Advisory lock; duplicate apply returns already-applied 409 | P: retry reports already applied, not replay success | Run `appliedAt` guard, no response replay IK | Success response; conflict reload | Concurrent duplicate DB test `planningRoutes.db.test.ts:2206`; mock risk-reason tests | UI `busy` render race; lost success becomes error, but state is not duplicated |
| Tenant absence POST (merged into Schedule on read) | N: random UUID; no logical unique constraint | N duplicate guard; transaction only per request | N | No IK | POST returns row; Schedule not reloaded/notified | CRUD/rollback/validation DB tests | HIGH-3 + MEDIUM-4 |
| Tenant absence DELETE | Storage delete once | Concurrent second returns 404 | N: retry after success appears failure | ID path only, no idempotent success tombstone | No Schedule event/version bump | CRUD/rollback DB tests | HIGH-3 + MEDIUM-4 |
| Schedule reload/readback | GET is authoritative snapshot including tenant absences | Can overlap; no cancellation/latest-request token | Manual retry only | N/A | Y on mount, explicit retry, plan-version conflict | E2E reload durability; no overlapping-load race | No realtime subscription; stale external/absence changes until reload |

## Server guarantees that are present

1. Production planning single/batch apply executes inside `runDataSourceTransaction` and takes `pg_advisory_xact_lock(hashtext(tenantId), hashtext('kiss_pm_resource_planning'))` ([packages/persistence/src/repositories.ts:740](../../../packages/persistence/src/repositories.ts), lines 740-755).
2. After lock acquisition, both routes check optional idempotency replay before `planVersion`, then reject stale versions, preview all mutations, write, increment once, audit, read back, notify, and persist the keyed response in the same transaction ([apps/api/src/planning/registerPlanningRoutes.ts:212](../../../apps/api/src/planning/registerPlanningRoutes.ts), lines 212-356; lines 410-557).
3. Key scope is `(tenant_id, project_id, idempotency_key)` and stores request hash + full response + actor ([packages/persistence/src/schema/planning.ts:675](../../../packages/persistence/src/schema/planning.ts), lines 675-705). Same key/same actor/same exact envelope replays; changed actor/envelope conflicts.
4. Batch validation is cumulative and all commands share one transaction/version bump. Blocking middle-command validation rolls back the whole batch.
5. The lock is optional in the data-source TypeScript contract (`?.`). Production Postgres is safe; an alternate implementation that omits the lock does not inherit serialization from the route contract.

## Coverage and commands executed

### Structural/source commands

```text
codegraph sync
# Result: already up to date
# CodeGraph status: 2,228 files; 24,825 nodes; 53,167 edges

CodeGraph context/search/explore/node/callers/callees/impact:
- ProjectSchedule, usePlanning, executeApplyPlanningCommand
- registerPlanningRoutes, registerPlanningRevertRoute
- expandAbsenceToCalendarExceptions, createResourceAbsencesRepository
- subscribeToPlanEvents (zero callers)

rg -n ... apps/web/src/delivery/schedule apps/web/src/delivery/{calendars,resources,commits,scenarios}
rg -n ... apps/api/src/planning apps/api/src/absencesRoutes.ts packages/{planning-client,persistence}
```

`rg` was used only after CodeGraph, for literal endpoint/command/test-name queries and exact line extraction. CodeGraph sometimes selected duplicate `.claude/worktrees/full-eval-uiux` symbols; all report references were re-anchored to production `apps/**`, `packages/**`, and `e2e/**` files.

### Tests run

```text
pnpm vitest run \
  apps/web/src/delivery/schedule/schedule-productivity.test.ts \
  apps/web/src/delivery/schedule/schedule-navigation-guard.test.tsx \
  apps/web/src/delivery/schedule/schedule-productivity-ui.test.tsx \
  apps/web/src/delivery/schedule/schedule-milestone.test.ts \
  apps/web/src/delivery/calendars/calendars-absence-dialog.test.tsx \
  apps/web/src/delivery/resources/resources-editors-absence.test.tsx \
  apps/api/src/planningParsers.test.ts \
  packages/planning-client/src/api/planningApiClient.test.ts
```

Result: PASS, 8 files, 33 tests.

```text
pnpm vitest run --config vitest.db.config.ts \
  apps/api/src/planningRoutes.db.test.ts \
  apps/api/src/absencesRoutes.db.test.ts \
  packages/persistence/src/planningRepository.db.test.ts
```

Result: PASS, exit 0, all three complete DB files. This freshly exercised keyed sequential/concurrent apply replay, atomic batch validation, schedule mutation, scenario single-use, accepted-overload persistence races, absence CRUD/audit/rollback, and readback assembly.

Not run: Playwright E2E (existing E2E source/contracts were inspected; focused unit and DB tests gave direct coverage without mutating shared seeded product data).

## Coverage gaps to close

1. Simulate apply commit followed by dropped HTTP response for direct, batch, staged, undo, calendar, absence-exception, and risk flows; assert readback/retry behavior.
2. Assert staged preview cancel/reject preserves staged commands, optimistic model, and navigation guard.
3. Concurrent/double UI events for Calendars, Resources, Scenarios, and both Commits revert buttons.
4. Atomic multi-command `revert-last`, mid-command failure rollback, same-request retry, concurrent duplicate request, repeated revert, and explicit redo semantics.
5. Tenant absence duplicate/concurrent POST, retry-after-lost-response, idempotent DELETE, project version/event invalidation, and preview-vs-absence race.
6. Normal UI TSV replay after browser reload, not only raw replay of the captured old envelope.
7. Active Schedule realtime/readback integration and overlapping reload ordering.
8. Navigation during non-staged in-flight apply and programmatic navigation.

## Change index

- Added report only: `.superloopy/evidence/schedule-closeout-2026-07-10/lane-write-races.md`.
- Product/test/matrix symbols changed: none.
- CodeGraph nodes/edges before -> after: `24,825 / 53,167` -> `24,880 / 53,270`. This Markdown report creates no code symbols; the concurrent increase came from other workspace changes observed during the audit.

SUPERLOOPY_AUDIT: .superloopy/evidence/schedule-closeout-2026-07-10/lane-write-races.md