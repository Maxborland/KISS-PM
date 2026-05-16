# FE-SERVER-STATE-TANSTACK-QUERY-REVIEW-FIXES-001

Status: accepted

Changed:
- Fixed P3 CRM Intake so project draft readback only treats `not_found` as empty and surfaces permission/API failures as unconfirmed readback.
- Fixed P3/P4 mutation success semantics so required TanStack Query invalidations throw on readback failure instead of letting write flows claim success.
- Fixed P5 Gantt command handling so schedule command refetch throws on failed API readback and prop-driven project opens clear stale command success/issues.
- Added regression tests for CRM opportunity readback failure, CRM draft readback failure, Project Work queue readback failure, Gantt schedule readback failure, and stale Gantt command status after external project refresh.

Files:
- `apps/web/src/CrmIntakeControlSurface.tsx`
- `apps/web/src/CrmIntakeControlSurface.test.tsx`
- `apps/web/src/ProjectWorkControlSurface.tsx`
- `apps/web/src/ProjectWorkControlSurface.test.tsx`
- `apps/web/src/GanttControlSurface.tsx`
- `apps/web/src/GanttControlSurface.test.tsx`
- `.agent-bus/queue.json`
- `.agent-bus/state/CURRENT.md`

Verification:
- `npm test -- apps/web/src/CrmIntakeControlSurface.test.tsx apps/web/src/ProjectWorkControlSurface.test.tsx apps/web/src/GanttControlSurface.test.tsx` exit 0; 3 files / 24 tests.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `npm test` exit 0; 48 files / 291 tests.
- `npm run test:e2e:phase -- --phase 3` exit 0; E2E-020..024 passed.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase3-requirements-matrix.json` exit 0 after P3 E2E metadata.
- `npm run test:e2e:phase -- --phase 4` exit 0; E2E-030..034 passed.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase4-requirements-matrix.json` exit 0 after P4 E2E metadata.
- `npm run test:e2e:phase -- --phase 5` exit 0; E2E-040..044 passed.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase5-requirements-matrix.json` exit 0 after P5 E2E metadata.
- `git diff --check` exit 0.
- `node scripts/agent-bus-guard.mjs --task FE-SERVER-STATE-TANSTACK-QUERY-REVIEW-FIXES-001 --once` exit 0.

Review findings handled:
- High: TanStack Query invalidation/refetch could swallow readback errors and allow false success after writes. Fixed with `throwOnError: true` where the write flow requires readback proof.
- Medium: Gantt could preserve stale command success across external project open/refresh. Fixed by clearing command status/issues on prop-driven project changes.
- Medium: CRM draft readback masked all errors as an empty draft. Fixed by swallowing only expected `not_found`.

Risks / follow-up:
- Matrix verifier consumes a single latest `test-results/kiss-pm-e2e-last-run.json`; P3/P4/P5 strict matrix verification must be run immediately after the matching phase E2E command or with an explicit per-phase metadata path.

Verdict: accepted
