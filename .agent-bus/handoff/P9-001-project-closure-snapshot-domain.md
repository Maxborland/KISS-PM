# P9-001 Project Closure Snapshot Domain Handoff

Updated: 2026-05-17T00:13:42.7930900+07:00

Status: accepted

Implemented:
- `packages/project-core` closure checklist/readiness and governed close-project domain foundation.
- `packages/retrospectives` ClosedProjectSnapshot domain package with deterministic source refs, cloned snapshot/readback, schedule/resource/KPI summaries, and runtime validation.
- Phase 9 matrix rows P9-001/P9-002 now contain fresh domain evidence but remain blocked until API/UI/E2E prove write-flow readback, audit, permissions, reload persistence, and cleanup.

Review fixes:
- Bug-hunt found blocker overrides matched only by blocker code. Fixed by requiring overrides to match blocker target fields such as `taskId`, `requirementId`, or `stageId`.
- Code-review found snapshot KPI summaries accepted invalid runtime values. Fixed finite `value` and allowed `severity` validation.

Verification:
- `node scripts/agent-bus-guard.mjs --task P9-001-project-closure-snapshot-domain --once` exit 0 at startup.
- `npm test -- packages/project-core/src/projectClosure.test.ts` exit 1 RED before implementation and exit 1 RED for generic blocker override during review.
- `npm test -- packages/project-core/src/projectClosure.test.ts` exit 0: 1 file, 5 tests passed.
- `npm test -- packages/retrospectives/src/closedProjectSnapshot.test.ts` exit 1 RED before implementation and exit 1 RED for invalid KPI runtime validation during review.
- `npm test -- packages/retrospectives/src/closedProjectSnapshot.test.ts` exit 0: 1 file, 4 tests passed.
- `npm test -- packages/project-core packages/workflow-engine packages/retrospectives` exit 0: 12 files, 58 tests passed.
- `npm run test:integration` exit 0: 11 files, 65 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `npm test` exit 0: 63 files, 411 tests passed.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase9-requirements-matrix.json` exit 0.
- `git diff --check` exit 0.

Next runnable block:
- `P9-002-project-closure-api-snapshot-readback`

Notes:
- P9 strict matrix is not expected to pass yet. E2E-080..083 are not implemented.
- Release 2 remains not ready until P9-P12 all pass their exit gates.
