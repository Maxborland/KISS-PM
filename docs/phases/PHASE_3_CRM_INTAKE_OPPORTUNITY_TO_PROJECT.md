# Phase 3 — CRM Intake and Opportunity-to-Project

## 1. Phase objective

Make CRM intake the starting point of the KISS PM project-control lifecycle. A user must be able to register an opportunity, see whether it is ready for delivery analysis, run deterministic demand/capacity feasibility checks, and create an audited project draft from a qualified opportunity without depending on Bitrix24, AmoCRM, or any external CRM adapter.

## 2. Source documents

- `AGENTS.md`
- `docs/00_PROJECT_GLOBAL_GOAL.md`
- `docs/01_PRD.md`
- `docs/02_UNIVERSAL_PROJECT_BP.md`
- `docs/04_MASTER_PHASE_PLAN.md`
- `docs/05_E2E_TRUTH_CONTRACT.md`
- `docs/06_PRODUCT_IDENTITY.md`
- `docs/e2e/E2E_SCENARIOS.md`
- `docs/phases/PHASE_2_SAAS_TENANT_CORE_ACCESS_CONTROL.md`

## 2.1 Scope lock

Scope status: `frozen`.

Implementation may start after this document, `docs/status/phase3-contract-matrix.json`, and `docs/status/phase3-requirements-matrix.json` are committed. Any scope expansion must reference a decision record and update this document before code changes.

## 2.2 KISS PM simplicity target

The intake user should see one guided path: capture the opportunity, resolve readiness blockers, run feasibility, and create the project draft when allowed. Internal logic may evaluate templates, dates, role demand, capacity, permissions, and audit, but the UI must expose explainable blockers and one clear next action instead of a raw CRM builder or passive dashboard.

## 3. Functional scope

| ID | Owner / module | Feature / task | Expected behavior | Acceptance criteria | E2E ID | Verification | Task non-scope | Done evidence |
|---|---|---|---|---|---|---|---|---|
| P3-001 | `packages/crm-core`, `packages/domain-core` | CRM intake domain primitives | Add tenant-owned `Account`, `Contact`, `Opportunity`, `OpportunityStage`, and intake value objects with stable IDs and tenant ownership | Opportunities can reference account/contact data, planned dates, expected value, probability, category, typology, scope hints, and custom-field metadata without external CRM fields leaking into the domain core | E2E-020 | unit tests, typecheck | No full CRM replacement, marketing automation, telephony, email campaigns, or live adapter sync | Unit test names, changed files, and passing command output recorded in `docs/status/phase3-requirements-matrix.json` |
| P3-002 | `packages/crm-core` | Opportunity readiness checks | Evaluate whether an opportunity is ready for analysis and return explainable blockers plus allowed next action | Missing account/contact intent, dates, category/typology, scope hints, template match, or confidence produces deterministic blocker codes and Russian UI-safe messages | E2E-021 | unit tests plus API/UI smoke where applicable | No opaque scoring model, tenant-specific stage names in code, or generic no-code validation builder | Unit/API/E2E evidence recorded in matrix |
| P3-003 | `packages/crm-core`, `packages/tenant-config` | Typology, category, custom-field intake metadata | Represent Phase 3 configurable intake labels/templates as tenant configuration and stable system keys | Opportunity type/category labels and required intake fields come from tenant config/templates, not hardcoded company-specific terms | E2E-020, E2E-021 | unit tests | No runtime custom-field value engine beyond fields required for Phase 3 intake fixtures | Unit evidence and config fixture evidence recorded in matrix |
| P3-004 | `packages/crm-core`, `packages/project-core` | Process-template matching draft | Match a qualified opportunity to a deterministic project/process template draft with traceable confidence and assumptions | Matching result identifies the template, missing-match blocker when absent, and trace details safe for UI/API output | E2E-021, E2E-022 | unit tests | No full template marketplace, historical template learning, or Phase 4 lifecycle engine | Unit evidence recorded in matrix |
| P3-005 | `packages/crm-core`, `packages/resource-planning` | Demand-estimation draft | Produce deterministic stage/role demand assumptions from the matched template and opportunity scope hints | Demand result includes stage, role, planned work, confidence/scenario labels, source assumptions, and formula/version metadata | E2E-022 | unit tests | No advanced scheduling engine, Monte Carlo simulation, or historical estimation model | Unit evidence recorded in matrix |
| P3-006 | `packages/resource-planning`, `packages/crm-core` | Capacity-feasibility draft | Compare opportunity demand against seeded role/resource capacity for the expected date window | Feasibility result shows fit/overload, blocker severity, role capacity gaps, conflicting reservations where seeded, and traceable assumptions | E2E-022 | unit tests plus integration tests | No real resource reservation command unless required for project draft flow; no calendar UI | Unit/integration/E2E evidence recorded in matrix |
| P3-007 | `apps/api`, `packages/crm-core` | CRM intake API endpoints | Add API routes for account/contact/opportunity create/read, readiness, template match, feasibility, and project-draft command entry | Routes validate input with Zod, enforce tenant and permission checks server-side, return stable DTOs, and deny out-of-tenant reads/writes | E2E-020..024 | integration tests plus E2E | No production auth provider, unrestricted diagnostics, or external CRM payload import | Integration/E2E evidence recorded in matrix |
| P3-008 | `packages/project-core`, `packages/action-engine` | Project draft creation from qualified opportunity | Execute a governed command that creates a tenant-owned project draft linked to the opportunity and records audit/action evidence | Qualified opportunity creates a project draft with source opportunity reference, template assumptions, before/after action log, actor, permission, and correlation ID | E2E-023, E2E-024 | unit/integration tests plus E2E | No active-project conversion, full stage-gate workflow, or Gantt baseline creation | Unit/integration/E2E evidence recorded in matrix |
| P3-009 | `apps/web`, `e2e/` | CRM Intake Control web surface and E2E suite | Add Russian guided intake UI for opportunity list/card, readiness blockers, feasibility result, and project-draft action | UI drives real API state changes; reload preserves state; unauthorized/out-of-scope users cannot run protected actions; E2E-020..024 pass | E2E-020..024 | component smoke plus E2E | No decorative dashboard, full CRM pipeline builder, or hidden-button-only permission proof | Component/E2E evidence recorded in matrix |
| P3-010 | `docs/status`, `scripts` | Phase 3 verification matrix | Track P3-001..P3-010 and require structured E2E evidence for Phase 3 exit | Matrix rows exist before implementation; final phase exit requires every row `verified`; mandatory E2E rows include structured `e2e_evidence` entries with ID, phase command, test path, exit code 0, and timestamp | All Phase 3 | `npm run verify:matrix -- docs/status/phase3-requirements-matrix.json` | No prose-only completion, stale command evidence, skipped E2E, or unchecked cleanup | Passing matrix verifier output and final command log recorded in matrix |

## 4. Non-scope

- Full CRM replacement comparable to Salesforce, Bitrix24, or AmoCRM.
- Billing, marketing automation, telephony, email campaigns, and commercial proposal automation.
- Live Bitrix24, AmoCRM, Jira, Slack, email, or MS Project adapters.
- Active project conversion beyond creating a project draft.
- Full project lifecycle, stage gates, Gantt baseline, Kanban, KPI control, retrospective learning, or control-surface builder.
- Historical template learning or machine-generated demand forecasts.
- Tenant-specific company branches, hardcoded Russian process abbreviations in domain logic, or adapter-specific fields in core entities.

## 5. Domain model changes

Entities and value objects:

- `Account`
- `Contact`
- `Opportunity`
- `OpportunityStage`
- `OpportunityReadinessCheck`
- `OpportunityReadinessBlocker`
- `OpportunityCategory`
- `OpportunityTypology`
- `OpportunityScopeHint`
- `ProcessTemplateMatch`
- `DemandEstimate`
- `DemandScenario`
- `CapacityFeasibilityResult`
- `CapacityFeasibilityBlocker`
- `ProjectDraft`
- `OpportunityProjectLink`
- `OpportunityToProjectCommand`

Invariants:

- Every CRM intake entity belongs to exactly one tenant.
- An opportunity may be created manually and must not require an external CRM mapping.
- Account/contact may be marked intentionally unknown only through explicit intake metadata and must produce an explainable readiness state.
- Opportunity stage logic must use stable system keys and tenant labels, not tenant-specific branches.
- Demand and feasibility calculations must be deterministic and testable without UI or network dependencies.
- A project draft created from an opportunity must remain valid if any external CRM adapter is disconnected.
- Project draft creation must be permission-checked and auditable with actor, source opportunity, command type, before/after state, result, and correlation ID.

## 6. API contracts

Minimum Phase 3 routes:

- `GET /api/crm/opportunities`
- `POST /api/crm/opportunities`
- `GET /api/crm/opportunities/:id`
- `POST /api/crm/opportunities/:id/readiness`
- `POST /api/crm/opportunities/:id/template-match`
- `POST /api/crm/opportunities/:id/feasibility`
- `POST /api/crm/opportunities/:id/project-draft`
- `GET /api/projects/:id`
- `GET /api/audit?targetType=opportunity&targetId=:id`

Contracts:

- Requests validate tenant context, actor, permission, and Zod DTOs at the API boundary.
- Responses use stable DTOs with Russian-display labels supplied from tenant configuration where user-facing.
- Readiness, template match, demand, feasibility, and project-draft command responses include trace/correlation identifiers.
- Protected operations deny read-only and out-of-tenant actors at the backend/application layer.
- Error DTOs include stable `code`, safe `message`, and optional `details` without leaking other-tenant data.

## 7. UI surfaces

- CRM Intake Control page: opportunity list, stage/readiness status, blocker summary, and next action.
- Opportunity create/edit panel: required fields, account/contact intent, category/typology, dates, scope hints, and custom-field metadata supported by Phase 3.
- Readiness panel: blocker list, severity, and allowed next action.
- Feasibility panel: demand by stage/role, capacity fit, role gaps, assumptions, and trace ID.
- Project draft action panel: dry-run/confirmation state, permission denial state, success state, and link to created project draft.
- Audit evidence view for opportunity-to-project command.

UI copy must be Russian by default, but identifiers, routes, DTO fields, and tests stay English.

## 8. E2E scenarios

| E2E ID | Scenario | User role | Fixture | Test path | Status |
|---|---|---|---|---|---|
| E2E-020 | User creates an opportunity with required fields | CRM user | Seed Tenant A | `e2e/tests/phase3/opportunity-create.spec.ts` | planned |
| E2E-021 | Opportunity with missing fields shows readiness blockers | CRM user | Seed Tenant A | `e2e/tests/phase3/intake-readiness.spec.ts` | planned |
| E2E-022 | User runs demand/capacity feasibility analysis | Resource manager | Seed Tenant A | `e2e/tests/phase3/feasibility-analysis.spec.ts` | planned |
| E2E-023 | User creates a project draft from a qualified opportunity | Project manager | Seed Tenant A | `e2e/tests/phase3/project-draft-from-opportunity.spec.ts` | planned |
| E2E-024 | Created project draft remains valid without an external CRM adapter | Project manager | Seed Tenant A | `e2e/tests/phase3/project-draft-canonical.spec.ts` | planned |

Required assertion pattern:

- User sees the starting opportunity/intake state.
- Authorized user executes the action.
- Unauthorized or out-of-scope user cannot execute protected actions.
- UI shows the resulting state and relevant blocker/feasibility/action evidence.
- API/domain state changed correctly where the scenario is state-changing.
- Audit/action log exists for project draft creation.
- Reload keeps the state.
- Tenant B private opportunity/project data is not visible to Tenant A actors.

## 9. Unit and integration tests

- CRM entity/value-object validation and tenant ownership tests.
- Opportunity readiness tests for each blocker code and successful readiness.
- Tenant-config tests for category/typology labels and custom-field metadata.
- Template-match tests for matched and missing-template cases.
- Demand-estimation tests for deterministic stage/role output.
- Capacity-feasibility tests for fit, overload, and seeded conflict cases.
- API integration tests for validation, permissions, tenant isolation, readiness, feasibility, project draft creation, and audit readback.
- Web component smoke tests for Russian intake states where practical.
- Matrix verifier regression tests for Phase 3 required rows and mandatory E2E evidence.

## 10. Test data and fixtures

- Seed Tenant A:
  - CRM user, project manager, resource manager, read-only observer.
  - One existing account/contact pair.
  - One complete opportunity ready for feasibility.
  - One incomplete opportunity with deterministic readiness blockers.
  - One process template draft with stage/role demand assumptions.
  - Seeded resources/capacity buckets sufficient for one fit case and one overload/conflict case.
- Seed Tenant B:
  - Private account/contact/opportunity/project draft data for tenant-isolation checks.
- Reset rules:
  - E2E fixture reset must be deterministic and isolated by test profile.
  - No live external services, production data, random IDs, or order-dependent fixtures.

## 11. Phase exit gate

The phase is complete only when all criteria below pass.

- [ ] Functional scope P3-001..P3-010 implemented.
- [ ] Mandatory E2E scenarios E2E-020..024 implemented and passing through `npm run test:e2e:phase -- --phase=3`.
- [ ] Earlier critical E2E scenarios still passing.
- [ ] Unit/integration tests passing for changed modules.
- [ ] Typecheck/lint pass where relevant.
- [ ] Permissions enforced at backend/application layer.
- [ ] Project draft creation and meaningful intake decisions are audited.
- [ ] `docs/status/phase3-requirements-matrix.json` passes without `--allow-blocked`.
- [ ] Docs updated.
- [ ] Risks and follow-ups recorded.

## 12. Risks and decisions

- Phase 3 uses a deterministic feasibility draft, not a full resource-planning engine. The removal condition is Phase 6 resource-planning and conflict-resolution implementation.
- External CRM adapters are intentionally excluded. Manual/API-created opportunities prove the canonical CRM core first.
- Project draft creation is included, but active-project conversion remains later scope.
- If implementation reveals an irreversible domain ambiguity, record it in `docs/decisions/` before expanding scope.
