# P7-001 KPI Domain Safe Formula Foundation

Status: accepted

## Changed

- Implemented `packages/kpi-engine` domain primitives for tenant-owned KPI definitions, formula definitions, threshold rule sets, source values, evaluations, threshold results, and KPI control signals.
- Implemented constrained arithmetic formula parsing/evaluation without JavaScript execution, dynamic imports, property access, arbitrary globals, or side effects.
- Added deterministic threshold severity mapping, KPI evaluation trace, source trace validation, and signal upsert semantics for matching open signals.
- Updated P7 matrix rows P7-001..P7-005 with fresh domain evidence while keeping them blocked until API/UI/E2E evidence exists.
- Added next runnable task `P7-006-kpi-api-governed-commands`.

## Evidence

- `npm test -- packages/kpi-engine` exit 0: 1 file, 11 tests passed.
- `npm run test:integration` exit 0: 8 files, 39 tests passed.
- `npm test` first run exit 1: unrelated/order-sensitive P4 ProjectWorkControlSurface reload test failed.
- `npm test -- apps/web/src/ProjectWorkControlSurface.test.tsx` exit 0: 7 tests passed.
- `npm test` rerun exit 0: 50 files, 310 tests passed.
- `npm run typecheck -- --pretty false` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase7-requirements-matrix.json` exit 0.

## Review Findings

- Bug Hunt: date validation was regex-only and source trace fields were under-validated. Fixed with strict calendar date parsing, UTC ISO datetime validation, source entity id validation, and regression tests.
- Requested code review: future API JSON could bypass TypeScript enum safety, duplicate threshold ids were ambiguous, and inactive KPI definitions could still evaluate. Fixed runtime enum guards, duplicate threshold rule rejection, inactive KPI rejection, and regression tests.
- No unresolved Critical/Important/Medium findings remain in P7-001 scope.

## Matrix

- P7-001..P7-005 contain domain/unit evidence and cleanup notes.
- Rows intentionally remain `blocked` because API/UI/E2E-060..064 evidence is not implemented in this block.
- Tracking verifier passes with `--allow-blocked`; strict P7 phase exit remains blocked.

## Next

Claim `P7-006-kpi-api-governed-commands`.
