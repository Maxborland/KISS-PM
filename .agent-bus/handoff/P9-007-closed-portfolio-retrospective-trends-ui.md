# P9-007 closed portfolio retrospective trends UI handoff

Updated: 2026-05-17T01:16:26.7081566+07:00

Status: accepted

Implemented:
- Typed P9 retrospective API client.
- Closed Portfolio / Retrospective Trends management surface.
- App shell wiring and navigation target for retrospectives.
- Loading, empty, error, and permission-denied states.
- Closed snapshot metrics, trend explanation, insight source trace, and action-entry state.
- Read-only action denial display without mutation methods.
- API readback refresh test proving rows come from fresh server-state data, not local append.

Changed files:
- `apps/web/src/retrospectiveApiClient.ts`
- `apps/web/src/ClosedPortfolioRetrospectiveSurface.tsx`
- `apps/web/src/ClosedPortfolioRetrospectiveSurface.test.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `docs/status/phase9-requirements-matrix.json`
- `.agent-bus/queue.json`
- `.agent-bus/state/CURRENT.md`

Verification:
- `node scripts/agent-bus-guard.mjs --task P9-007-closed-portfolio-retrospective-trends-ui --once` exit 0 at startup.
- `npm test -- apps/web/src/ClosedPortfolioRetrospectiveSurface.test.tsx` exit 1 RED: component module missing.
- `npm test -- apps/web/src/ClosedPortfolioRetrospectiveSurface.test.tsx` exit 0: 1 file, 4 tests passed.
- `npm test -- apps/web/src/App.test.tsx` exit 0: 1 file, 14 tests passed.
- `npm test -- apps/web/src` exit 0: 10 files, 83 tests passed.
- `npm test -- apps/api/src/phase9ClosedPortfolioApi.test.ts` exit 0: 1 file, 5 tests passed.
- `npm test` exit 0: 67 files, 429 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 1 before review fix: unused import.
- `npm run lint` exit 0 after review fix.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase9-requirements-matrix.json` exit 0.

Matrix:
- P9-007 has fresh UI/component evidence and remains blocked only for later deterministic E2E-082 browser reload/cleanup evidence.

Review:
- Bug-hunt/code-review scope check kept template-improvement preview/apply out of this UI block because P9-008 owns the write-flow.
- Lint found an unused test import; removed and reran affected test/lint.

Next:
- Claim `P9-008-template-improvement-governed-action`.
- Implement governed template-improvement preview/apply with permission checks, audit/action evidence, future-template-version readback, and UI feedback.
