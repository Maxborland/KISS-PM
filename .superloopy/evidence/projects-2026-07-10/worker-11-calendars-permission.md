# Worker 11: calendars permission leak

## Scope

- Surface: `apps/web/src/delivery/calendars/calendars-surface.tsx`
- Permission: `tenant.project_plan.manage`
- No role-name checks and no E2E changes.

## Regression proof

RED before the fix:

```text
src/delivery/calendars/calendars-permission-worker11.test.tsx
expected undefined to be true
```

The read-only render had no disabled `Рабочий день` control because the surface still exposed the active write affordance.

GREEN after the fix:

```text
Test Files  1 passed (1)
Tests       1 passed (1)
```

The focused happy-dom test covers both project and selected-resource views. Read-only plan access has no enabled working day, absence-create button, or exception-remove button. Manage access retains those controls. Existing resource constraints remain additive: weekends and project holidays are still non-editable in resource view.

## Verification

```text
apps/web local vitest: PASS
npm.cmd run typecheck (apps/web): PASS
next typegen: PASS
tsc -p tsconfig.json --pretty false: PASS
```
