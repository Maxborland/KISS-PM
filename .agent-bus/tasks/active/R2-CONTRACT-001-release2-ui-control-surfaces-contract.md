# Task: R2-CONTRACT-001-release2-ui-control-surfaces-contract - Release 2 UI control surface contract

Status: done
Priority: critical
Owner / claimed by: Codex

## Goal

Create a closed, implementation-ready, E2E-checkable Release 2 UI/product contract for control-surface hardening without starting production React/API/domain implementation.

## Context

- This task is stacked on the clean-room BR2 pattern-transfer branch because PR #1 is open and not merged.
- Release 2 uses `docs/product/CONTROL_SURFACE_INTERACTION_PATTERNS.md` and the BR2 clean-room decision record as product/design input.
- KISS PM must remain a control-loop SaaS, not a Bitrix-specific reporting app.

## Scope

- Create `docs/phases/RELEASE_2_UI_CONTROL_SURFACES.md`.
- Create `docs/status/release2-ui-requirements-matrix.json` with finite `R2-001..R2-012` rows.
- Add Release 2 scenarios to `docs/e2e/E2E_SCENARIOS.md`.
- Update Release 2 sales gate, screen catalog annotations, design-system component contracts, and future-scope exclusions.
- Update agent-bus handoff/state with verification evidence.

## Out Of Scope

- React component implementation.
- API route implementation.
- Domain package implementation.
- Renumbering existing phase E2E ids without source-of-truth support.
- Bitrix-specific fields, routes, labels, or report-domain assumptions.

## Acceptance Criteria

- [x] Release detail document exists and defines objective, scope, non-scope, affected screens, E2E, fixtures, exit gate, sequence, and PR slicing.
- [x] Release 2 requirements matrix is finite, valid JSON, and uses `R2-001..R2-012`.
- [x] E2E-R2 scenarios are documented without breaking existing phase E2E ids.
- [x] UI tasks are behavior/state/E2E tasks, not aesthetic wishes.
- [x] No production code changes are made.
- [x] Verification commands and final agent-bus guard are run and documented.

## Files Likely Affected

- `docs/phases/RELEASE_2_UI_CONTROL_SURFACES.md`
- `docs/status/release2-ui-requirements-matrix.json`
- `docs/e2e/E2E_SCENARIOS.md`
- `docs/product/UX_SALES_QUALITY_GATE.md`
- `docs/product/SCREEN_INTERACTION_CATALOG.md`
- `docs/product/DESIGN_SYSTEM.md`
- `docs/backlog/FUTURE_SCOPE.md`
- `.agent-bus/queue.json`
- `.agent-bus/state/CURRENT.md`
- `.agent-bus/handoff/R2-CONTRACT-001-release2-ui-control-surfaces-contract.md`

## Required Tests

- `git diff --check`
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"`
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/p3-p12-ux-screen-matrix.json','utf8')); console.log('p3-p12 ux matrix json ok')"`
- `npm run verify:matrix -- docs/status/release2-ui-requirements-matrix.json` if supported
- `node scripts/agent-bus-guard.mjs --task R2-CONTRACT-001-release2-ui-control-surfaces-contract --once`

## Risks

- Stacked PR dependency on unmerged BR2 pattern-transfer PR #1.
- Existing Release 2 docs may overlap with the requested contract; this task should consolidate without rewriting unrelated planning docs.
- Generic matrix verifier may not support the new Release 2 matrix shape.

## Completion Evidence

- `node scripts/agent-bus-guard.mjs --task R2-CONTRACT-001-release2-ui-control-surfaces-contract --once` passed before docs editing and before final handoff.
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-ui-requirements-matrix.json','utf8')); console.log('release2 matrix json ok')"` passed.
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/p3-p12-ux-screen-matrix.json','utf8')); console.log('p3-p12 ux matrix json ok')"` passed.
- `git diff --check` exited 0.
- `npm run verify:matrix -- docs/status/release2-ui-requirements-matrix.json` exited 1 because the generic requirements verifier expects phase matrices with verified/blocked rows and reported `unsupported matrix phase: undefined` plus planned-status errors. This is documented as `R2-012` follow-up/verifier support.
