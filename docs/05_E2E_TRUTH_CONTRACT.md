# 05 — KISS PM E2E Truth Contract

## 1. Purpose

KISS PM will become complex quickly. Unit tests and integration tests are necessary, but they cannot prove that the operational management loop works for real users. E2E tests are therefore the primary truth contour for user-facing product behavior.

This document defines how E2E must be used from the first implementation phase onward.

## 2. Core rule

A feature that changes user-facing behavior, business state, permissions, workflow, project planning, KPI, resource planning, CRM intake, control surfaces, or management actions is not complete until the relevant E2E scenario exists and passes.

For pure algorithms, unit tests are mandatory. For API boundaries, integration tests are mandatory. For management flows, E2E is mandatory.

## 3. What E2E must prove

E2E tests must prove complete user workflows, not only that pages render.

A good E2E scenario proves:

```txt
user intent
  -> visible UI state
  -> command/action
  -> backend state change
  -> visible result after reload/refetch
  -> permission/audit effect where relevant
```

A weak E2E scenario only proves:

```txt
page opened
button exists
text exists
```

Weak smoke checks are allowed only for skeleton/bootstrapping. Product features require behavioral E2E.

## 4. E2E scenario ledger

Maintain an E2E ledger:

```txt
docs/e2e/E2E_SCENARIOS.md
```

Each scenario must have:

- stable ID, for example `E2E-050`;
- name;
- phase;
- user role;
- tenant fixture;
- preconditions;
- steps;
- expected results;
- related domain modules;
- related PRD requirements;
- test file path;
- status: planned, implemented, passing, failing, quarantined, retired;
- reason if quarantined or retired.

Use the template:

```txt
docs/templates/E2E_SCENARIO_TEMPLATE.md
```

## 5. Test data rules

E2E must run against deterministic seeded data.

Default fixtures:

```txt
Seed Tenant A
  - admin user
  - project manager / project principal
  - resource manager
  - executor
  - read-only observer
  - CRM opportunity fixture
  - project fixture
  - tasks and assignments fixture
  - resource capacity fixture
  - KPI definitions fixture

Seed Tenant B
  - admin user
  - normal user
  - at least one private project and opportunity
```

The suite must prove tenant isolation by trying to access tenant B data from tenant A users.

E2E must not depend on live Bitrix24, live customer portals, production credentials, or real customer data. External systems must be mocked, stubbed, or represented by deterministic test adapters unless a specific live-adapter test is explicitly marked and isolated.

## 6. Required E2E categories

### 6.1 Smoke E2E

Used to prove that the system boots.

Examples:

- app shell opens;
- API health route responds;
- login/test auth works;
- seeded tenant loads.

### 6.2 Permission and tenant isolation E2E

Used to prove that access rules work in real flows.

Examples:

- read-only user cannot mutate project/task/KPI;
- tenant A cannot see tenant B project in control surfaces;
- hidden UI buttons are not the only protection; direct API attempt is blocked or fails through UI action path.

### 6.3 Cross-module workflow E2E

Used to prove that product modules connect.

Examples:

- CRM opportunity -> feasibility analysis -> project draft;
- project stage -> task -> My Tasks -> Kanban;
- Gantt task -> resource load -> overload;
- KPI signal -> corrective action -> audit trail;
- closed project -> retrospective trend -> template improvement action.

### 6.4 Control surface E2E

Used to prove that management instruments are not passive dashboards.

Examples:

- Portfolio Control opens project Gantt;
- Resource Load Control resolves overload;
- KPI Deviation Control creates corrective action;
- CRM Intake Control reserves capacity or creates project draft;
- Closed Portfolio Control creates a template-improvement action.

### 6.5 Configuration E2E

Used to prove SaaS no-code behavior.

Examples:

- admin renames stage label and runtime UI changes;
- admin adds custom field and sees it in project/control surface;
- admin edits KPI threshold and future evaluation changes;
- invalid configuration is rejected.

### 6.6 Regression E2E

Every serious workflow bug must add a regression test. If a bug crosses UI/API/domain boundaries, the regression must be E2E.

## 7. E2E implementation rules

- Prefer Playwright unless architecture docs select another runner.
- Use stable `data-testid` attributes for critical controls.
- Do not assert on fragile CSS selectors or incidental layout.
- Avoid sleeps and arbitrary timeouts; wait for deterministic UI or API state.
- Reset/seed data before scenario or use isolated test data IDs.
- Prefer scenario-specific fixtures over hidden global state.
- Verify persisted state after reload when the workflow changes data.
- Verify audit/event output when the workflow is a management action.
- Verify permission denial at the workflow level, not only with button visibility.
- Avoid testing too many unrelated things in one scenario.
- Keep full E2E meaningful but not bloated; use smoke, critical, and nightly groups if needed.

## 8. Required scripts

When the repository is initialized, create scripts equivalent to:

```bash
npm run test:e2e
npm run test:e2e:smoke
npm run test:e2e:critical
npm run test:e2e:permissions
npm run test:e2e:phase -- --phase=3
```

If exact script names differ, document them in README and in this file.

## 9. Phase gates and E2E

| Phase | Required E2E proof |
|---|---|
| 1 | boot, shell, seeded tenant, test auth |
| 2 | tenant isolation, access profiles, audit |
| 3 | CRM opportunity to project draft |
| 4 | project lifecycle, tasks, My Tasks/Kanban |
| 5 | Gantt and canonical task persistence |
| 6 | resource load, overload, dry-run, resolution |
| 7 | KPI definition, evaluation, deviation traceability |
| 8 | control surfaces executing governed actions |
| 9 | project closure, snapshots, retrospective action |
| 10 | tenant configuration changes runtime behavior |
| 11 | adapter import/idempotency/failure modes through mocked adapters |
| 12 | full happy path and production-like release smoke |

## 10. Flaky or failing E2E policy

A flaky E2E test is a product risk, not noise.

Do not skip, weaken, or delete E2E tests to pass a task. If a test is genuinely invalid because the product behavior changed, update the scenario ledger and explain the decision.

Quarantine is allowed only when:

- the scenario is documented as quarantined;
- the reason is recorded;
- the risk is recorded;
- a follow-up task exists;
- the phase gate does not depend on that scenario.

A phase-critical E2E scenario cannot be quarantined and still count as passed.

## 11. Minimum critical E2E journey for market release

By Phase 12, the product must have one full critical journey:

```txt
Admin configures tenant labels and KPI threshold
  -> user creates CRM opportunity
  -> system detects intake readiness/blockers
  -> user runs feasibility analysis
  -> user creates project draft
  -> user activates project from template
  -> user creates/edits Gantt tasks
  -> executor sees task in My Tasks/Kanban
  -> resource overload is detected
  -> authorized user resolves overload with dry-run preview
  -> KPI deviation is produced
  -> authorized user creates corrective action from control surface
  -> project is completed and closed
  -> closed snapshot appears in retrospective control surface
  -> user creates template-improvement action from retrospective signal
  -> audit trail proves the decisions
```

This journey is the final operational truth path. If it does not pass, the product is not release-ready.
