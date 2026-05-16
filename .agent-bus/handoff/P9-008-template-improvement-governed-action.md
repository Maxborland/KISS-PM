# Handoff: P9-008 template improvement governed action

- Completed: 2026-05-17T01:38:29.2455852+07:00
- Agent: codex-agent-p9-008
- Verdict: accepted for block P9-008; Phase 9 remains blocked until deterministic fixtures and E2E-080..083 pass.

## Changed

- Added governed process-template improvement preview/apply helpers in `packages/tenant-config`.
- Added P9 runtime and API routes for retrospective insight template-improvement preview/apply.
- Added backend guards for `retrospective.improvement.write` and `tenant.config.write`.
- Added action/audit evidence and handled-insight/template-version readback.
- Added ClosedPortfolioRetrospectiveSurface preview/apply UI and typed client methods.
- Updated `docs/status/phase9-requirements-matrix.json` truthfully; P9-008 remains blocked only for E2E-083 browser reload/cleanup evidence.

## Verification

- `npm test -- apps/api/src/phase9ClosedPortfolioApi.test.ts` exit 0: 1 file, 8 tests passed.
- `npm test -- packages/action-engine packages/tenant-config apps/api/src/phase9ClosedPortfolioApi.test.ts apps/web/src` exit 0: 17 files, 123 tests passed.
- `npm run test:integration` exit 0: 12 files, 73 tests passed.
- `npm test` exit 0: 67 files, 436 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase9-requirements-matrix.json` exit 0.
- `node scripts/agent-bus-guard.mjs --task P9-008-template-improvement-governed-action --once` exit 0.
- `git diff --check` exit 0.

## Review

- Bug-hunt and code-review pass found one cosmetic test annotation indentation issue; fixed and reran the affected API test.
- No unresolved Critical/Important/Medium findings remain in P9-008 scope.

## Next

Claim `P9-009-deterministic-phase9-fixtures-e2e` and implement deterministic fixtures plus E2E-080..083.
