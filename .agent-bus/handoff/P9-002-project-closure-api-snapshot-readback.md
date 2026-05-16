# P9-002 project closure API snapshot readback handoff

Updated: 2026-05-17T00:33:05.9566428+07:00

Status: accepted

Implemented:
- Closure readiness/readback API for Phase 9 project closure.
- Governed closure dry-run preview and apply flow.
- Immutable closed-project snapshot list/detail readback.
- Retrospective audit/action readback.
- Backend permission guards for preview/apply and read-only denial.
- Tenant isolation for project closure and snapshot access.
- Stale-preview detection using preview state version plus project fingerprint.
- No-partial-write behavior for denied, stale, missing-preview, and failed-precondition attempts.

Changed files:
- `apps/api/src/app.ts`
- `apps/api/src/phase2Runtime.ts`
- `apps/api/src/phase4Runtime.ts`
- `apps/api/src/phase9Runtime.ts`
- `apps/api/src/phase9ClosedPortfolioApi.test.ts`
- `docs/status/phase9-requirements-matrix.json`
- `.agent-bus/queue.json`
- `.agent-bus/state/CURRENT.md`

Verification:
- `node scripts/agent-bus-guard.mjs --task P9-002-project-closure-api-snapshot-readback --once` exit 0 at startup.
- `npm test -- apps/api/src/phase9ClosedPortfolioApi.test.ts` exit 1 RED: P9 closure/snapshot API routes missing before implementation.
- `npm test -- apps/api/src/phase9ClosedPortfolioApi.test.ts` exit 1 RED during review: direct/stale apply left partial audit events before preview validation.
- `npm test -- apps/api/src/phase9ClosedPortfolioApi.test.ts` exit 1 RED during review: non-blocking project changes after preview were still applied instead of `stale_preview`.
- `npm test -- apps/api/src/phase9ClosedPortfolioApi.test.ts` exit 0: 1 file, 3 tests passed.
- `npm test -- apps/api/src/phase9ClosedPortfolioApi.test.ts packages/project-core packages/retrospectives` exit 0: 11 files, 59 tests passed.
- `npm run test:integration` exit 0: 12 files, 68 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase9-requirements-matrix.json` exit 0.
- `npm test` exit 0: 64 files, 414 tests passed.
- `git diff --check` exit 0.

Matrix:
- P9-001, P9-002, and P9-003 carry fresh API/domain evidence from this block.
- Rows remain blocked truthfully until UI/E2E-080..083, reload persistence, and reset cleanup evidence are implemented.
- Strict P9 verifier is still expected to fail until later P9 blocks complete.

Review:
- Bug-hunt/code-review found partial audit before preview validation and missing stale-preview invalidation for non-blocking project mutations.
- Both findings were fixed and covered by regression assertions.

Next:
- Claim `P9-004-retrospective-plan-fact-trend-engine`.
- Implement deterministic PlanFactMetric and RetrospectiveTrend calculations from ClosedProjectSnapshot source data only.

Risks:
- `apps/api/src/phase9Runtime.ts` imports `packages/retrospectives` via relative source path because package dependency/root ownership was not in scope. Convert to workspace dependency when package ownership allows.
