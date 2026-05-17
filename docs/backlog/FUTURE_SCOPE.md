# KISS PM Future Scope

Record valuable ideas that are outside the active phase gate. Do not implement them inside the current phase unless a decision record explicitly changes scope.

## Release 2 Depth And Hardening

Product-app reset blocker: Release 2 control-surface components are merged, but app-level SaaS readiness is not accepted. Further Release 2 implementation is blocked until `docs/phases/RELEASE_2_APP_FOUNDATION_RESET.md`, `docs/status/release2-app-foundation-reset-matrix.json`, and product-owner smoke E2E are implemented.

The reset backlog is not future polish; it is the next required implementation gate for real SaaS app foundation: login/dev-auth, real routes/pages/deep links, app shell, profile/account, tenant admin settings, KPI setup page, seeded Gantt, demo seed/readback, and product-owner smoke.

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

## Release 2 UI/UX Spec Pack

`docs/product/RELEASE_2_UI_UX_SPEC.md` defines the baseline direction: shadcn/ui + Radix primitives + custom KISS PM components, MS Project-like Project Gantt behavior, and decision-supporting operational UX.

The first screen-by-screen planning pack now exists:

- `docs/product/RELEASE_2_SCREEN_SPECS.md`
- `docs/product/RELEASE_2_INTERACTION_FLOWS.md`
- `docs/product/RELEASE_2_MODAL_DRAWER_PANEL_SPECS.md`
- `docs/product/RELEASE_2_CONTROL_SURFACE_ACTION_SPECS.md`
- `docs/status/release2-ui-ux-screen-matrix.json`
- `scripts/verify-release2-ui-ux-matrix.mjs`

Future implementation tasks must reference exact screen ids and action/modal specs from this pack. This does not delete any planned Release 2 functionality; it turns the universal BP into a safer implementation planning surface.

## Frontend Server-State Migration Follow-Up

Migrate any remaining legacy server-state surfaces to TanStack Query after the current phase gate is stable.

Acceptance:

- P3/P4/P5 server-state surfaces use query/mutation hooks instead of ad hoc `useEffect` API loading.
- P6 Resource Load Control is migrated in a dedicated follow-up if it was implemented before the shared query foundation.
- Existing phase E2E gates continue to pass after each migrated surface.
- No forbidden TanStack Router/Start/unscoped packages are introduced.

## Release 2 Control Surface Future Scope

The clean-room control-surface pattern transfer in `docs/product/CONTROL_SURFACE_INTERACTION_PATTERNS.md` defines reusable interaction contracts, not permission to implement every advanced capability immediately.

Keep these outside the current Release 2 docs/planning task until promoted by a finite implementation contract:

- Full drag-and-drop control-surface builder beyond safe saved-view/layout configuration.
- Advanced per-user free-capacity commitment engine with hard production promises.
- Real-time multi-user Project Gantt collaboration.
- Arbitrary user-defined formulas or arbitrary user-defined actions.
- Full marketplace for surface/action templates.
- Packaged/vendor Gantt widget replacement of the custom KISS PM planning workspace.
- Automated resource leveling that applies changes without preview, permission, and audit.
- Full MS Project clone or proprietary UI copy.
- External production integrations as part of Release 2 UI hardening.
- AI autonomous management actions without explicit human preview and confirmation.
- Arbitrary SQL or JavaScript execution in tenant formulas, layout rules, or action definitions.
- Replacing the Release 2 E2E exit gate with screenshots or visual acceptance only.
