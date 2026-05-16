# Agent Bus Current State

Updated: 2026-05-16T23:49:57.1338658+07:00

- Phase 8 Control Surfaces and Action Engine is accepted as an implemented product phase. P8-001..P8-010 are verified in `docs/status/phase8-requirements-matrix.json`, E2E-070..075 pass, and the strict Phase 8 verifier passes without `--allow-blocked`.
- Phase 9 Closed Portfolio and Retrospectives has an accepted phase contract block: `P9-000-closed-portfolio-retrospectives-phase-contract`.
- New Phase 9 source-of-truth contract: `docs/phases/PHASE_9_CLOSED_PORTFOLIO_RETROSPECTIVES.md`.
- New Phase 9 tracking matrix: `docs/status/phase9-requirements-matrix.json` with P9-001..P9-010 blocked truthfully until implementation/E2E evidence exists.
- Verifier support now recognizes P9-001..P9-010 and E2E-080..083 paths:
  - E2E-080 `e2e/tests/phase9/project-closure.spec.ts`
  - E2E-081 `e2e/tests/phase9/closed-snapshot-stability.spec.ts`
  - E2E-082 `e2e/tests/phase9/closed-portfolio-trends.spec.ts`
  - E2E-083 `e2e/tests/phase9/template-improvement-action.spec.ts`
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase9-requirements-matrix.json` passes for the initial tracking state. Strict verification intentionally fails until P9 product implementation and E2E-080..083 are complete.
- Phase 9 E2E ids follow `docs/04_MASTER_PHASE_PLAN.md` and `docs/e2e/E2E_SCENARIOS.md`: P9 owns E2E-080..083. Older screen-catalog references to P9 E2E-090..092 are stale because Phase 10 owns E2E-090..095.
- Release 2 is not ready. P9-P12 remain not accepted as implemented product phases until their implementation, executable suites, and strict matrices pass.
- Next recommended step: claim `P9-001-project-closure-snapshot-domain` and implement the closure workflow / ClosedProjectSnapshot domain foundation before P9 API/UI/E2E work.
