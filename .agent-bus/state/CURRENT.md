# Agent Bus Current State

Updated: 2026-05-17T01:16:26.7081566+07:00

- Phase 8 Control Surfaces and Action Engine is accepted as an implemented product phase. P8-001..P8-010 are verified in `docs/status/phase8-requirements-matrix.json`, E2E-070..075 pass, and the strict Phase 8 verifier passes without `--allow-blocked`.
- Phase 9 Closed Portfolio and Retrospectives has accepted blocks:
  - `P9-000-closed-portfolio-retrospectives-phase-contract`
  - `P9-001-project-closure-snapshot-domain`
  - `P9-002-project-closure-api-snapshot-readback`
  - `P9-004-retrospective-plan-fact-trend-engine`
  - `P9-005-retrospective-insight-model`
  - `P9-006-closed-portfolio-trends-api-read-models`
  - `P9-007-closed-portfolio-retrospective-trends-ui`
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
- `P9-005` implemented RetrospectiveInsight source snapshot/trend/lesson trace and governed handled-state domain model. Handled state requires template_improvement.apply actionExecutionId/auditEventId evidence and matching tenant.
- `P9-006` implemented closed portfolio/trends/insight API read models from tenant-scoped closed snapshots, including pagination/filter basics, trend/insight readback, read-only action states without mutation URLs, direct read-only backend mutation denial, and Tenant B no-leak behavior.
- `P9-007` implemented the closed portfolio/trends management UI and typed retrospective API client. Component tests prove snapshot metrics, trend explanation, insight source trace, read-only action state, loading/empty/error/denied states, and API readback refresh without local-only row mutation.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase9-requirements-matrix.json` passes with P9-001/P9-007 API/domain/UI evidence. Strict verification intentionally fails until P9 template-improvement action and E2E-080..083 are complete.
- Phase 9 E2E ids follow `docs/04_MASTER_PHASE_PLAN.md` and `docs/e2e/E2E_SCENARIOS.md`: P9 owns E2E-080..083. Older screen-catalog references to P9 E2E-090..092 are stale because Phase 10 owns E2E-090..095.
- Release 2 is not ready. P9-P12 remain not accepted as implemented product phases until their implementation, executable suites, and strict matrices pass.
- Next recommended step: claim `P9-008-template-improvement-governed-action` and implement governed template-improvement preview/apply from retrospective insights.
