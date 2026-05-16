# Agent Bus Current State

Updated: 2026-05-17T00:43:38.8195149+07:00

- Phase 8 Control Surfaces and Action Engine is accepted as an implemented product phase. P8-001..P8-010 are verified in `docs/status/phase8-requirements-matrix.json`, E2E-070..075 pass, and the strict Phase 8 verifier passes without `--allow-blocked`.
- Phase 9 Closed Portfolio and Retrospectives has accepted blocks:
  - `P9-000-closed-portfolio-retrospectives-phase-contract`
  - `P9-001-project-closure-snapshot-domain`
  - `P9-002-project-closure-api-snapshot-readback`
  - `P9-004-retrospective-plan-fact-trend-engine`
- New Phase 9 source-of-truth contract: `docs/phases/PHASE_9_CLOSED_PORTFOLIO_RETROSPECTIVES.md`.
- New Phase 9 tracking matrix: `docs/status/phase9-requirements-matrix.json` with P9-001..P9-010 blocked truthfully until implementation/E2E evidence exists.
- Verifier support now recognizes P9-001..P9-010 and E2E-080..083 paths:
  - E2E-080 `e2e/tests/phase9/project-closure.spec.ts`
  - E2E-081 `e2e/tests/phase9/closed-snapshot-stability.spec.ts`
  - E2E-082 `e2e/tests/phase9/closed-portfolio-trends.spec.ts`
  - E2E-083 `e2e/tests/phase9/template-improvement-action.spec.ts`
- `P9-001` implemented the closure workflow domain foundation in `packages/project-core` and the ClosedProjectSnapshot foundation in `packages/retrospectives`. Review fixes require targeted blocker overrides for open required tasks and runtime validation for snapshot KPI summaries.
- `P9-002` implemented closure readiness/preview/apply API, snapshot list/detail readback, immutable snapshot mutation denial, retrospective audit readback, backend permission guards, tenant isolation, dry-run-required apply, stale preview validation, and no-partial-write behavior for denied/stale/missing closure attempts.
- `P9-004` implemented deterministic PlanFactMetric and RetrospectiveTrend domain calculations from immutable ClosedProjectSnapshot source data only. Trend grouping supports project_type, template, client, and period; results are tenant-scoped and trace source snapshot/metric ids.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase9-requirements-matrix.json` passes with P9-001/P9-004 API/domain evidence. Strict verification intentionally fails until P9 UI/product implementation and E2E-080..083 are complete.
- Phase 9 E2E ids follow `docs/04_MASTER_PHASE_PLAN.md` and `docs/e2e/E2E_SCENARIOS.md`: P9 owns E2E-080..083. Older screen-catalog references to P9 E2E-090..092 are stale because Phase 10 owns E2E-090..095.
- Release 2 is not ready. P9-P12 remain not accepted as implemented product phases until their implementation, executable suites, and strict matrices pass.
- Next recommended step: claim `P9-005-retrospective-insight-model` and implement RetrospectiveInsight source snapshot/trend trace plus governed handled-state domain model before P9 closed portfolio/trends API work.
