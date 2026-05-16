# P8-001 Control Surface Definition View Model Foundation

Status: accepted
Task: `P8-001-control-surface-definition-view-model-foundation`
Completed: 2026-05-16T13:54:18.207Z

## Changed
- Implemented tenant-owned `ControlSurfaceDefinition` and `ControlSurfaceView` model foundation in `packages/control-surfaces`.
- Added validation for data sources, fields, widgets, action slots, drilldowns, saved views, permission requirements, versioning, tenant mismatch, duplicate keys, runtime-invalid enum values, malformed DTOs, and field references.
- Added unit tests covering Portfolio, KPI Deviation, Resource Load, CRM Intake, and My Work surface definitions without tenant-specific branches.
- Updated P8 matrix row P8-001 with domain/test evidence, while keeping it blocked for required API/E2E evidence.
- Queued `P8-002-control-surface-data-source-read-dtos` as next runnable block.

## Verification
- `node scripts/agent-bus-guard.mjs --task P8-001-control-surface-definition-view-model-foundation --once` exit 0 at startup.
- RED: `npm test -- packages/control-surfaces` exit 1 before implementation: missing model functions.
- RED: `npm test -- packages/control-surfaces` exit 1 before enum guards: invalid runtime surface type accepted.
- RED: `npm test -- packages/control-surfaces` exit 1 before review fixes: malformed DTO TypeError and invalid nested enums accepted.
- GREEN: `npm test -- packages/control-surfaces` exit 0: 1 file, 8 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase8-requirements-matrix.json` exit 0.
- `git diff --check` exit 0.
- `node scripts/agent-bus-guard.mjs --task P8-001-control-surface-definition-view-model-foundation --once` exit 0 after locks removed.

## Notes
- No runtime state, external services, package dependencies, API routes, UI, fixtures, or E2E tests were changed in this block.
- P8-001 remains blocked in the phase matrix until later P8 API/read-model and E2E-070/E2E-074/E2E-075 evidence exist.
- Review loop closed the in-scope Important/Medium findings before handoff.

## Next
Claim `P8-002-control-surface-data-source-read-dtos`.
