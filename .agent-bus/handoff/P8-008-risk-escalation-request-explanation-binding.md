# P8-008 Risk / Escalation / Request Explanation Binding

Completed: 2026-05-16T23:15:32.9030048+07:00
Verdict: accepted for P8-008 block only. Phase 8 is still blocked until P8-009 and P8-010.

## Changed

- Implemented governed P8 signal actions: `accept_risk`, `escalate`, and `request_explanation`.
- Added preview-before-execute, mandatory reason input, duplicate handled-signal prevention, audit/action evidence, and Portfolio Control readback for handled KPI signals.
- Hardened backend guards: accepted risk now requires generic `control.action:write` plus `risk:accept`; invalid date inputs are rejected; request-explanation rejects `requestedFrom` values that do not match the current actor.
- Updated Portfolio Control UI input builders for accepted risk, escalation, and request explanation.
- Updated `docs/status/phase8-requirements-matrix.json`, `.agent-bus/queue.json`, and `.agent-bus/state/CURRENT.md`.

## Verification

- `node scripts/agent-bus-guard.mjs --task P8-008-risk-escalation-request-explanation-binding --once` exit 0
- `npm test -- apps/api/src/phase8ActionExecutionApi.test.ts` exit 0: 1 file, 15 tests passed
- `npm test -- apps/web/src/PortfolioControlSurface.test.tsx` exit 0: 1 file, 13 tests passed
- `npm test -- packages/action-engine packages/kpi-engine apps/api/src/phase8ActionExecutionApi.test.ts apps/web/src/PortfolioControlSurface.test.tsx` exit 0: 5 files, 47 tests passed
- `npm run test:integration` exit 0: 11 files, 65 tests passed
- `npm run typecheck` exit 0
- `npm run lint` exit 0
- `npm test` exit 0: 60 files, 395 tests passed
- `node scripts/verify-requirements-matrix.mjs --allow-blocked docs/status/phase8-requirements-matrix.json` exit 0
- `git diff --check` exit 0

## Review Findings

- Important: accepted-risk execute path could be authorized by `risk:accept` without the generic action permission. Fixed with backend guard and test.
- Important: request-explanation could store a hardcoded/cross-actor `requestedFrom`. Fixed by requiring current actor id and updating UI input.
- Medium: accepted-risk expiry accepted invalid dates. Fixed by generic date validation and test.

## Next

Claim `P8-009-deterministic-phase8-fixtures-e2e` to implement deterministic Phase 8 fixtures and E2E-070..075 with UI/API readback, backend direct denial, audit/action evidence, projection refresh, reload persistence, and reset cleanup.
