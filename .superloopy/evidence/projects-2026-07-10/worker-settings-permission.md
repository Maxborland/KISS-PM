# Settings permission hardening

Date: 2026-07-10

## Scope

- `apps/web/src/delivery/settings/settings-surface.tsx`
- `apps/web/src/delivery/settings/settings-permission-worker13.test.tsx`
- `e2e/full-eval/projects-settings-write.spec.ts`

## Permission contract

The Settings surface writes only `project.deadline.move`. The API policy routes
that command through `canManageProjectPlan`, so the UI capability is
`tenant.project_plan.manage` without role-name checks.

## RED -> GREEN

- RED: focused test failed because a user with only
  `tenant.project_plan.read` still received the `Изменить` deadline control.
- GREEN: the same test passes after adding the capability gate and handler
  guards; read-only data remains visible and a manager still receives the
  write control.

## Fresh evidence

- Focused Vitest: `1 passed`.
- Next type generation: passed.
- Web TypeScript check: passed.
- Playwright on `http://127.0.0.1:3180`, API `4191`: `2 passed`.
- ADMIN: preview `200`, apply `200`, API readback and reload verified for the
  moved deadline, then preview/apply restore `200/200` returned the deadline to
  `2026-07-08`.
- PLAN reader: deadline write-control count `0`, direct preview `403`, apply
  request count `0`, deadline and plan version unchanged before/after/reload.

Structured run evidence:
`.superloopy/evidence/projects-2026-07-10/projects-settings-write.json`.

## Remaining scope

No Settings write flow remains unverified in this worker-owned surface. The
disabled integration roadmap controls are not planning writes and were not
treated as implemented functionality.
