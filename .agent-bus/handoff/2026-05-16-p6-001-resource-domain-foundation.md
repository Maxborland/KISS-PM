# Handoff: P6-001 Resource Domain Foundation

Status: accepted
Task: P6-001-resource-domain-foundation
Agent: codex-agent-2
Time: 2026-05-16T15:26:45+07:00

## Changed

- Added Phase 6 resource planning domain primitives and deterministic calculations in `packages/resource-planning/src/index.ts`.
- Added `packages/resource-planning/src/resourceOperationalPlanning.test.ts` covering:
  - resource profiles and calendars;
  - availability exceptions;
  - capacity period buckets;
  - assignment and reservation load buckets;
  - overload detection/severity;
  - cross-tenant validation order;
  - duplicate-id rejection.
- Updated `docs/status/phase6-requirements-matrix.json` with P6-001..P6-005 domain/unit evidence while keeping rows blocked for API/UI/E2E evidence.
- Updated `.agent-bus/queue.json` to mark P6-001 done and create next runnable block `P6-006-resource-planning-api-governed-commands`.

## Verification

- `npm test -- packages/resource-planning/src/resourceOperationalPlanning.test.ts` exit 0: 5 tests passed.
- `npm test -- packages/resource-planning` exit 0: 4 files, 20 tests passed.
- `npm test -- packages/resource-planning packages/project-core packages/scheduling-engine` exit 0: 14 files, 92 tests passed.
- `npm test` exit 0: 45 files, 272 tests passed.
- `npm run test:integration` exit 0: 7 files, 33 tests passed.
- `npm run typecheck` exit 0.
- `npm run lint` exit 0.
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase6-requirements-matrix.json` exit 0.
- `node scripts/agent-bus-guard.mjs --task P6-001 --once` exit 0.
- `git diff --check` exit 0.

## Review Findings

- Bug-hunt finding: foreign calendars/reservations with malformed fields could expose validation details before tenant mismatch. Fixed by prechecking tenant ownership before deep validation.
- Bug-hunt finding: `absence` exceptions could accept non-zero capacity. Fixed by rejecting absence capacity other than 0.
- Code-review finding: duplicate resource/capacity/assignment/reservation ids could double-count or make ambiguous load. Fixed with duplicate-id guards and regression tests.

## Remaining Blockers

- P6 strict phase exit remains blocked until API, UI, fixtures, E2E-050..055, permissions, audit readback, reload, and cleanup evidence exist.
- No API or UI code was changed in this block.

## Next Step

Claim `P6-006-resource-planning-api-governed-commands` and implement resource load/read, overload detail, reservation, preview, apply, and audit API contracts against the new domain foundation.
