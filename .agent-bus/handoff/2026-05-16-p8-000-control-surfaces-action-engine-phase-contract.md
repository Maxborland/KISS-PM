# P8-000 Control Surfaces Action Engine Phase Contract

Status: accepted
Task: `P8-000-control-surfaces-action-engine-phase-contract`
Completed: 2026-05-16T13:37:39.2080052Z

## Changed
- Added Phase 8 phase-detail contract with finite P8-001..P8-010 backlog.
- Added `docs/status/phase8-requirements-matrix.json` with all rows blocked truthfully until implementation and E2E evidence exist.
- Added verifier support and tests for P8 required rows and E2E-070..075 path/evidence mapping.
- Updated agent-bus queue/state and queued `P8-001-control-surface-definition-view-model-foundation` as next runnable block.

## Verification
- `node scripts/agent-bus-guard.mjs --task P8-000-control-surfaces-action-engine-phase-contract --once` exit 0 at startup.
- `npm test -- scripts/verify-requirements-matrix.test.ts` exit 0: 49 tests passed.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase8-requirements-matrix.json` exit 0.
- `node scripts/verify-requirements-matrix.mjs docs/status/phase8-requirements-matrix.json` exit 1: expected blocked P8-001..P8-010 until implementation/E2E evidence exists.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `git diff --check` exit 0.
- `node scripts/agent-bus-guard.mjs --task P8-000-control-surfaces-action-engine-phase-contract --once` exit 0 after locks removed.

## Review fixes
- Fixed Important cleanup fake-green risk: P8 verified rows now reject placeholder cleanup evidence, and the complete P8 verifier fixture uses concrete cleanup/readback wording.
- Fixed Important permission coverage gap: P8-002 and P8-005 now require E2E-074 in contract, matrix, verifier mapping, and tests.

## Notes
- This block is contract-only. No app/package product implementation was performed.
- Strict P8 phase exit is still blocked by design until P8 implementation, E2E-070..075, and P8-010 exit gate complete.

## Next
Claim `P8-001-control-surface-definition-view-model-foundation`.
