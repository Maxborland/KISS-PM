# Agent Bus Current State

Updated: 2026-05-16T13:59:29.000Z

- P8-000 Control surfaces and action engine phase contract completed with verdict accepted.
- Phase 8 is now contract-ready and P8-001 domain foundation is implemented. P8 is not an accepted product phase.
- New source-of-truth contract: `docs/phases/PHASE_8_CONTROL_SURFACES_ACTION_ENGINE.md`.
- New tracking matrix: `docs/status/phase8-requirements-matrix.json` with P8-001..P8-010 blocked truthfully until implementation and E2E evidence exist.
- Matrix verifier now knows P8 E2E-070..075 paths and required row mappings, including E2E-074 permission/action-availability coverage for P8-002 and P8-005. `--allow-blocked` tracking verification passes; strict P8 matrix verification intentionally fails while all rows are blocked.
- P8-001 implemented tenant-owned `ControlSurfaceDefinition` / `ControlSurfaceView` domain foundation in `packages/control-surfaces`, including malformed DTO guards and nested enum validation from review fixes. Matrix row P8-001 remains blocked for phase-exit verification until later API/read-model and E2E-070/E2E-074/E2E-075 evidence exist.
- Release 2 is not ready. P8-P12 remain not accepted as implemented product phases until their implementation, executable suites, and strict matrices pass.
- Next recommended step: claim `P8-002-control-surface-data-source-read-dtos` and implement the control surface data-source abstraction/read DTO layer.
