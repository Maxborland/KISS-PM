# P11-006 integrations API governed import commands handoff

Status: accepted
Updated: 2026-05-17T07:20:04.5500545+07:00
Agent: codex-p11-006

Changed:
- Added governed P11 integrations API routes in `apps/api/src/app.ts`.
- Added Phase 11 API permissions to `apps/api/src/phase2Runtime.ts`.
- Added runtime readback for connection failure mode in `apps/api/src/phase11Runtime.ts`.
- Added `apps/api/src/phase11IntegrationsApi.test.ts`.
- Updated `docs/status/phase11-requirements-matrix.json`.

Evidence:
- API routes cover adapters, connections, diagnostics/failure modes, preview, validation report, dry-run summary, apply, batches, mappings, and audit.
- Tests prove non-mutating preview, governed apply, backend permission denial, tenant isolation, stale preview denial with no partial mutation, invalid payload failure diagnostics, rate-limit diagnostics, recovery, idempotent replay, audit/action readback, and reset-compatible in-memory state.

Verification:
- `npm test -- apps/api/src/phase11IntegrationsApi.test.ts` exit 1 RED: missing P11 API routes before implementation.
- `npm test -- apps/api/src/phase11IntegrationsApi.test.ts` exit 1 RED during bug-hunt: repeated preview calls reused the same generated id.
- `npm test -- apps/api/src/phase11IntegrationsApi.test.ts` exit 0: 1 file, 7 tests passed.
- `npm test -- apps/api/src/phase11IntegrationsApi.test.ts apps/api/src/phase11Runtime.test.ts` exit 0: 2 files, 17 tests passed.
- `npm test -- packages/integrations apps/api/src/phase11IntegrationsApi.test.ts apps/api/src/phase11Runtime.test.ts` exit 0: 6 files, 36 tests passed.
- `npm test -- apps/api/src` exit 0: 21 files, 111 tests passed.
- `npm test` exit 0: 99 files, 569 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase11-requirements-matrix.json` exit 0.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase11-requirements-matrix.json` exit 1 expected: P11 strict gate still blocked by P11-007..P11-010 and E2E-100..104.
- `git diff --check` exit 0.

Review:
- Bug-hunt found duplicate API-generated preview ids, fixed with monotonic preview ids and reset coverage.
- Code-review pass did not leave Critical/Important/Medium findings in P11-006 scope.

Next runnable:
- `P11-007-integration-admin-diagnostics-ui`.
