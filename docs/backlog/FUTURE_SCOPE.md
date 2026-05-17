# KISS PM Future Scope

Record valuable ideas that are outside the active phase gate. Do not implement them inside the current phase unless a decision record explicitly changes scope.

## Release 2 Depth And Hardening

Release 2 planning is tracked in:

- `docs/roadmap/RELEASE_2_DEPTH_HARDENING.md`
- `docs/roadmap/RELEASE_2_IMPLEMENTATION_DECOMPOSITION.md`
- `docs/roadmap/RELEASE_2_PLANNING_AUDIT.md`

Release 2 candidates are planned functionality, not deleted scope. They remain non-runnable until promoted through a finite Release 2 detail document, queue task, matrix/verifier policy, fixtures, E2E gates, and agent-bus guard.

Recommended first planning block:

- `R2-FND-000-release2-foundation-contract`

This block should choose the first finite Release 2 slice and keep the rest of the roadmap as future planned functionality.

## Frontend Server-State Migration Follow-Up

Migrate any remaining legacy server-state surfaces to TanStack Query after the current phase gate is stable.

Acceptance:

- P3/P4/P5 server-state surfaces use query/mutation hooks instead of ad hoc `useEffect` API loading.
- P6 Resource Load Control is migrated in a dedicated follow-up if it was implemented before the shared query foundation.
- Existing phase E2E gates continue to pass after each migrated surface.
- No forbidden TanStack Router/Start/unscoped packages are introduced.
