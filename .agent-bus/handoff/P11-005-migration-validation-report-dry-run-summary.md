# P11-005 Migration Validation Report / Dry-Run Summary Handoff

Status: accepted for block scope; Phase 11 remains blocked pending P11-006..P11-010 and E2E-100..104.

Completed at: 2026-05-17T07:02:46.4127015+07:00

Changed:
- `packages/integrations/src/index.ts`
  - Added `MigrationValidationReport` and `ImportDryRunSummary`.
  - Added `createMigrationValidationReport` and `createImportDryRunSummary`.
  - Reports are derived from preview state, `mutatesState=false`, and exclude raw payload/canonical bodies.
- `packages/integrations/src/migrationValidationReport.test.ts`
  - Added RED/GREEN tests for counts, blockers, warnings, recovery text, samples, non-mutation, payload-leak checks, and invalid sample limits.
- `apps/api/src/phase11Runtime.ts`
  - Added tenant-scoped `getMigrationValidationReport` and `getImportDryRunSummary`.
  - Rejects stale previews for report/dry-run readback so evidence cannot greenlight a preview that apply would reject.
- `apps/api/src/phase11Runtime.test.ts`
  - Added readback/no-mutation and cross-tenant denial coverage.
- `docs/status/phase11-requirements-matrix.json`
  - Updated P11-005 evidence truthfully; row remains blocked only for E2E-100/E2E-102.
- `.agent-bus/queue.json`
  - Marked P11-005 done and created next runnable `P11-006-integrations-api-governed-import-commands`.
- `.agent-bus/state/CURRENT.md`
  - Updated P11 current state and next step.

Verification:
- `node scripts/agent-bus-guard.mjs --task P11-005-migration-validation-report-dry-run-summary --once` exit 0 at startup.
- `npm test -- packages/integrations/src/migrationValidationReport.test.ts apps/api/src/phase11Runtime.test.ts` exit 1 RED: helpers/accessors missing.
- `npm test -- packages/integrations/src/migrationValidationReport.test.ts apps/api/src/phase11Runtime.test.ts` exit 0: 2 files, 13 tests passed.
- `npm test -- packages/integrations apps/api/src/phase11Runtime.test.ts` exit 0: 5 files, 29 tests passed.
- `npm test` exit 1 first run: unrelated `apps/web/src/App.test.tsx` label lookup failed; targeted rerun passed.
- `npm test -- apps/web/src/App.test.tsx` exit 0: 1 file, 14 tests passed.
- `npm test` exit 0: 98 files, 562 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.

Review:
- Bug-hunt local review found and fixed stale report/dry-run readback: stale previews now throw `stale_preview`, matching apply preconditions.
- The initial payload-leak assertion was too broad because validation issue code/message legitimately contained the word `canonical`; assertion was narrowed to raw payload field leakage.
- No unresolved Critical/Important/Medium findings in P11-005 scope at handoff time.

Next:
- Claim `P11-006-integrations-api-governed-import-commands`.
- Expose adapter list, connections, preview/apply, validation report, dry-run summary, batch/mapping/audit/diagnostics API routes with backend permission checks and tenant isolation.
