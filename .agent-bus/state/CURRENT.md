# Agent Bus Current State

Updated: 2026-05-16T21:31:51.000+07:00

- P8-000 Control surfaces and action engine phase contract completed with verdict accepted.
- Phase 8 is now contract-ready and P8-001/P8-002/P8-003 implementation blocks are accepted. P8 is not an accepted product phase.
- New source-of-truth contract: `docs/phases/PHASE_8_CONTROL_SURFACES_ACTION_ENGINE.md`.
- New tracking matrix: `docs/status/phase8-requirements-matrix.json` with P8-001..P8-010 blocked truthfully until implementation and E2E evidence exist.
- Matrix verifier now knows P8 E2E-070..075 paths and required row mappings, including E2E-074 permission/action-availability coverage for P8-002 and P8-005. `--allow-blocked` tracking verification passes; strict P8 matrix verification intentionally fails while all rows are blocked.
- P8-001 implemented tenant-owned `ControlSurfaceDefinition` / `ControlSurfaceView` domain foundation in `packages/control-surfaces`, including malformed DTO guards and nested enum validation from review fixes. Matrix row P8-001 remains blocked for phase-exit verification until later E2E-070/E2E-074/E2E-075 evidence exists.
- P8-002 implemented control surface read DTO/data-source/API foundation. `packages/control-surfaces` now builds tenant-scoped read DTOs with source refs, severity widgets, drilldowns, backend-policy availability hooks, strict pagination guards, and no execute URLs. `apps/api` exposes `GET /api/control/surfaces`, `GET /api/control/surfaces/:surfaceId`, and `GET /api/control/surfaces/:surfaceId/view` using P6/P7 deterministic projections and backend `control.surface:read` checks. Matrix row P8-002 remains blocked for phase-exit verification until UI/E2E reload, permission visibility, and cleanup/readback evidence exists.
- P8-003 implemented action-engine foundation: `ActionDefinition`, input schemas, command bindings, audit policy, command binding registry, source-surface action execution refs, input summaries, audit ids, permission traces, and precondition traces. P8 source-surface logs now require permission/precondition/audit evidence where material. Matrix row P8-003 remains blocked for phase-exit verification until API execution routes and E2E-071..075 prove write-flow audit/readback/cleanup.
- Release 2 is not ready. P8-P12 remain not accepted as implemented product phases until their implementation, executable suites, and strict matrices pass.
- Next recommended step: claim `P8-004-governed-action-execution-api-dry-run-preview` and implement governed preview/execute/audit API runtime.
