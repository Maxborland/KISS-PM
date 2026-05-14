# Phase 0 — Product and Architecture Contract

## 1. Phase objective

Create the non-negotiable product, domain, architecture, and verification contract before implementation begins. Phase 0 answers what KISS PM is building toward and prevents the repository from starting as a static reporting app or disconnected prototype.

## 2. Source documents

- `AGENTS.md`
- `docs/00_PROJECT_GLOBAL_GOAL.md`
- `docs/06_PRODUCT_IDENTITY.md`
- `docs/01_PRD.md`
- `docs/02_UNIVERSAL_PROJECT_BP.md`
- `docs/04_MASTER_PHASE_PLAN.md`
- `docs/05_E2E_TRUTH_CONTRACT.md`
- `docs/03_START_PROMPT_FOR_CODEX.md`

## 2.1 Scope lock

Scope status: `frozen`.

Phase 0 is documentation and planning only. No production application code, UI, API, database schema, or external integration implementation is in scope.

## 2.2 KISS PM simplicity target

The phase keeps the product simple by defining a clear management loop, stable domain vocabulary, and finite phase plan. Simplicity is expressed as guided future workflows, not shallow internals.

## 3. Functional scope

| ID | Feature / task | Expected behavior | Acceptance criteria | E2E ID | Verification |
|---|---|---|---|---|---|
| P0-001 | Architecture contract | Define apps, packages, dependency direction, and runtime boundaries | `docs/architecture/ARCHITECTURE.md` exists and forbids UI/domain/integration boundary violations | N/A | Markdown review |
| P0-002 | Canonical domain model | Define entities and invariants for tenant, CRM, projects, tasks, scheduling, resources, KPI, control surfaces, actions, retrospectives | `docs/domain/DOMAIN_MODEL.md` exists and states one canonical task model | N/A | Markdown review |
| P0-003 | Control surface spec | Define control surface definitions, view types, action exposure, and audit behavior | Spec states control surfaces do not mutate state directly | N/A | Markdown review |
| P0-004 | Action engine spec | Define action definitions, execution, dry-run, permissions, and audit | Spec defines permission/precondition/dry-run/audit flow | N/A | Markdown review |
| P0-005 | KPI engine spec | Define KPI formulas, thresholds, evaluations, versions, and control signals | Spec forbids arbitrary executable formulas and requires traceability | N/A | Markdown review |
| P0-006 | CRM intake spec | Define opportunity intake, readiness, demand, capacity, and project draft flow | Spec treats CRM as lifecycle entry and external adapters as non-core | N/A | Markdown review |
| P0-007 | Tenant customization spec | Define configurable templates, labels, custom fields, validation, and versioning | Spec forbids tenant-specific code branches | N/A | Markdown review |
| P0-008 | Resource planning spec | Define capacity, reservations, assignments, load buckets, overloads, and previews | Spec requires deterministic load and audited resolutions | N/A | Markdown review |
| P0-009 | Scheduling spec | Define MVP and future scheduling scope | Spec separates MVP Gantt from future MS Project parity | N/A | Markdown review |
| P0-010 | Access control spec | Define permission/scope model and traceable policy evaluation | Spec requires backend/application enforcement | N/A | Markdown review |
| P0-011 | E2E ledger | Define scenario ledger for phases 1-12 | `docs/e2e/E2E_SCENARIOS.md` lists planned scenarios | All planned IDs | Markdown review |
| P0-012 | Phase 1 detail | Define closed skeleton/platform/E2E foundation tasks | `docs/phases/PHASE_1_PLATFORM_E2E_FOUNDATION.md` has frozen scope | E2E-001..004 | Markdown review |
| P0-013 | Decision record | Capture initial greenfield assumptions/tradeoffs | `docs/decisions/0001-initial-greenfield-architecture.md` exists | N/A | Markdown review |
| P0-014 | Implementation backlog | Group first backlog by master phases | `docs/IMPLEMENTATION_BACKLOG.md` exists and references E2E where relevant | Phase dependent | Markdown review |

## 4. Non-scope

- Production UI.
- API implementation.
- Database schema/migrations.
- Business feature code.
- Authentication implementation.
- Real integrations.
- E2E test code execution.

## 5. Domain model changes

No runtime model is implemented. Domain model changes are documentation contracts only.

## 6. API contracts

No API endpoints are implemented. Phase 1 will create a health route and skeleton API contract.

## 7. UI surfaces

No UI surfaces are implemented. Phase 1 will create a minimal Russian app shell and placeholders only.

## 8. E2E scenarios

Phase 0 defines the ledger but does not implement product E2E.

| E2E ID | Scenario | User role | Fixture | Test path | Status |
|---|---|---|---|---|---|
| E2E-001 | Application boots, health route responds, web shell renders | Test user | Seed Tenant A | `e2e/tests/phase1/app-boot.spec.ts` | planned |
| E2E-002 | Seeded demo tenant can be loaded without external services | Tenant admin | Seed Tenant A | `e2e/tests/phase1/seeded-tenant.spec.ts` | planned |
| E2E-003 | Unauthenticated user is blocked according to auth design | Anonymous | None | `e2e/tests/phase1/auth-guard.spec.ts` | planned |
| E2E-004 | Test user can enter app shell and see navigation placeholders | Project manager | Seed Tenant A | `e2e/tests/phase1/app-shell.spec.ts` | planned |

## 9. Unit and integration tests

Not applicable in Phase 0. Phase 1 must create deterministic smoke tests for skeleton behavior.

## 10. Test data and fixtures

Phase 0 defines the seed strategy in `docs/05_E2E_TRUTH_CONTRACT.md` and `docs/e2e/E2E_SCENARIOS.md`. Phase 1 creates actual fixtures.

## 11. Phase exit gate

- [ ] Mandatory Phase 0 docs exist.
- [ ] Architecture and domain docs preserve KISS PM product law.
- [ ] E2E ledger includes Phase 1 through Phase 12 scenario plan.
- [ ] Phase 1 detail document has closed skeleton tasks and mandatory E2E scenarios.
- [ ] Initial decision record captures unresolved choices.
- [ ] No product implementation code was added.

## 12. Risks and decisions

- ORM, auth, deployment, and API contract generation are intentionally unresolved until implementation planning.
- E2E commands are specified as expectations; Phase 1 must create runnable scripts.
- Product scope is broad by design; phase gates and closed backlog prevent endless MVP behavior.

