# KISS PM Future Scope

Record valuable ideas that are outside the active phase gate. Do not implement them inside the current phase unless a decision record explicitly changes scope.

## Frontend Server-State Migration Follow-Up

Migrate any remaining legacy server-state surfaces to TanStack Query after the current phase gate is stable.

Acceptance:

- P3/P4/P5 server-state surfaces use query/mutation hooks instead of ad hoc `useEffect` API loading.
- P6 Resource Load Control is migrated in a dedicated follow-up if it was implemented before the shared query foundation.
- Existing phase E2E gates continue to pass after each migrated surface.
- No forbidden TanStack Router/Start/unscoped packages are introduced.
