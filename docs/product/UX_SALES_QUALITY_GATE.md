# UX Sales Quality Gate

This gate answers: will the UX sell KISS PM as a mature operational project-control product?

## Gate Criteria

- First 5 minutes clarity: user understands workspace, object, risk, and next action.
- Role-specific next action is visible.
- Control surfaces feel actionable, not report-like.
- No dead-end screens.
- Risky actions have preview or confirmation.
- Permissions are understandable.
- Audit/result feedback is visible.
- Empty states guide setup or action.
- Errors explain recovery.
- Gantt feels like a serious planning instrument.
- Tenant admin feels powerful but safe.
- Product does not look like a plain CRUD/admin template.
- Russian copy is professional.
- UI remains dense but readable.

## Sales Demo Readiness

A screen passes demo-readiness only if a viewer can identify the working place in 5 seconds, see management value beyond raw data, identify the primary next action, see highlighted risk/deviation when present, read professional Russian copy, understand empty/error/permission states, and see after-action feedback proving a real result.

Gantt passes demo-readiness only if WBS/grid, timeline, dependencies, baseline, permissions, persistence, and audit operate as one planning instrument.

Tenant Admin passes demo-readiness only if configuration change is previewed, permission-checked, audited, and reflected in runtime screens after reload.

## Release 2 Gate

Release 2 screens must pass these additional product gates before the release exit evidence can be accepted:

- The screen identifies the object, risk or decision point, and primary next action within 5 seconds.
- No key screen is a passive dashboard; read-only surfaces must state that they are intentionally read-only.
- Permission state is visible before the user attempts a mutation.
- Risky actions show preview before apply, including warnings and blockers.
- Mutation result is not toast-only; a durable result panel or inline readback must remain visible.
- `ActionExecution` / `AuditEvent` feedback is visible for meaningful management actions.
- Reload/readback proof is required for state-changing flows.
- Project Gantt feels like a serious planning instrument with synchronized WBS/grid, timeline, validation, persistence, baseline/tracking, and disabled reasons.
- Resource conflict flow shows before/after capacity and schedule impact before confirmation.
- Tenant Admin configuration shows preview and runtime effect after reload.

Release 2 exit evidence is `node scripts/run-e2e.mjs release2`, which runs `E2E-R2-001..010` including the first-five-minutes sales-demo clarity path.

## Reject Conditions

- Screen renders but no primary action.
- Toast only, no persisted or reload evidence.
- Hidden button but backend allows action.
- Table dump without management action.
- Gantt visual mock without canonical task persistence.
- Tenant customization is labels only and not operational model configuration.
- shadcn default look is used without KISS PM product adaptation.
- Control surface is a passive report.
- Permission failure looks like broken UI.
