# Worker 03: workspace task duplicate handling

## Result

`createWorkspaceInboxTask` now maps a nested PostgreSQL `23505` error for
`tasks_pkey` to `{ ok: false, status: 409, error: "task_id_taken" }` when the
caller supplied an explicit task id. Generated-id creates and unrelated
transaction errors continue to reject with the original error.

## Changed files

- `apps/api/src/project-work/taskCreateCommands.ts`
  - Added explicit-id-gated conflict handling to the workspace-inbox transaction.
  - Added the `TaskResult` transaction generic to keep the result union narrow.
- `apps/api/src/project-work/taskCreateCommands.test.ts`
  - Added three non-DB regression tests with mocked pre-transaction dependencies.

No database configuration, database mutation, commit, or push was used.

## Commands and results

- `codegraph sync` before work: PASS, index already current.
- `pnpm vitest run apps/api/src/project-work/taskCreateCommands.test.ts`:
  infrastructure-only FAIL before Vitest because the local pnpm wrapper attempted
  an install blocked by ignored-build policy.
- `.\\node_modules\\.bin\\vitest.cmd run apps/api/src/project-work/taskCreateCommands.test.ts`
  before product fix: expected RED, 1 failed / 2 passed; explicit duplicate leaked
  the nested error.
- `.\\node_modules\\.bin\\vitest.cmd run apps/api/src/project-work/taskCreateCommands.test.ts`
  after fix: PASS, 1 file / 3 tests.
- `.\\node_modules\\.bin\\tsc.cmd -p apps/api/tsconfig.json --pretty false`: PASS.
- Final `codegraph sync`: PASS, index current.
- Final CodeGraph status: 2,185 files, 24,233 nodes, 52,094 edges.

## CodeGraph change index

- `apps/api/src/project-work/taskCreateCommands.ts`
  - Changed node: `createWorkspaceInboxTask` (1 -> 1); its transaction rejection
    path now reuses the existing `taskCreateConflict` node.
  - Existing nodes `taskCreateConflict` and `createProjectTask` remain 1 -> 1 and
    were not changed.
  - Named call/reference topology for production dependencies is unchanged; no
    route, DB, update-command, or status-workspace edges were added.
- `apps/api/src/project-work/taskCreateCommands.test.ts`
  - File node: 0 -> 1.
  - Function nodes: 0 -> 3 (`createInput`, `createDepsRejecting`,
    `nestedTasksPrimaryKeyConflict`).
  - New reference edges include `createInput -> CreateWorkspaceInboxTaskInput`
    and `createDepsRejecting -> TaskCommandWorkspaceDeps`.

## Risks

- The regression suite mocks authorization/dependency preflight and deliberately
  does not exercise PostgreSQL. It verifies the command boundary and nested error
  shape without DB configuration, as scoped.
- Generated UUID collision handling intentionally remains unchanged: without an
  explicit `body.id`, even a `tasks_pkey` conflict is rethrown.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-03-workspace-task-duplicate.md
