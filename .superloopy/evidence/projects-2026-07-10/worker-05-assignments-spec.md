# Worker 05: assignments write E2E

## Scope

- Owned spec: `e2e/full-eval/projects-assignments-write.spec.ts`
- No product files edited.
- Live mutation was intentionally not executed against the shared database.

## Coverage

- ADMIN selects a free leaf-task/resource pair from the live API read model.
- Adds an `observer` assignment through the real assignments UI.
- Verifies the emitted `assignment.upsert`, API readback, and persistence after reload.
- Removes the assignment through the inspector and confirmation dialog.
- Verifies the emitted `assignment.delete`, API readback, and absence after reload.
- Uses a `finally` cleanup through the versioned planning API, including one retry on a plan-version conflict.
- PLAN reader verifies the current exposed UI write control and a server-side `403` for an idempotent-shaped assignment upsert, with unchanged plan version and assignment readback.

## Static verification

- PASS: `.\\node_modules\\.bin\\playwright.cmd test e2e/full-eval/projects-assignments-write.spec.ts --config playwright.config.ts --list`
  - 2 tests discovered in 1 file.
  - ADMIN add/readback/reload/remove/readback/reload.
  - PLAN-reader exposed-control/server-forbidden/unchanged-readback.
- PASS: `node .\\node_modules\\.pnpm\\typescript@5.9.3\\node_modules\\typescript\\bin\\tsc --noEmit --pretty false --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --skipLibCheck e2e/full-eval/projects-assignments-write.spec.ts`
- BLOCKED outside owned scope: root `.\\node_modules\\.bin\\tsc.cmd -b --pretty false` reports existing errors in `apps/web/src/delivery/lib/planning-preview-gate.test.tsx`:
  - missing `./planning-preview-gate` module;
  - implicit `any` for `confirmed`;
  - incomplete `ValidationIssue` fixture.
- Tooling note: `pnpm exec playwright ... --list` was blocked before Playwright by the workspace pnpm wrapper attempting install and rejecting ignored dependency build scripts. The already-installed local Playwright binary was used instead.

## CodeGraph change index

- Before: owned spec absent, 0 nodes and 0 edges.
- After sync: 18 nodes (1 file, 10 functions, 6 type aliases, 1 import).
- After sync: 27 outgoing edges (3 calls, 17 contains, 1 import, 6 references), 0 incoming cross-file edges.
- Evidence Markdown is not a source graph node.

## Runtime status

`NOT_RUN`: per assignment, the scenarios were not executed because they mutate the shared database. Runtime behavior still requires an isolated seeded database.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-05-assignments-spec.md

## Preview gate adaptation

This section supersedes the earlier direct-write expectations above.

- ADMIN add now waits for the exact single-command endpoint `/planning/preview-command`, asserts the `assignment.upsert` envelope, verifies the visible `Предпросмотр изменений` dialog, confirms `Применить изменения`, then waits for the exact `/planning/apply-command` endpoint.
- ADMIN remove follows the same preview-dialog-apply order for `assignment.delete`.
- Both ADMIN paths assert that preview and apply carry the same command envelope.
- PLAN reader now triggers a real assignment edit from the UI. The spec expects exact `preview-command` status `403`, no preview dialog, zero requests to exact `apply-command`, unchanged plan version, and unchanged assignment readback.
- The assignments surface uses single commands, so `preview-command-batch` / `apply-command-batch` are intentionally not expected in this spec.

## Preview gate static verification

- PASS: `.\node_modules\.bin\playwright.cmd test e2e/full-eval/projects-assignments-write.spec.ts --config playwright.config.ts --list`
  - 2 tests discovered in 1 file.
  - ADMIN add/remove preview-dialog-apply flow.
  - PLAN-reader preview-403/no-apply/unchanged-readback flow.
- PASS: `node .\node_modules\.pnpm\typescript@5.9.3\node_modules\typescript\bin\tsc --noEmit --pretty false --target ES2022 --module NodeNext --moduleResolution NodeNext --types node --skipLibCheck e2e/full-eval/projects-assignments-write.spec.ts`
- NOT RUN: Playwright execution was intentionally skipped because the ADMIN scenario mutates shared planning data.

## Preview gate CodeGraph change index

- Before this adaptation: 18 nodes and 27 outgoing edges (3 calls, 17 contains, 1 import, 6 references).
- After `codegraph sync`: 21 nodes and 43 outgoing edges (8 calls, 20 contains, 1 import, 14 references); 0 incoming cross-file edges.
- Added symbols: `existingAssignmentRow`, `planningPath`, `confirmPlanningPreview`.
- Changed symbol: `waitForPlanningWrite` became `waitForPlanningResponse` with exact preview/apply endpoint selection.
- Removed symbol: `waitForPlanningWrite`.
- Files touched by Worker 05 remain limited to the owned spec and this evidence Markdown.

SUPERLOOPY_EVIDENCE: .superloopy/evidence/projects-2026-07-10/worker-05-assignments-spec.md