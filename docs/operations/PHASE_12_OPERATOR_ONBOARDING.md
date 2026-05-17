# Phase 12 Operator Onboarding

This guide is for the deterministic release operator path. It helps a tenant admin understand the first run without relying on live services, production credentials, or prose-only status.

## First run

1. Open KISS PM as `tenant-admin-a`.
2. Confirm the operator navigation item opens the operator readiness surface.
3. Run release readiness and review the blocked checks.
4. Run permission smoke, tenant isolation smoke, and recovery smoke.
5. Confirm every command has API readback and ops audit evidence.
6. Reload the page and confirm the latest run remains visible.
7. Use `/test-fixtures/reset` during automated test cleanup to restore deterministic in-memory state.

## E2E-110 path

`E2E-110` is the full critical journey over the P12 release demo tenant:

```txt
tenant configuration
  -> CRM opportunity
  -> project draft
  -> active project
  -> Gantt/tasks/resources
  -> KPI/control signal
  -> governed action
  -> audit
  -> closure
  -> retrospective template improvement
```

The operator should treat this as a release gate, not a tutorial shortcut. A green page without API/domain readback, audit evidence, reload persistence, and cleanup readback is not accepted.

## Mocked external services

P12 onboarding uses mocked external services only. The expected release-mode statement is `mocked external services`, backed by `KISS_PM_EXTERNAL_SERVICES_MODE=mocked`.

Keep this deterministic release path on mock adapters and empty credential placeholders. External systems remain adapters and are verified through the Phase 11 mock adapter plus P12 no-external-dependency checks.

## Operator checklist

- Readiness state is visible and explains blockers.
- Permission smoke denies read-only or out-of-scope mutation through backend API, not only hidden buttons.
- Tenant isolation smoke proves Tenant B data is denied or absent from Tenant A views.
- Recovery smoke proves usable state after simulated failure.
- Audit evidence names the command, actor, target, result, timestamp, and correlation id.
- Matrix status remains blocked until E2E-110..115 and strict P12 verification pass.
