# P9-006 closed portfolio and trends API read models handoff

Updated: 2026-05-17T01:07:11.3735029+07:00

Status: accepted

Implemented:
- `GET /api/retrospectives/closed-portfolio`.
- `GET /api/retrospectives/trends`.
- `GET /api/retrospectives/insights/:insightId`.
- Read-only backend denial for `POST /api/retrospectives/insights/:insightId/template-improvement/apply`.
- Closed portfolio read model over `createControlSurfaceReadModel`.
- Snapshot-based trend and insight readback from P9 retrospective domain functions.
- Pagination and `templateId` / `clientId` / `period` filter basics.
- Read-only action states without mutation URLs.
- Tenant B not_found/no-leak behavior for Tenant A insight ids.
- Review fixes for missing filter evidence, groupBy-independent insight readback, and lint cleanup.

Changed files:
- `apps/api/src/app.ts`
- `apps/api/src/phase2Runtime.ts`
- `apps/api/src/phase9Runtime.ts`
- `apps/api/src/phase9ClosedPortfolioApi.test.ts`
- `docs/status/phase9-requirements-matrix.json`
- `.agent-bus/queue.json`
- `.agent-bus/state/CURRENT.md`

Verification:
- `node scripts/agent-bus-guard.mjs --task P9-006-closed-portfolio-trends-api-read-models --once` exit 0 at startup.
- `npm test -- apps/api/src/phase9ClosedPortfolioApi.test.ts` exit 1 RED: closed portfolio/trends routes returned 404 before implementation.
- `npm test -- apps/api/src/phase9ClosedPortfolioApi.test.ts` exit 0: 1 file, 5 tests passed.
- `npm test -- packages/retrospectives packages/control-surfaces` exit 0: 5 files, 26 tests passed.
- `npm run test:integration` exit 0: 12 files, 70 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 1 before review fix: unused import.
- `npm run lint` exit 0 after review fix.
- `npm test` exit 0: 66 files, 425 tests passed.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase9-requirements-matrix.json` exit 0.

Matrix:
- P9-006 now has fresh API/domain evidence and remains blocked only for later UI/E2E-082 browser readback, reload persistence, and cleanup/reset.

Review:
- Bug-hunt/code-review found missing filter coverage and groupBy-specific insight readback. Fixed and covered by regression assertions.
- Lint caught an unused import after implementation cleanup. Fixed and rerun.

Next:
- Claim `P9-007-closed-portfolio-retrospective-trends-ui`.
- Implement the closed portfolio/trends management UI over the accepted P9-006 API.
