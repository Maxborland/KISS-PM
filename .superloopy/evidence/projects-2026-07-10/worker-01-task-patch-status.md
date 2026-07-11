# Worker 01: task PATCH status boundary

## Result

PASS. The general task update command now rejects any `statusId` change with
`409 task_status_transition_not_allowed`. Status transitions remain owned by
the dedicated transition command, including its participant-role, transition
graph, and acceptance checks. The guard is repeated after the transactional
task reload so a concurrent status change cannot be overwritten.

Ordinary metadata and assignment updates still succeed when `statusId` is
unchanged.

## Changed files

- `apps/api/src/project-work/taskUpdateCommands.ts`
  - Added pre-transaction and post-lock `statusId` equality guards in
    `updateTask`.
- `apps/api/src/project-work/taskUpdateCommands.security.test.ts`
  - Added a dedicated non-DB regression suite for direct bypass, concurrent
    status change, and preserved metadata/assignment updates.
- `.superloopy/evidence/projects-2026-07-10/worker-01-task-patch-status.md`
  - Recorded this evidence receipt.

No changes were made to `taskCommandGuards.ts`, task status workspace/routes,
or database-backed tests.

## Commands and results

1. `codegraph sync`
   - PASS before exploration; index was already up to date.
2. `node_modules/.bin/vitest.CMD run apps/api/src/project-work/taskUpdateCommands.security.test.ts`
   - RED before product change: 1 failed, 1 passed.
   - The failing security scenario received `{ ok: true }` and changed an
     acceptance-required task from `new` to `done`, proving the bypass.
3. `node_modules/.bin/vitest.CMD run apps/api/src/project-work/taskUpdateCommands.security.test.ts`
   - PASS after correction: 1 file passed, 3 tests passed.
4. `node_modules/.bin/tsc.CMD -p apps/api/tsconfig.json --pretty false`
   - PASS, exit code 0.
5. `git diff --check -- apps/api/src/project-work/taskUpdateCommands.ts`
   - PASS, exit code 0.
6. `codegraph sync`
   - PASS after changes; index already reflected the edits.

The final Vitest run emitted an unrelated existing warning about a duplicate
`assignment.delete` case in `packages/domain/src/planning/commandReducer.ts`.
It did not fail the test and is outside this task's ownership.

## Acceptance evidence

- Unauthorized/invalid bypass: requester with no task permissions and an
  acceptance-required task cannot use general update for `new -> done`;
  transaction and planning command execution are both skipped.
- Race protection: if status changes between initial read and transaction,
  general update returns 409 and applies no planning command.
- Compatibility: unchanged `statusId` still permits description and executor
  assignment updates; only assignment upsert/delete commands are emitted.

## CodeGraph change index

- Before: `updateTask` was reachable through `createTaskCommandWorkspace`,
  `registerProjectWorkRoutes`, and `registerAgentRoutes`; it had no boundary
  preventing `buildUpdateTaskPlanningCommands` from emitting
  `task.update_status`.
- After: the same production nodes and call edges remain; `updateTask` changed
  internally with two status-boundary checks. No production symbol or edge was
  added or removed.
- Added test file: 17 indexed symbols, including `createTask`, `createHarness`,
  `updateBody`, and the `updateTask status boundary` suite.
- Final graph: 2,185 files, 24,233 nodes, 52,094 edges.

## Risks

- General PATCH now rejects all actual status changes, including otherwise
  valid transitions. This is intentional: callers must use the dedicated
  status-transition endpoint to receive canonical authorization and acceptance
  behavior.
- No DB-config tests were run by design. Persistence behavior is covered here
  through the command's public workspace interface with an in-memory data
  source.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-01-task-patch-status.md
