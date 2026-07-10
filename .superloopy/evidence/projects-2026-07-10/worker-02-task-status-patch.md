# Worker 02: task-status PATCH identity and conflicts

## Result

PASS

- `PATCH /api/workspace/task-statuses/:statusId` keeps the path id authoritative.
- `updateTaskStatus` canonicalizes the write payload and audit command input to `statusId` from the path, even when called directly with a different `value.id`.
- PostgreSQL unique collisions on task-status name and sort order are returned as deterministic HTTP 409 errors:
  - `task_status_name_taken`
  - `task_status_sort_order_taken`
- Unknown errors remain rethrown.
- No database-backed tests or shared database mutations were used.

## Changed files

- `apps/api/src/project-work/taskStatusWorkspace.ts`
  - Changed `updateTaskStatus`.
  - Added path-id canonicalization before transaction work.
  - Reused `taskStatusUniqueConflict` for update transaction failures.
- `apps/api/src/project-work/taskStatusRoutes.test.ts`
  - New dedicated non-DB route/workspace test file.
  - Covers mismatched body/path identity at both HTTP and workspace boundaries.
  - Covers name and sort-order unique collision responses.
- `.superloopy/evidence/projects-2026-07-10/worker-02-task-status-patch.md`
  - This evidence report.

Not changed: `apps/api/src/project-work/taskStatusRoutes.ts`, parsers, `taskUpdateCommands`, `taskCreateCommands`.

## Commands and results

1. `codegraph sync`
   - PASS, initial index already current.
2. CodeGraph context/explore/impact for task-status workspace and routes.
   - PASS. Identified `updateTaskStatus`, `registerTaskStatusRoutes`, and the existing `taskStatusUniqueConflict` mapper.
3. `pnpm vitest run apps/api/src/project-work/taskStatusRoutes.test.ts`
   - INFRA BLOCKED before test execution: the Codex pnpm wrapper attempted an install and stopped on `ERR_PNPM_IGNORED_BUILDS`.
   - No dependency or lockfile changes were made.
4. `.\node_modules\.bin\vitest.cmd run apps/api/src/project-work/taskStatusRoutes.test.ts` before implementation.
   - EXPECTED FAIL: 4 tests, 1 passed, 3 failed.
   - Direct workspace mismatch returned `status-body-target`.
   - Name and sort collisions returned HTTP 500 instead of 409.
5. `.\node_modules\.bin\vitest.cmd run apps/api/src/project-work/taskStatusRoutes.test.ts` after implementation.
   - PASS: 1 file, 4 tests passed.
6. `.\node_modules\.bin\tsc.cmd -p apps/api/tsconfig.json --pretty false`
   - PASS, exit code 0.
7. Final parallel rerun of the focused Vitest command and API TypeScript command.
   - PASS: 4/4 tests; API typecheck exit code 0.
   - Vitest emitted a pre-existing warning in `packages/domain/src/planning/commandReducer.ts` about a duplicate `assignment.delete` case; unrelated to this slice.
8. `git diff --check -- apps/api/src/project-work/taskStatusWorkspace.ts apps/api/src/project-work/taskStatusRoutes.test.ts`
   - PASS, no whitespace errors.
9. `codegraph sync`
   - PASS, post-change index already current.

## CodeGraph change index

Initial global index:
- Files: 2180
- Nodes: 24189
- Edges: 52080

Final global index:
- Files: 2185
- Nodes: 24233
- Edges: 52094

The workspace is shared and other agents changed files concurrently, so the global delta is not solely attributable to this task.

Attributable change index:
- Changed symbol: `updateTaskStatus` in `apps/api/src/project-work/taskStatusWorkspace.ts`.
- Added call edge: `updateTaskStatus -> taskStatusUniqueConflict`.
- Added indexed file: `apps/api/src/project-work/taskStatusRoutes.test.ts`.
- Added test-file symbols reported by CodeGraph: 15, including `createRouteFixture`, `patchTaskStatus`, and `taskStatus`.
- Removed symbols: none.
- Removed edges: none attributable to this task.

## Risks

- Per scope, collision behavior is verified with in-memory PostgreSQL-shaped errors rather than a live driver. The shared mapper accepts `constraint`, `constraint_name`, message markers, and nested `cause` chains up to depth 8.
- The route intentionally ignores a differing body `id` by replacing it with the path id. This is deterministic and backward-compatible; it does not return a 400 for the mismatch.
- No full API suite was run; verification is the dedicated non-DB suite plus API typecheck.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-02-task-status-patch.md