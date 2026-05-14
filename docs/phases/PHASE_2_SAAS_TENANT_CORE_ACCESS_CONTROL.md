# Phase 2 — SaaS Tenant Core and Access Control

## 1. Phase objective

Build the foundation every later KISS PM module relies on: tenants, tenant users, access profiles, scoped permission evaluation, tenant labels, basic custom-field registry, and audit primitives. The phase must prove tenant isolation and backend/application-level permission enforcement before CRM, project, KPI, resource, or control-surface features are allowed to depend on it.

## 2. Source documents

- `AGENTS.md`
- `docs/00_PROJECT_GLOBAL_GOAL.md`
- `docs/01_PRD.md`
- `docs/04_MASTER_PHASE_PLAN.md`
- `docs/05_E2E_TRUTH_CONTRACT.md`
- `docs/06_PRODUCT_IDENTITY.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/domain/DOMAIN_MODEL.md`
- `docs/domain/ACCESS_CONTROL_SPEC.md`
- `docs/domain/TENANT_CUSTOMIZATION_SPEC.md`
- `docs/e2e/E2E_SCENARIOS.md`
- `docs/phases/PHASE_1_PLATFORM_E2E_FOUNDATION.md`

## 2.1 Scope lock

Scope status: `frozen`.

Implementation may start after this document is committed. Any scope expansion must reference a decision record and update this document before code changes.

## 2.2 KISS PM simplicity target

Ordinary users should see clear Russian labels, allowed actions, and denial reasons where useful. They must not need to understand permission internals. Internally, all access decisions must be strict, traceable, deterministic, and testable so later control surfaces can rely on them safely.

## 3. Functional scope

| ID | Owner / module | Feature / task | Expected behavior | Acceptance criteria | E2E ID | Verification | Task non-scope | Done evidence |
|---|---|---|---|---|---|---|---|---|
| P2-001 | `packages/domain-core` | Tenant and workspace primitives | Create tenant/workspace/user primitives with stable IDs and tenant ownership contracts | Tenant-owned primitives require `tenantId`; fixtures can create Tenant A and Tenant B deterministically | E2E-010 | `npm test`, `npm run typecheck` | No production auth, database schema, CRM/project entities, or UI builder | Unit test names, changed files, and passing command output recorded in `docs/status/phase2-requirements-matrix.json` |
| P2-002 | `packages/access-control` | Access profile model | Implement `AccessProfile`, `Permission`, `ScopeRule`, and profile assignment model | Profiles are tenant-owned, versioned enough for diagnostics, and contain permission/scope rules | E2E-011 | `npm test`, access-control unit tests | No full admin builder, role hierarchy engine, or production identity provider | Unit test names, changed files, and passing command output recorded in matrix |
| P2-003 | `packages/access-control` | Policy evaluator | Implement deterministic permission/scope evaluator with trace output | Allows/denies by permission, supported scope, tenant mismatch, and target ownership; returns safe trace/reason | E2E-010, E2E-012 | `npm test`, access-control unit tests | No team/department hierarchy resolution, CRM/project business permissions, or UI-only authorization | Unit and integration evidence recorded in matrix |
| P2-004 | `packages/tenant-config`, `apps/web` | Tenant label configuration | Implement versioned tenant label set for roles, navigation placeholders, and runtime labels used by shell/demo views | Admin changes a label and runtime UI reads from tenant configuration, not hardcoded domain logic; previous label version remains traceable | E2E-013 | unit tests plus E2E | No full no-code process builder, localization marketplace, or template migration UI | Unit, API, and E2E evidence recorded in matrix |
| P2-005 | `packages/tenant-config` | Basic custom field registry | Implement metadata-only versioned `CustomFieldDefinition` registry for tenant-owned entity types | Supports key, label, target entity type, value type, required flag, active flag, version, validation rules, visibility rules, permission rules metadata, and filter/control-surface/KPI binding flags | N/A | unit tests | No runtime custom-field value storage, formula execution, builder UI, or data migration | Unit tests for valid definitions, duplicate keys, invalid target types, and version handling recorded in matrix |
| P2-006 | `packages/domain-core`, `apps/api` | Audit event primitives | Implement append-oriented audit event model and service for Phase 2 admin/permission actions | Audit records actor, tenant, action key, target, result, timestamp, and correlation ID | E2E-014 | unit/integration tests plus E2E | No full action-engine implementation, notification dispatch, or external audit export | Unit/integration/E2E evidence recorded in matrix |
| P2-007 | `apps/api` | API tenant/access endpoints | Add minimal API routes for tenant summary, access profiles, label update, permission diagnostics, tenant-isolation probe, and audit readback | Routes validate input, establish actor/tenant context, enforce policy server-side, return stable DTOs, and deny cross-tenant probe access | E2E-010..014 | integration tests plus E2E | No CRM/project APIs, production auth provider, real external integration, or unrestricted diagnostics | Integration test names, E2E IDs, and command output recorded in matrix |
| P2-008 | `apps/web` | Web tenant/admin shell surfaces | Add minimal Russian admin/control placeholders for tenant labels, access profiles, permission diagnostics, isolation probe readback, and audit evidence | UI triggers real API mutations and refreshes state; read-only user cannot mutate; cross-tenant probe denial is visible without leaking private details | E2E-011..014 | component smoke plus E2E | No decorative dashboard, full builder, CRM/project workflow, or hidden-button-only permission proof | Component/E2E evidence and screenshots/traces on failure recorded in matrix |
| P2-009 | `packages/shared-test-fixtures`, `e2e/` | Deterministic Phase 2 fixtures | Extend seeded tenants with admin, project manager, read-only observer, Tenant B private isolation probe data, labels, access profiles, and audit seed where needed | E2E reset/seed is deterministic and uses no live external service or customer data | E2E-010..014 | fixture tests plus E2E | No production data, random IDs, live external service, or fixture dependence on execution order | Fixture test evidence and reset/readback evidence recorded in matrix |
| P2-010 | `docs/status`, `scripts` | Phase 2 verification matrix | Create/update machine-readable Phase 2 requirements matrix and ensure verifier rejects incomplete evidence at phase exit | Matrix rows P2-001..P2-010 exist before implementation; final phase exit requires every row to be `verified` with fresh evidence; verifier rejects blocked rows unless `--allow-blocked` is explicitly used for pre-implementation tracking | All Phase 2 | `npm run verify:matrix -- docs/status/phase2-requirements-matrix.json` | No prose-only completion, stale command evidence, skipped E2E, or unchecked cleanup | Passing matrix verifier output and final command log recorded in matrix |

## 4. Non-scope

- CRM opportunity, client, contact, or project draft behavior.
- Project lifecycle, task, Kanban, Gantt, KPI, resource planning, and control-surface feature implementation.
- Full no-code builder.
- Complex process templates.
- Production authentication provider.
- Billing, licensing, organizations beyond tenant/workspace primitives.
- Real database migrations if deterministic in-memory/test persistence is sufficient for this phase; if persistence is introduced, it must stay minimal and documented.
- External integrations.

## 5. Domain model changes

Entities and value objects:

- `Tenant`
- `TenantConfiguration`
- `Workspace`
- `TenantUser`
- `ActorContext`
- `TenantContext`
- `AccessProfile`
- `Permission`
- `ScopeRule`
- `PolicyRequest`
- `PolicyEvaluation`
- `PolicyTrace`
- `TenantLabelSet`
- `CustomFieldDefinition`
- `AuditEvent`
- `AuditTargetRef`
- `TenantIsolationProbe`

Invariants:

- Tenant mismatch denies before entity details are exposed.
- Read permission does not imply mutation permission.
- Every tenant-owned entity has exactly one `tenantId`.
- Tenant labels are data, not permission logic.
- Tenant configuration and custom field definitions are versioned when runtime behavior depends on them.
- Permission evaluator is deterministic and independent from React, Hono, and network calls.
- Audit events are append-oriented and not edited by normal flows.

Supported Phase 2 scope values are closed:

- `own`: actor owns the target entity.
- `project`: actor is linked to the target project context when a project context exists; Phase 2 may only validate shape and safe denial because project entities are out of scope.
- `tenant`: actor can access entities in the active tenant.
- `all`: tenant-wide administrative access inside the active tenant only.

Unsupported Phase 2 scope values:

- `team`;
- `department`.

Unsupported scopes must return `allowed: false` with reason code `unsupported_scope`, not silently allow or throw.

## 6. API contracts

Initial routes may be adjusted during implementation only if this document is updated first.

| Method | Path | Purpose | Required permission | Notes |
|---|---|---|---|---|
| GET | `/health` | Phase 1 health route | none | Must remain compatible with E2E-001 |
| GET | `/tenants/current` | Current tenant summary, labels, actor profile | `tenant.read` | Test-auth actor context only for Phase 2 |
| GET | `/admin/access-profiles` | List tenant access profiles | `access_profile.read` | Tenant-scoped |
| POST | `/admin/access-profiles` | Create or update access profile | `access_profile.write` | Writes audit event |
| POST | `/admin/labels` | Update tenant label value | `tenant_labels.write` | Writes audit event |
| POST | `/admin/permissions/evaluate` | Return policy evaluation trace | `permission.diagnostics.read` | Must not leak cross-tenant private details |
| GET | `/tenant-isolation-probes/:probeId` | Read synthetic tenant-owned probe record for isolation tests | `tenant_probe.read` | Tenant A users must receive safe denial for Tenant B probe IDs |
| GET | `/audit/events` | Read tenant audit events | `audit.read` | Tenant-scoped |
| POST | `/test-fixtures/reset` | Reset deterministic fixtures | test mode only | E2E/support only |

### 6.1 DTO contracts

All responses use stable English field names. Russian strings may appear only as tenant-configured labels or safe user-facing messages.

#### Error DTO

```txt
ErrorDto
- code: string
- message: string
- correlationId?: string
- traceId?: string
```

Required error codes:

- `unauthenticated`;
- `permission_denied`;
- `tenant_mismatch`;
- `unsupported_scope`;
- `validation_error`;
- `not_found`;
- `conflict`;
- `test_mode_only`.

#### Current tenant response

```txt
CurrentTenantDto
- tenant: { id, label, configurationVersion }
- actor: { id, displayName, accessProfileId }
- labels: Record<string, string>
- permissions: string[]
```

#### Access profile upsert request/response

```txt
UpsertAccessProfileRequest
- id?: string
- version?: number
- systemKey: string
- label: string
- permissions: string[]
- scopeRules: { permissionKey, scope, constraints? }[]
- active: boolean

AccessProfileDto
- id
- tenantId
- systemKey
- label
- permissions[]
- scopeRules[]
- active
- version
- updatedAt
```

Conflict rule: update with stale `version` returns `409 conflict` and writes no audit event.

#### Label update request/response

```txt
UpdateTenantLabelRequest
- key: string
- label: string
- expectedConfigurationVersion: number

TenantLabelSetDto
- tenantId
- configurationVersion
- labels: Record<string, string>
```

#### Permission diagnostics request/response

```txt
PolicyDiagnosticsRequest
- permissionKey: string
- targetEntityType: string
- targetEntityId?: string
- targetTenantId?: string
- requestedScope?: string

PolicyDiagnosticsDto
- allowed: boolean
- reasonCode: string
- scope?: string
- trace: string[]
```

Trace must be safe: cross-tenant denials may say `tenant_mismatch` but must not expose Tenant B entity details.

#### Tenant isolation probe response

```txt
TenantIsolationProbeDto
- id
- tenantId
- label
```

Tenant A reading Tenant B probe must return safe `permission_denied` or `not_found` according to implementation decision, but the choice must be consistent across API and E2E.

#### Audit event response

```txt
AuditEventDto
- id
- tenantId
- actorId
- actionKey
- target: { entityType, entityId }
- result
- timestamp
- correlationId
```

DTO implementation rules:

- Zod validation at API boundary.
- Stable English field names in DTOs.
- Russian text remains UI/config data.
- Error DTO includes stable `code` and safe Russian `message` for user-facing errors where applicable.

## 7. UI surfaces

Phase 2 UI surfaces stay utilitarian and admin-focused:

- tenant/admin shell entry in the existing web app;
- access profile list/editor MVP;
- tenant label edit MVP;
- permission diagnostics panel;
- audit event readback panel;
- read-only denial state.

Required states:

- loading;
- empty;
- validation error;
- permission denied;
- successful save;
- refreshed state after mutation.

No marketing page, decorative dashboard, full builder, or product workflow UI is in scope.

## 8. E2E scenarios

| E2E ID | Scenario | User role | Fixture | Test path | Status |
|---|---|---|---|---|---|
| E2E-010 | Tenant A user cannot see Tenant B data | Tenant A project manager | Seed Tenant A/B with private Tenant B data | `e2e/tests/phase2/tenant-isolation.spec.ts` | planned |
| E2E-011 | Admin can create or edit an access profile | Tenant admin | Seed Tenant A | `e2e/tests/phase2/access-profile.spec.ts` | planned |
| E2E-012 | Read-only user can open a page but cannot execute a mutation | Read-only observer | Seed Tenant A | `e2e/tests/phase2/read-only-permissions.spec.ts` | planned |
| E2E-013 | Tenant label change is reflected in UI without code changes | Tenant admin | Seed Tenant A label set | `e2e/tests/phase2/tenant-labels.spec.ts` | planned |
| E2E-014 | Auditable action records actor, tenant, timestamp, and result | Tenant admin | Seed Tenant A | `e2e/tests/phase2/audit-basics.spec.ts` | planned |

### 8.1 E2E scenario detail requirements

`E2E-010` must prove:

1. Tenant A user sees Tenant A probe data.
2. The same user attempts to open Tenant B probe by direct URL or UI/API-driven route.
3. UI shows safe denial or not-found state without Tenant B private label.
4. Direct API attempt is denied.
5. Reload keeps the denial behavior.

`E2E-011` must prove:

1. Admin opens access profile editor.
2. Admin creates or edits a profile with permissions and scopes.
3. API state reflects the new profile.
4. Reload keeps the profile.
5. Audit event exists for the mutation.

`E2E-012` must prove:

1. Read-only user opens permitted page.
2. Mutation control is unavailable or disabled with reason.
3. Direct API mutation attempt is denied.
4. No audit success event is written for the denied mutation; denied attempt may be logged if implemented.

`E2E-013` must prove:

1. Admin changes a tenant label.
2. UI refreshes and shows the new label without code changes.
3. Reload keeps the label.
4. Previous configuration version remains traceable through API or audit evidence.

`E2E-014` must prove:

1. Admin executes a Phase 2 state-changing action.
2. UI shows the resulting state.
3. API audit readback returns actor, tenant, timestamp, action key, target, result, and correlation ID.
4. Tenant B user cannot read Tenant A audit event.

## 9. Unit and integration tests

Required unit tests:

- tenant-owned primitive construction and tenant mismatch guard;
- access profile creation/update validation;
- policy evaluator allow/deny by permission;
- policy evaluator deny on tenant mismatch before target details;
- scope rule behavior for own, project, tenant, and all;
- unsupported team/department scopes deny with `unsupported_scope`;
- tenant label set update and readback;
- custom field registry validation for duplicate keys and invalid target types;
- audit event creation and immutability behavior.

Required integration tests:

- API denies mutation without permission even when direct HTTP request is made;
- API returns safe policy trace for diagnostics;
- label update persists in the deterministic test store and is visible on readback;
- access profile mutation writes audit event;
- Tenant A cannot retrieve Tenant B fixture data.

## 10. Test data and fixtures

Seed Tenant A:

- tenant admin with full Phase 2 admin permissions;
- project manager/project principal with tenant read and limited diagnostics;
- read-only observer with read-only scope;
- access profile seed set;
- label set with Russian labels;
- private Tenant A placeholder entity for isolation tests;
- empty audit log or known audit seed.

Seed Tenant B:

- tenant admin;
- normal user;
- private Tenant B placeholder entity that Tenant A users must not see;
- distinct label set to prove tenant scoping.

Fixture reset rules:

- E2E must reset before scenario or use isolated deterministic IDs.
- No live external service.
- No real customer data.
- No production secrets.

## 11. Phase exit gate

- [ ] Functional scope P2-001 through P2-010 implemented.
- [ ] Mandatory E2E scenarios E2E-010 through E2E-014 implemented and passing.
- [ ] Phase 1 smoke E2E still passing.
- [ ] Unit/integration tests passing for changed modules.
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] Backend/application permission enforcement proven, not only hidden UI controls.
- [ ] Tenant isolation proven through API and UI/E2E.
- [ ] Audit trail created for Phase 2 admin/permission actions.
- [ ] Docs, E2E ledger, and Phase 2 requirements matrix updated.
- [ ] No Phase 3+ product behavior implemented.

## 12. Risks and decisions

- Persistence can remain deterministic in-memory/test-store for Phase 2 if it proves tenant/access/audit behavior; production PostgreSQL decision remains open unless implementation requires it.
- Test auth remains fixture-only and must not be confused with production auth.
- Custom fields are metadata-only in Phase 2; runtime entity value storage can wait until the owning domain phases.
- Permission scopes may begin with the minimum set required by E2E and unit tests, but the evaluator API must not block adding scopes later.
- If UI needs more than a minimal admin surface, keep the design utilitarian and avoid product-dashboard scope creep.
