# Resources + Assignments Full Evaluation Closeout

Date: 2026-07-11

## Scope

Closed 25 literal matrix rows across `/resources` and `/assignments`: `PROJ-062..067` (A/PR), `PROJ-069`, `PROJ-070`, `PROJ-072` (A/PR), `PROJ-074`, `PROJ-075` (A/PR), `PROJ-077..080`, and `PROJ-118`.

## Final Evidence

- Resources manifest: `.superloopy/evidence/project-resources-assignments-2026-07-11/project-resources-assignments-machine.json` (`16/16 pass`).
- Assignments receipts: `.superloopy/evidence/project-resources-assignments-2026-07-11/proj-074-a.json` through `proj-080-a.json` (`8/8 pass`).
- Cross-flow receipt: `.superloopy/evidence/project-resources-assignments-2026-07-11/proj-118-admin-receipt.json` (`1/1 pass`).
- Evidence gate: 25 rows, 27 row-owned screenshots, 27 unique SHA-256 hashes, zero blocker artifacts.

Write rows include serialized preview/apply envelopes, API or PostgreSQL readback, reload and cleanup receipts. The immutable accepted-overload marker from PROJ-118 remains only in the explicitly disposable database; the assignment and overload are removed and the database is reset between closeout suites. `PROJ-118` performs a real Admin flow: add assignee, change role/work, apply a curve, observe the exact overload, accept it, replay the idempotency key, reject a conflicting replay, reload the marker, delete the assignment and prove the overload disappeared.

## Defects Fixed

1. Plan Reader could read planning data but received `403` from `GET /api/workspace/users`, leaving planning surfaces without the live directory. Same-tenant tenant.project_plan.read now grants a minimal resource-directory projection (id, name, position); PII and access-profile fields remain visible only to tenant-user readers, and user-management writes remain protected.
2. Assignment day cells used a divergent client-side flat calculation. They now render authoritative assignment contributions from the planning read-model.
3. Fractional assignment hours were rounded to integers. Cells and inputs now preserve minute-level values and reject empty or invalid input without writing.
4. Non-working assignment roles could display workload. Only executor/co-executor server contributions render load.
5. The assignment timeline range came from assignment activity instead of the project horizon. It now begins at `project.plannedStart` and includes `plannedFinish`.
6. Resource assignment-hour editing could double-submit on Enter, commit on Escape, and pass invalid values. Commit is single-shot, Escape cancels, and invalid or negative values do not write.
7. Resource drilldown labeled every occupancy as vacation. It now distinguishes absence, meeting, focus time and other occupancy types with exact hours.
8. Zero-capacity load displayed `0%`; it now shows an explicit unavailable value while preserving committed and overload hours.
9. Existing write E2E oracles ignored apply-only idempotency keys. They now compare command/version and assert the key separately.

## Fresh Verification

- Disposable PostgreSQL reset suite: `31/31`.
- Resources closeout Playwright: `3/3`, producing `16/16` row receipts.
- Assignments closeout Playwright: `1/1`, producing `8/8` row receipts.
- `PROJ-118` cross-flow Playwright: `1/1`.
- Existing Resources/Assignments write Playwright: `5/5`.
- Focused UI tests: `8/8`.
- TypeScript: pass.

## Matrix Result

Global matrix: `194 pass / 29 non-pass` out of `223` rows. Remaining: `19 historical_evidence_only`, `6 fail`, `2 blocked`, `1 partial`, `1 unverified`.
