# Task: R2-RESET-001-product-app-reality-audit-and-foundation-contract - Release 2 product-app reality audit and foundation reset contract

Status: done
Priority: critical
Owner / claimed by: codex-release2-app-reset

## Goal

Stop further Release 2 implementation until the merged UI stack is honestly reclassified and a product-app foundation reset contract exists with verifiable matrix, verifier/tests, live evidence, and updated docs/status gates.

## Context

- Release 2 control-surface components were merged and previously marked green through component/control-surface evidence.
- Product-app readiness is not accepted because the local app behaves like demo/control-surface harness instead of a normal SaaS application.
- Required verdict: Release 2 control-surface components are merged, but app-level SaaS readiness is not accepted. Before further Release 2 implementation, KISS PM must complete `RELEASE_2_APP_FOUNDATION_RESET`.

## Scope

- Create `docs/audits/RELEASE_2_PRODUCT_APP_REALITY_AUDIT.md`.
- Create `docs/phases/RELEASE_2_APP_FOUNDATION_RESET.md`.
- Create `docs/status/release2-app-foundation-reset-matrix.json` with exactly `R2R-001..R2R-015`.
- Create verifier and tests for the reset matrix.
- Update Release 2 docs/status and agent-bus state to block continuation until reset implementation and product-owner smoke E2E pass.
- Capture live browser evidence for the current local app.

## Out Of Scope

- No production UI/API/domain implementation beyond verifier tooling.
- No acceptance claim that Release 2 is product-owner ready.
- No weakening or deleting existing Release 2 evidence; reclassify it honestly.

## Acceptance Criteria

- [ ] Reality audit exists and documents current app-readiness blockers.
- [ ] Reset contract exists and contains `R2R-001..R2R-015`.
- [ ] Reset matrix is valid JSON and verifier-valid.
- [ ] Verifier tests prove failure and pass cases.
- [ ] Existing Release 2 docs no longer imply app-level SaaS readiness.
- [ ] shadcn/Radix default primitive rule is documented.
- [ ] Product-owner smoke E2E is specified.
- [ ] Live evidence, console errors, and 404s are documented.
- [ ] Required verification commands and agent-bus guard pass or failures are documented honestly.

## Files Likely Affected

- `docs/audits/RELEASE_2_PRODUCT_APP_REALITY_AUDIT.md`
- `docs/phases/RELEASE_2_APP_FOUNDATION_RESET.md`
- `docs/status/release2-app-foundation-reset-matrix.json`
- `docs/status/release2-ui-requirements-matrix.json`
- `docs/phases/RELEASE_2_UI_CONTROL_SURFACES.md`
- `docs/product/RELEASE_2_UI_UX_SPEC.md`
- `docs/product/DESIGN_SYSTEM.md`
- `docs/product/RELEASE_2_SCREEN_SPECS.md`
- `docs/product/SCREEN_INTERACTION_CATALOG.md`
- `docs/backlog/FUTURE_SCOPE.md`
- `docs/e2e/E2E_SCENARIOS.md`
- `scripts/verify-release2-app-foundation-reset.mjs`
- `scripts/verify-release2-app-foundation-reset.test.ts`
- `.agent-bus/state/CURRENT.md`

## Required Tests

- `git diff --check`
- `node -e "JSON.parse(require('fs').readFileSync('docs/status/release2-app-foundation-reset-matrix.json','utf8')); console.log('reset matrix json ok')"`
- `node scripts/verify-release2-app-foundation-reset.mjs docs/status/release2-app-foundation-reset-matrix.json`
- `npm test -- scripts/verify-release2-app-foundation-reset.test.ts`
- `npm run typecheck`
- `node scripts/agent-bus-guard.mjs --task R2-RESET-001-product-app-reality-audit-and-foundation-contract --once`

## Risks

- Current local app may fail to start or show console/404 blockers; these must be documented, not hidden.
- Existing Release 2 evidence may remain technically green but insufficient for product-app acceptance.

## Handoff Notes

Completed 2026-05-17T22:02:00+07:00. Release 2 control-surface work is reclassified as reusable foundation, not app-level SaaS readiness. Further Release 2 implementation is blocked until `RELEASE_2_APP_FOUNDATION_RESET` is implemented and `E2E-R2R-001` passes.
