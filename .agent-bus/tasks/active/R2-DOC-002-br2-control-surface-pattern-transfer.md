# Task: R2-DOC-002-br2-control-surface-pattern-transfer - Clean-room Release 2 control surface pattern transfer

Status: done
Priority: critical
Owner / claimed by: Codex

## Goal

Integrate the supplied sanitized BitrixReports surface transfer package into KISS PM documentation as a clean-room Release 2 control-surface/product-design specification.

## Context

- Source package: `docs/bitrixreports_surfaces_kisspm_transfer_package.zip`
- Release 2 UI/UX and Project Gantt planning direction is already accepted in `.agent-bus/state/CURRENT.md`.
- This is documentation/product-spec work only. It must not copy BitrixReports2.0 code or create production UI/API/domain implementation.

## Scope

- Create `docs/product/CONTROL_SURFACE_INTERACTION_PATTERNS.md`.
- Create a decision record under `docs/decisions/`.
- Update product UX/design/journey/catalog docs and the P3-P12 UX screen matrix.
- Add future-scope exclusions for capabilities outside the current Release 2 planning surface.
- Optionally commit supplied atlas artifacts only if safe and policy-compatible.

## Out Of Scope

- Production React/API/domain code.
- New dependencies.
- Bitrix24 or tenant-specific domain coupling.
- E2E id renumbering without source-of-truth support.

## Acceptance Criteria

- [x] Clean-room pattern specification exists and uses KISS PM domain language.
- [x] Design system, product UX spec, interaction catalog, role journeys, matrix, backlog, and ADR are updated consistently.
- [x] `docs/status/p3-p12-ux-screen-matrix.json` remains valid JSON.
- [x] `git diff --check` passes.
- [x] Agent-bus guard passes before implementation and before handoff.
- [x] No production code, secrets, customer data, or BitrixReports2.0 source code is copied.

## Files Likely Affected

- `docs/product/CONTROL_SURFACE_INTERACTION_PATTERNS.md`
- `docs/product/DESIGN_SYSTEM.md`
- `docs/product/P3_P12_PRODUCT_UX_SPEC.md`
- `docs/product/SCREEN_INTERACTION_CATALOG.md`
- `docs/product/ROLE_BASED_JOURNEYS.md`
- `docs/product/artifacts/*`
- `docs/status/p3-p12-ux-screen-matrix.json`
- `docs/backlog/FUTURE_SCOPE.md`
- `docs/decisions/0003-br2-control-surface-pattern-transfer.md`
- `.agent-bus/state/CURRENT.md`
- `.agent-bus/handoff/*`

## Required Tests

- `git diff --check`
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/p3-p12-ux-screen-matrix.json','utf8')); console.log('screen matrix json ok')"`
- `npm run verify:matrix -- docs/status/p3-p12-ux-screen-matrix.json` if supported
- `node scripts/agent-bus-guard.mjs --task R2-DOC-002-br2-control-surface-pattern-transfer --once`

## Risks

- Accidentally making KISS PM sound like a reporting or Bitrix-specific product.
- Overstating implementation readiness in a docs-only task.
- Breaking JSON matrix shape.

## Handoff Notes

Use the final handoff note for verification evidence, skipped artifact rationale, and any stale E2E/doc mismatch found.

Completed 2026-05-17. Verification evidence:

- `git diff --check` exited 0.
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/p3-p12-ux-screen-matrix.json','utf8')); console.log('screen matrix json ok')"` exited 0 and printed `screen matrix json ok`.
- `npm run verify:matrix -- docs/status/p3-p12-ux-screen-matrix.json` exited 1 because `scripts/verify-requirements-matrix.mjs` supports phase requirements matrices and reported `unsupported matrix phase: undefined` and `matrix.rows must be a non-empty array`; this matrix shape is validated by JSON parse only in this task.
- `node scripts/agent-bus-guard.mjs --task R2-DOC-002-br2-control-surface-pattern-transfer --once` exited 0 after escalation because Node spawning `git status` fails with EPERM in the sandbox.
