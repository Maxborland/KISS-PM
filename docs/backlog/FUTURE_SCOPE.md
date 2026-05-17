# KISS PM Future Scope

Record valuable ideas that are outside the active phase gate. Do not implement them inside the current phase unless a decision record explicitly changes scope.

## Release 2 Depth And Hardening

Release 2 planning is tracked in:

- `docs/product/RELEASE_2_UI_UX_SPEC.md`
- `docs/roadmap/RELEASE_2_FOUNDATION_CONTRACT.md`
- `docs/roadmap/RELEASE_2_DEPTH_HARDENING.md`
- `docs/roadmap/RELEASE_2_IMPLEMENTATION_DECOMPOSITION.md`
- `docs/roadmap/RELEASE_2_PLANNING_AUDIT.md`

Release 2 candidates are planned functionality, not deleted scope. They remain non-runnable until promoted through a finite Release 2 contract section, queue task, matrix/verifier policy, fixtures, E2E gates, and agent-bus guard.

Current foundation contract:

- `R2-FND-000-release2-foundation-contract`

Next recommended implementation-planning block:

- `R2-ACT-001-governed-command-audit-contract-hardening`

The selected first slice is foundation/security-first unless product leadership records stronger evidence for a different first slice. This keeps the rest of the roadmap as future planned functionality.

## Release 2 UI/UX Spec Pack Follow-Up

`docs/product/RELEASE_2_UI_UX_SPEC.md` defines the baseline direction: shadcn/ui + Radix primitives + custom KISS PM components, MS Project-like Project Gantt behavior, and decision-supporting operational UX.

Future planned docs before broad user-facing Release 2 implementation:

- `docs/product/RELEASE_2_SCREEN_SPECS.md`
- `docs/product/RELEASE_2_INTERACTION_FLOWS.md`
- `docs/product/RELEASE_2_MODAL_DRAWER_PANEL_SPECS.md`
- `docs/product/RELEASE_2_CONTROL_SURFACE_ACTION_SPECS.md`
- `docs/status/release2-ui-ux-screen-matrix.json`
- verifier support for the UI/UX matrix

This is planned scope, not deleted functionality.

## Frontend Server-State Migration Follow-Up

Migrate any remaining legacy server-state surfaces to TanStack Query after the current phase gate is stable.

Acceptance:

- P3/P4/P5 server-state surfaces use query/mutation hooks instead of ad hoc `useEffect` API loading.
- P6 Resource Load Control is migrated in a dedicated follow-up if it was implemented before the shared query foundation.
- Existing phase E2E gates continue to pass after each migrated surface.
- No forbidden TanStack Router/Start/unscoped packages are introduced.
