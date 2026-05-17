# P11-007 Integration Admin Diagnostics UI handoff

Status: accepted for this block on 2026-05-17T07:38:03.8196229+07:00.

Changed:
- Added `apps/web/src/integrationAdminDiagnosticsApiClient.ts`.
- Added `apps/web/src/IntegrationAdminDiagnosticsSurface.tsx`.
- Added `apps/web/src/IntegrationAdminDiagnosticsSurface.test.tsx`.
- Wired the surface into `apps/web/src/App.tsx`.
- Added minimal integration-admin layout/select styles in `apps/web/src/styles.css`.
- Updated `docs/status/phase11-requirements-matrix.json` P11-007 truthfully.

Evidence:
- RED: `npm test -- apps/web/src/IntegrationAdminDiagnosticsSurface.test.tsx` exit 1 before component/client implementation.
- `npm test -- apps/web/src/IntegrationAdminDiagnosticsSurface.test.tsx` exit 0, 6 tests passed.
- `npm test -- apps/web/src/App.test.tsx` exit 0, 14 tests passed.
- `npm test -- apps/web/src` exit 0, 19 files / 121 tests passed.
- `npm test -- apps/api/src/phase11IntegrationsApi.test.ts` exit 0, 7 tests passed.
- `npm test -- packages/integrations` exit 0, 4 files / 19 tests passed.
- `npm test` exit 0, 100 files / 575 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase11-requirements-matrix.json` exit 0.
- Strict matrix exit 1 expected because P11-001..P11-010 remain blocked until E2E-100..104 evidence exists.
- `git diff --check` exit 0.
- `node scripts/agent-bus-guard.mjs --task P11-007-integration-admin-diagnostics-ui --once` exit 0.

Review:
- Bug-hunt found a Medium write-flow issue: successful apply followed by failed readback refetch could be shown as an import rejection. Fixed by separating apply failure from post-apply readback failure and adding a component test that keeps applied result evidence visible.
- Code-review subagent could not be spawned because the thread limit was reached; local review found no remaining Critical/Important/Medium issues in scope after the fix.

Matrix:
- P11-007 remains `blocked` only for missing E2E-102 and E2E-104 structured Playwright evidence.
- `--allow-blocked` verifier passes.

Next:
- Claim `P11-008-imported-project-works-without-adapter`.
- Keep deterministic fixtures and executable E2E-100..104 work for P11-009 unless P11-008 uncovers a required blocker fix.
