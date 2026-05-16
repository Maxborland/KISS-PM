# P9-004 retrospective plan/fact trend engine handoff

Updated: 2026-05-17T00:43:38.8195149+07:00

Status: accepted

Implemented:
- `PlanFactMetric` domain read model.
- `RetrospectiveTrend` domain read model.
- `calculatePlanFactMetrics(snapshot)` for work hours, schedule days, overload count, and KPI drift.
- `buildRetrospectiveTrends({ tenantId, snapshots, groupBy })` grouped by `project_type`, `template`, `client`, or `period`.
- Snapshot project source opportunity capture for stable client grouping.
- Runtime validation for invalid schedule dates, invalid trend period timestamps, invalid `groupBy`, and cross-tenant-only input.
- Cloned/stable trend readback after input snapshot mutation.

Changed files:
- `packages/retrospectives/src/index.ts`
- `packages/retrospectives/src/retrospectiveTrends.test.ts`
- `docs/status/phase9-requirements-matrix.json`
- `.agent-bus/queue.json`
- `.agent-bus/state/CURRENT.md`

Verification:
- `node scripts/agent-bus-guard.mjs --task P9-004-retrospective-plan-fact-trend-engine --once` exit 0 at startup.
- `npm test -- packages/retrospectives/src/retrospectiveTrends.test.ts` exit 1 RED: P9-004 functions missing.
- `npm test -- packages/retrospectives/src/retrospectiveTrends.test.ts` exit 1 RED during review: invalid `closedAt`/`groupBy` were not rejected.
- `npm test -- packages/retrospectives/src/retrospectiveTrends.test.ts` exit 0: 1 file, 4 tests passed.
- `npm test -- packages/retrospectives` exit 0: 2 files, 8 tests passed.
- `npm run test:integration` exit 0: 12 files, 68 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `npm test` exit 0: 65 files, 418 tests passed.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase9-requirements-matrix.json` exit 0.

Matrix:
- P9-004 has fresh domain/unit evidence and remains blocked only because API/UI/E2E-082/E2E-083 reload/readback/cleanup evidence is not in this block.

Review:
- Bug-hunt/code-review found runtime validation gaps for `period` grouping and invalid `groupBy`.
- Findings were fixed and covered by regression assertions.
- Subagent review could not run because the active thread had reached the agent thread limit; local review gate was completed.

Next:
- Claim `P9-005-retrospective-insight-model`.
- Implement RetrospectiveInsight source snapshot/trend trace and governed handled-state domain model.
