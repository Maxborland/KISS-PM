# P8-004 Governed Action Execution API Dry Run Preview

Status: accepted block; P8 phase not accepted.

Changed:
- Added P8 action definitions/actions/preview/execute/audit routes.
- Added deterministic action preview state in `phase8Runtime`.
- Preview proves no mutation and validates input/target/permission.
- Execute rechecks stored preview target permission and returns `not_implemented` for real domain bindings until P8-006..008.

Verification:
- `node scripts/agent-bus-guard.mjs --task P8-004-governed-action-execution-api-dry-run-preview --once` exit 0 at startup.
- `npm test -- apps/api/src/phase8ActionExecutionApi.test.ts` exit 1 RED.
- `npm test -- apps/api/src/phase8ActionExecutionApi.test.ts` exit 0: 1 file, 7 tests passed.
- `npm test -- packages/action-engine apps/api/src/phase8ActionExecutionApi.test.ts apps/api/src/phase8ControlSurfacesApi.test.ts` exit 0: 4 files, 21 tests passed.
- `npm run test:integration` exit 0: 11 files, 57 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `npm test` exit 0: 59 files, 374 tests passed.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase8-requirements-matrix.json` exit 0.
- `git diff --check` exit 0.

Review findings:
- Code review found fake successful domain execution, missing input validation, and missing row policy context on preview/execute. Fixed by returning `not_implemented` for unwired domain bindings, validating action input schemas, resolving target rows before permission checks, and rechecking stored preview targets on execute.

Cleanup:
- Preview/action state is deterministic in-memory tenant state. No external state created. E2E reset/readback remains for P8-009.

Next:
- `P8-005-portfolio-control-surface-mvp`.
