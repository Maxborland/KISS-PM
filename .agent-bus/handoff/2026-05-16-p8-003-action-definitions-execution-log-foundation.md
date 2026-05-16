# P8-003 Action Definitions Execution Log Foundation

Status: accepted block; P8 phase not accepted.

Changed:
- `packages/action-engine` now defines action definitions, input schemas, command bindings, audit policy, and binding registry foundation.
- `ActionExecutionLog` now supports source-surface refs, input summaries, audit ids, permission traces, and precondition traces.
- P8 source-surface logs enforce permission/precondition/audit evidence where material.
- Existing project-draft command compatibility is preserved and enriched with deterministic audit/trace evidence.

Verification:
- `node scripts/agent-bus-guard.mjs --task P8-003-action-definitions-execution-log-foundation --once` exit 0 at startup.
- `npm test -- packages/action-engine/src/actionDefinition.test.ts` exit 1 RED.
- `npm test -- packages/action-engine/src/actionDefinition.test.ts packages/action-engine/src/projectDraftCommand.test.ts` exit 0: 2 files, 8 tests passed.
- `npm test -- packages/action-engine apps/api/src/phase5ScheduleApi.test.ts apps/api/src/phase6ResourcePlanningApi.test.ts apps/api/src/phase7KpiApi.test.ts` exit 0: 5 files, 25 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `npm test` exit 0: 58 files, 367 tests passed.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase8-requirements-matrix.json` exit 0.
- `git diff --check` exit 0.

Review findings:
- Bug-hunt/full suite caught compatibility break from over-broad audit-id guard. Fixed by scoping strict audit guard to P8 source-surface logs and enriching project-draft evidence.
- Code review found missing audit ids for create-style actions, missing permission/precondition traces for successful P8 logs, and missing registry foundation. Fixed with stricter source-surface guards, project-draft evidence, and `createActionCommandBindingRegistry`.

Cleanup:
- Pure package model/test change; no runtime or external state created.

Next:
- `P8-004-governed-action-execution-api-dry-run-preview`.
