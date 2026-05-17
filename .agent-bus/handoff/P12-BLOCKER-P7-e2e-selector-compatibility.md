# Handoff: P12-BLOCKER-P7-e2e-selector-compatibility

Status: accepted

Phase / block: P12 release gate blocker fix for Phase 7 E2E regression.

Changed:
- Scoped E2E-062 warning-signal click to `kpi-deviation-list`.
- Scoped E2E-063 KPI threshold input and admin actions to `kpi-definition-admin`.
- No product code changed.

Verification:
- `npm run test:e2e:phase -- --phase 7`: exit 0, 5 passed.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase7-requirements-matrix.json`: exit 0.
- `npm run test:e2e:phase -- --phase 12`: exit 0, 6 passed.
- `git diff --check`: exit 0.
- `node scripts/agent-bus-guard.mjs --task P12-BLOCKER-P7-e2e-selector-compatibility --once`: exit 0.

Review findings:
- Bug-hunt finding: unscoped accessible-name selectors became ambiguous after accepted later-phase surfaces rendered duplicate controls; fixed by targeting the intended Phase 7 surface.
- Code-review finding: avoid using `.first()` because it could hide a real UI collision; fixed with explicit surface-scoped locators.

Next:
- Resume `P12-010-phase12-verification-matrix-market-release-exit-gate`.
