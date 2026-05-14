# Phase 1 — Platform and E2E Foundation

## 1. Phase objective

Create the minimal running monorepo skeleton for KISS PM with deterministic verification from the start: web shell, API health route, TypeScript setup, test harness, seeded demo fixture strategy, and smoke E2E scenarios. No CRM/project/KPI/business features are implemented in this phase.

## 2. Source documents

- `AGENTS.md`
- `docs/00_PROJECT_GLOBAL_GOAL.md`
- `docs/06_PRODUCT_IDENTITY.md`
- `docs/04_MASTER_PHASE_PLAN.md`
- `docs/05_E2E_TRUTH_CONTRACT.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/e2e/E2E_SCENARIOS.md`
- `docs/decisions/0001-initial-greenfield-architecture.md`

## 2.1 Scope lock

Scope status: `frozen`.

Implementation may start after this document exists. Any expansion beyond skeleton/platform/E2E foundation must be recorded in a decision record or moved to future scope.

## 2.2 KISS PM simplicity target

The user-facing skeleton must be simple: Russian shell, clear navigation placeholders, no fake business workflows. Internally it establishes strict verification, tenant fixture boundaries, and E2E structure so later user flows are proven end to end.

## 3. Functional scope

| ID | Feature / task | Expected behavior | Acceptance criteria | E2E ID | Verification |
|---|---|---|---|---|---|
| P1-001 | Monorepo workspace | Create `apps/web`, `apps/api`, package folders, shared configs | `npm` scripts can address apps/packages consistently | N/A | `npm run typecheck` |
| P1-002 | TypeScript baseline | Add shared TS config and app/package configs | Typecheck runs without product code errors | N/A | `npm run typecheck` |
| P1-003 | API health route | Minimal Bun/Hono API exposes health endpoint | Health returns stable JSON and no external dependencies | E2E-001 | API smoke test |
| P1-004 | Web shell | Minimal React/Vite shell renders Russian UI and navigation placeholders | Shell loads and has stable test IDs | E2E-001, E2E-004 | Web/component smoke plus E2E |
| P1-005 | Test auth fixture mode | Provide deterministic test-user entry behavior | Anonymous is blocked or redirected; test user can enter shell | E2E-003, E2E-004 | E2E smoke |
| P1-006 | Seed fixture strategy | Add demo tenant fixture data without external services | Seed Tenant A and Tenant B fixture builders exist | E2E-002 | Unit/API smoke |
| P1-007 | E2E harness | Add Playwright or equivalent with smoke/phase scripts | E2E smoke commands run locally | E2E-001..004 | `npm run test:e2e:smoke` |
| P1-008 | Verification scripts | Add lint/typecheck/test/e2e scripts | README documents exact commands | N/A | Run documented commands |
| P1-009 | `.env.example` | Variable names only, no secrets | Local setup is clear and safe | N/A | Manual review |
| P1-010 | README setup | Document local setup, scripts, ports, and no-live-service rule | New agent can run skeleton checks from README | N/A | Manual review |

## 4. Non-scope

- CRM opportunity implementation.
- Project/task/domain feature implementation.
- KPI/resource/control-surface behavior.
- Database production schema beyond optional skeleton/test setup.
- Real authentication provider integration.
- Real external adapters.
- Gantt implementation beyond navigation placeholder.

## 5. Domain model changes

Phase 1 may create only inert package placeholders or primitives needed for skeleton tests. It must not implement product domain behavior beyond fixture/test scaffolding.

## 6. API contracts

Initial endpoints:

| Method | Path | Purpose | Auth | Response |
|---|---|---|---|---|
| GET | `/health` | API health smoke | none | `{ "status": "ok", "service": "kiss-pm-api" }` |
| GET | `/test-fixtures/demo-tenant` | Fixture smoke if chosen | test mode only | deterministic seed tenant summary |

The fixture endpoint is optional; if not exposed over HTTP, E2E must load seeded tenant through a supported test route or app fixture mode.

## 7. UI surfaces

Initial shell surfaces:

- app root/loading state;
- unauthenticated/blocked state or test login route;
- Russian navigation placeholders for CRM Intake, Portfolio, Projects, Gantt, Resources, KPI, Control Surfaces, My Work, Retrospectives, Settings;
- demo tenant indicator in test mode.

No placeholder may pretend that a business workflow is implemented.

## 8. E2E scenarios

| E2E ID | Scenario | User role | Fixture | Test path | Status |
|---|---|---|---|---|---|
| E2E-001 | Application boots, health route responds, web shell renders | Test user | Seed Tenant A | `e2e/tests/phase1/app-boot.spec.ts` | passing |
| E2E-002 | Seeded demo tenant can be loaded without external services and tenant context follows fixture user | Tenant admin | Seed Tenant A and B | `e2e/tests/phase1/seeded-tenant.spec.ts` | passing |
| E2E-003 | Unauthenticated or unknown test user is redirected or blocked according to auth design | Anonymous / unknown test user | None | `e2e/tests/phase1/auth-guard.spec.ts` | passing |
| E2E-004 | Test user can enter app shell and see navigation placeholders | Project manager | Seed Tenant A | `e2e/tests/phase1/app-shell.spec.ts` | passing |

## 9. Unit and integration tests

- API health route smoke test.
- Web shell render smoke test.
- Fixture builder unit test proving deterministic tenant IDs/users.
- Optional script test that verifies required scripts exist.

## 10. Test data and fixtures

Seed Tenant A:

- tenant admin;
- project manager/project principal;
- resource manager;
- executor;
- read-only observer;
- placeholder opportunity/project/task/resource/KPI metadata only if needed for shell placeholders.

Seed Tenant B:

- tenant admin;
- normal user;
- at least one private placeholder entity summary for isolation tests in later phases.

Phase 1 fixtures must be synthetic and contain no real customer data.

## 11. Phase exit gate

- [x] Monorepo skeleton exists.
- [x] API health route works.
- [x] Web shell renders.
- [x] E2E smoke scenarios E2E-001 through E2E-004 are implemented and passing.
- [x] Typecheck passes.
- [x] Narrow unit/API/web smoke tests pass.
- [x] README documents commands and local setup.
- [x] `.env.example` contains variable names only.
- [x] No business feature implementation has slipped into Phase 1.

## 12. Risks and decisions

- Auth may begin as deterministic test-mode auth, but production auth remains a later decision.
- Database may be deferred if skeleton can prove fixtures without persistence; if introduced, it must stay minimal.
- Dependency additions must be justified before implementation.
