# P3-P12 Post-Run Verification Gate

## Purpose

This gate is executed after the worker finishes P3-P12 implementation. It verifies that the release is not only technically green, but aligned with the product UX contract, tenant customization model, management-control loop, permissions, audit, persistence, and E2E truth contract.

## Required Inputs

- `docs/product/P3_P12_PRODUCT_UX_SPEC.md`
- `docs/product/USER_STORIES_P3_P12.md`
- `docs/product/ROLE_BASED_JOURNEYS.md`
- `docs/product/SCREEN_INTERACTION_CATALOG.md`
- `docs/product/DESIGN_SYSTEM.md`
- `docs/product/UX_SALES_QUALITY_GATE.md`
- `docs/status/p3-p12-ux-screen-matrix.json`
- Phase requirement matrices for P3-P12 when present.
- E2E run metadata for the implemented phases.

## Gate Steps

1. Run agent-bus guard for the active gate task.
2. Parse all JSON matrices.
3. Run `node scripts/verify-ux-screen-matrix.mjs docs/status/p3-p12-ux-screen-matrix.json`.
4. Run typecheck, lint, unit, integration, and phase E2E commands relevant to changed phases.
5. Check every implemented screen against its screen catalog card.
6. Check every state-changing flow for permission, backend guard, audit/result feedback, API readback, and reload persistence.
7. Check tenant customization for runtime effect, not label-only behavior.
8. Check Project Gantt as a custom KISS PM planning surface using canonical tasks, not as a substituted widget.
9. Run Bug Hunt, Requesting Code Review, and Receiving Code Review loops for important findings.
10. Produce accepted, rejected, or blocked verdict with command evidence.

## Acceptance

- Every critical screen has primary role, goal, primary next action, states, permissions, audit/result feedback, reload behavior, and E2E links.
- Control surfaces expose signal, decision point, governed action, command result, audit, and refreshed projection.
- Gantt proves WBS/grid, timeline, dependencies, baseline, canonical task persistence, permissions, audit, and reload.
- Tenant Admin proves safe configuration preview, permission guard, audit, and runtime effect.
- No important bug, failing test, weak evidence, or matrix mismatch remains open.

## Verdict Values

- `accepted: UX spec and implementation evidence are ready for release planning`
- `rejected: implementation or spec evidence is incomplete`
- `blocked: specific missing source, command failure, or unresolved decision prevents acceptance`
