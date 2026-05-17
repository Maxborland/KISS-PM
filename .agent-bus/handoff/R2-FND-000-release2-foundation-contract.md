# Handoff: R2-FND-000 Release 2 Foundation Contract

Updated: 2026-05-17T11:30:03.4388292+07:00

Status: accepted

## Summary

Merged the actionable findings from `docs/roadmap/RELEASE_2_PLANNING_AUDIT.md` into the main Release 2 implementation planning files.

This was a docs/planning-only task. No product code, package files, E2E tests, or phase status matrices were changed.

## Changed

- Created `docs/roadmap/RELEASE_2_FOUNDATION_CONTRACT.md`.
- Updated `docs/roadmap/RELEASE_2_DEPTH_HARDENING.md` to point to the foundation contract as the current first release-detail contract.
- Updated `docs/roadmap/RELEASE_2_IMPLEMENTATION_DECOMPOSITION.md` so the audit findings are operationalized through the foundation contract.
- Updated `docs/backlog/FUTURE_SCOPE.md` with the current contract and next recommended task.
- Updated `.agent-bus/queue.json` and `.agent-bus/state/CURRENT.md`.

## Key Decisions

- Default first Release 2 slice is foundation/security-first unless product leadership records stronger evidence for a different slice.
- First promotion pool: `R2-ACT-001`, `R2-DATA-001`, `R2-TEN-001`, `R2-TEN-004`, `R2-SEC-001`, `R2-PERF-001`, then `R2-SCH-001` as first product-depth candidate.
- Next runnable task is `R2-ACT-001-governed-command-audit-contract-hardening`.
- Planned Release 2 functionality remains preserved; narrowing the first slice is sequencing, not deletion.

## Verification

Run before handoff:

- `node scripts/agent-bus-guard.mjs --task R2-FND-000-release2-foundation-contract --once`
- `node -e "JSON.parse(require('fs').readFileSync('.agent-bus/queue.json','utf8'))"`
- `rg -n "RELEASE_2_FOUNDATION_CONTRACT|R2-ACT-001|foundation/security-first|matrix/verifier|E2E truth" docs/roadmap docs/backlog/FUTURE_SCOPE.md .agent-bus/state/CURRENT.md`
- `git diff --check`

## Next

Claim `R2-ACT-001-governed-command-audit-contract-hardening`.
