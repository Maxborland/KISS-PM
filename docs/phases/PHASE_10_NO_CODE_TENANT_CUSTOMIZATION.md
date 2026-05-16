# Phase 10 — No-code Tenant Customization

## 1. Phase objective

Enable a tenant admin to adapt KISS PM without code changes for common operating-model differences: labels, roles, stages/process templates, custom project fields, KPI thresholds, saved control-surface views/layouts, and action availability/forms. The user loop must stay simple and safe: change configuration in a guided builder, preview runtime impact, publish a version, verify runtime behavior after reload, and see audit/readback evidence.

## 2. Source documents

- `AGENTS.md`
- `docs/00_PROJECT_GLOBAL_GOAL.md`
- `docs/01_PRD.md`
- `docs/04_MASTER_PHASE_PLAN.md`
- `docs/05_E2E_TRUTH_CONTRACT.md`
- `docs/06_PRODUCT_IDENTITY.md`
- `docs/domain/TENANT_CUSTOMIZATION_SPEC.md`
- `docs/domain/DOMAIN_MODEL.md`
- `docs/domain/ACCESS_CONTROL_SPEC.md`
- `docs/domain/KPI_ENGINE_SPEC.md`
- `docs/domain/CONTROL_SURFACE_ENGINE_SPEC.md`
- `docs/domain/ACTION_ENGINE_SPEC.md`
- `docs/e2e/E2E_SCENARIOS.md`
- `docs/product/P3_P12_PRODUCT_UX_SPEC.md`
- `docs/product/USER_STORIES_P3_P12.md`
- `docs/product/ROLE_BASED_JOURNEYS.md`
- `docs/product/SCREEN_INTERACTION_CATALOG.md`
- `docs/product/DESIGN_SYSTEM.md`
- `docs/product/UX_SALES_QUALITY_GATE.md`
- `docs/status/p3-p12-ux-screen-matrix.json`
- `docs/phases/PHASE_7_KPI_ENGINE_CONTROL_SIGNALS.md`
- `docs/phases/PHASE_8_CONTROL_SURFACES_ACTION_ENGINE.md`
- `docs/phases/PHASE_9_CLOSED_PORTFOLIO_RETROSPECTIVES.md`

## 2.1 Scope lock

Scope status: `frozen`.

Implementation may start after this document, `docs/status/phase10-requirements-matrix.json`, and P10 verifier support pass tracking verification. Any later scope change must update this document before product code changes.

## 2.2 KISS PM simplicity target

Tenant configuration must feel like a guided operations admin workspace, not a raw schema editor. The default path is: choose a safe preset or focused builder, preview affected runtime surfaces, validate with plain Russian error messages, publish a version, inspect audit/result evidence, and verify the runtime screen after reload. Internally, configuration remains versioned, tenant-scoped, validated, permission-checked, auditable, and non-executable.

## 3. Functional scope

| ID | Owner / module | Feature / task | Expected behavior | Acceptance criteria | E2E ID | Verification | Task non-scope | Done evidence |
|---|---|---|---|---|---|---|---|---|
| P10-001 | `packages/tenant-config`, `packages/access-control` | TenantConfiguration root, versions, and publish lifecycle | Define versioned tenant configuration aggregate with draft/active/archived states and refs to labels, process templates, access profiles, KPI definitions, control surfaces, actions, custom fields, saved views, and feature flags | Active runtime read models resolve by tenant and config version; publishing requires permission, validation, audit id, actor, timestamp, and preserves previous active version | E2E-090, E2E-095 | unit tests, integration tests, E2E | No database migrations or production config storage engine beyond current test/runtime architecture | Domain/API/E2E evidence and matrix row update |
| P10-002 | `packages/tenant-config`, `apps/api`, `apps/web` | Role/label/stage builder and runtime label projection | Tenant admin edits role and stage labels by stable system key, previews affected project/task/control surfaces, and publishes a label-set version | Runtime project/stage/task/control-surface UI uses tenant labels after reload; domain logic still uses stable keys; read-only/direct API mutation is denied; audit records before/after | E2E-090 | unit/API/component/E2E tests | No full localization management or arbitrary per-user vocabulary | Label builder and runtime readback evidence |
| P10-003 | `packages/tenant-config`, `packages/project-core`, `apps/api`, `apps/web` | Process template builder MVP | Tenant admin edits safe process template metadata, stage order/labels, role bindings, and task template basics with preview before publish | Future project creation uses the new process template version; existing active projects retain their original template/version unless an explicit migration action is later introduced | E2E-090, E2E-095 | domain/API/component/E2E tests | No unlimited workflow language, conditional workflow engine, or active-project migration | Process builder evidence and runtime stability proof |
| P10-004 | `packages/tenant-config`, `packages/project-core`, `packages/control-surfaces`, `apps/api`, `apps/web` | Custom field builder and control-surface binding | Tenant admin creates a custom project field with type/validation/visibility/filterability, preview, and publish; authorized project user fills the field and sees it in a configured control surface | Custom field is tenant-scoped, typed, validated, permission-aware, survives reload, appears only on allowed target surfaces, and Tenant B cannot read it | E2E-091 | domain/API/component/E2E tests | No arbitrary field scripts, cross-entity calculated fields, or complex migrations | Custom field write/read/control-surface evidence |
| P10-005 | `packages/tenant-config`, `packages/kpi-engine`, `apps/api`, `apps/web` | KPI threshold builder and future evaluation impact | Tenant admin edits a KPI threshold/rule through a guided builder with impact preview, validation, and publish | Future KPI evaluation uses the new threshold version; historical evaluations remain traceable to the old version; invalid formulas/thresholds are rejected | E2E-092, E2E-094 | domain/API/component/E2E tests | No arbitrary JavaScript/SQL formulas or full BI semantic layer | KPI threshold preview/publish/evaluation evidence |
| P10-006 | `packages/tenant-config`, `packages/control-surfaces`, `apps/api`, `apps/web` | Saved views and control-surface layout builder MVP | Tenant admin configures fields, filters, sorting, grouping, visible widgets, and saved-view scope for a core control surface | Published layout loads after reload for target tenant/scope, unavailable fields/actions are explained, and previous saved view version remains readable | E2E-093 | domain/API/component/E2E tests | No drag-and-drop marketplace-grade builder or arbitrary widget scripting | Layout builder and saved-view readback evidence |
| P10-007 | `packages/tenant-config`, `packages/action-engine`, `packages/control-surfaces`, `apps/api`, `apps/web` | Action enable/disable and action-form configuration | Tenant admin enables/disables configured actions and adjusts safe form fields/defaults for existing governed command bindings | Control surfaces reflect action availability after reload; disabled actions cannot be executed by direct API; action form config validates against command schema; audit exists | E2E-093, E2E-094, E2E-095 | domain/API/component/E2E tests | No arbitrary user-defined command bindings or executable action code | Action config permission/audit/readback evidence |
| P10-008 | `apps/api`, `apps/web`, `packages/tenant-config` | Configuration validation, admin preview, export/import, permissions, and audit API | Provide tenant configuration read models, preview, validate, publish, export, import-preview, and import-apply APIs plus admin UI states | Invalid config is rejected with actionable reason; export/import preserves versions; unauthorized and cross-tenant calls are denied without leakage or partial writes; audit records config changes | E2E-090..095 | API/component/E2E tests | No P11 external adapter import/migration or production backup/restore | Validation/export/import and backend guard evidence |
| P10-009 | `packages/shared-test-fixtures`, `e2e/tests/phase10` | Deterministic P10 fixtures and E2E-090..095 | Seed Tenant A admin/read-only/runtime users, labels, process template, project/control surface, KPI threshold, saved view, custom field candidates, action config, export/import sample, and Tenant B isolation data | E2E proves UI + API/domain readback, backend denial, audit evidence, reload persistence, runtime stability, and cleanup/reset for all P10 flows | E2E-090..095 | fixture tests plus E2E | No random ids, live services, production data, skipped/flaky scenarios | Fixture/E2E evidence and matrix row update |
| P10-010 | `docs/status`, `scripts` | Phase 10 verification matrix and exit gate | Track P10-001..P10-010 and require structured E2E evidence for Phase 10 exit | Strict verifier fails blocked rows, missing rows, stale evidence, placeholder blockers, wrong E2E paths, missing cleanup, and phase exit without E2E-090..095 metadata | E2E-090..095 | strict matrix verifier | No `--allow-blocked` phase exit and no planned E2E as evidence | Passing strict matrix verifier and final command log |

## 4. Non-scope

- Arbitrary SQL, JavaScript, plugins, or user-authored executable formulas/actions.
- Full marketplace, template marketplace, or external package installation.
- Full workflow language, active-project migration engine, or complex data migration. P10 may validate and block unsafe changes, but migration belongs to later explicit work.
- Production persistence architecture or database migrations beyond current repo/runtime patterns if not already established.
- Integrations and migration from external systems. P11 owns adapters, imports, idempotency, and failure-mode UI.
- Production hardening, observability, backup/restore, and release checklist. P12 owns market release.
- Rewriting P3-P9 user flows; P10 must adapt them through configuration and prove runtime behavior stays stable.

## 5. Domain model changes

Entities and value objects:

- `TenantConfiguration`
- `ConfigurationVersion`
- `ConfigurationDraft`
- `ConfigurationPublishDecision`
- `ConfigurationValidationIssue`
- `ConfigurationPreview`
- `LabelSetVersion`
- `RoleTemplateVersion`
- `ProcessTemplateDraft`
- `StageTemplateDraft`
- `CustomFieldDefinitionVersion`
- `CustomFieldValue`
- `KpiThresholdDraft`
- `ControlSurfaceLayoutDefinition`
- `SavedViewDefinition`
- `ActionConfiguration`
- `ActionFormFieldConfig`
- `ConfigurationExportPackage`
- `ConfigurationImportPreview`
- `ConfigurationAuditRef`

Invariants:

- Every configuration object belongs to exactly one tenant.
- Domain logic uses stable system keys; tenant labels are display/runtime projection data only.
- Editing runtime-shaping config creates a new version unless the change is metadata-only and explicitly marked safe.
- Active runtime entities keep references to the config version that shaped them.
- Publishing requires backend permission, validation pass, actor, timestamp, audit/action evidence, and before/after trace.
- Invalid config must not partially publish.
- Read-only and out-of-tenant users cannot mutate config through UI or direct API.
- Config export/import is tenant-scoped, validated before apply, and cannot overwrite another tenant.
- Custom fields, KPI thresholds, layout definitions, saved views, and action form configs must be constrained data, not executable code.

## 6. API contracts

Minimum Phase 10 routes:

- `GET /api/tenant/configuration`
- `GET /api/tenant/configuration/versions`
- `POST /api/tenant/configuration/validate`
- `POST /api/tenant/configuration/preview`
- `POST /api/tenant/configuration/publish`
- `GET /api/tenant/configuration/audit`
- `GET /api/tenant/labels`
- `POST /api/tenant/labels/preview`
- `POST /api/tenant/labels/publish`
- `GET /api/tenant/process-templates`
- `POST /api/tenant/process-templates/preview`
- `POST /api/tenant/process-templates/publish`
- `GET /api/tenant/custom-fields`
- `POST /api/tenant/custom-fields/preview`
- `POST /api/tenant/custom-fields/publish`
- `GET /api/tenant/kpi-thresholds`
- `POST /api/tenant/kpi-thresholds/preview`
- `POST /api/tenant/kpi-thresholds/publish`
- `GET /api/tenant/saved-views`
- `POST /api/tenant/saved-views/preview`
- `POST /api/tenant/saved-views/publish`
- `GET /api/tenant/action-configs`
- `POST /api/tenant/action-configs/preview`
- `POST /api/tenant/action-configs/publish`
- `GET /api/tenant/configuration/export`
- `POST /api/tenant/configuration/import/preview`
- `POST /api/tenant/configuration/import/apply`

Minimum DTOs:

- tenant configuration read model with active/draft version refs;
- label/process/custom-field/KPI/saved-view/action-config drafts;
- validation issue list with severity, field path, affected runtime surface, and recovery text;
- preview result with before/after, affected surfaces, and blocked/allowed publish state;
- publish result with new version id, audit/action ids, changed refs, and runtime refresh hints;
- export package with tenant-safe configuration objects and checksum/version metadata;
- import preview with diff, validation issues, conflicts, and apply token;
- audit/action evidence readback.

Permission keys:

- `tenant.config.read`
- `tenant.config.write`
- `tenant.config.export`
- `tenant.config.import`
- `project.template.write`
- `custom_field.write`
- `kpi.config.write`
- `control_surface.config.write`
- `action.config.write`
- `audit.read`

Typed errors:

- `permission_denied`
- `tenant_mismatch`
- `configuration_not_found`
- `configuration_version_not_found`
- `configuration_validation_failed`
- `configuration_preview_required`
- `stale_preview`
- `duplicate_system_key`
- `unsafe_template_change`
- `unknown_source_binding`
- `unknown_command_binding`
- `invalid_custom_field_type`
- `invalid_formula`
- `invalid_threshold`
- `invalid_layout`
- `invalid_action_form`
- `import_checksum_mismatch`
- `import_conflict`
- `partial_publish_rejected`

## 7. UI surfaces

- `/admin/tenant/labels` Tenant Labels:
  - label table by stable system key;
  - runtime preview panel;
  - publish action and audit/result feedback;
  - reset-to-template secondary action;
  - loading/empty/error/denied states.
- `/admin/tenant/process-templates` Process Template Builder:
  - template list and version details;
  - stage/role/task-template editor;
  - affected runtime preview;
  - publish validation and audit/result feedback.
- `/admin/tenant/custom-fields` Custom Field Builder:
  - target entity and field definition table;
  - editor sheet with type/validation/visibility/filterability;
  - runtime/control-surface preview;
  - publish validation and audit/result feedback.
- `/admin/tenant/kpi-thresholds` KPI Threshold Builder:
  - threshold editor;
  - impact preview using sample/current KPI source data;
  - publish and audit/result feedback.
- `/admin/tenant/saved-views` Saved Views / Layout Builder:
  - saved view list;
  - layout fields/filters/widgets/actions editor;
  - permission preview;
  - publish and runtime reload readback.
- `/admin/tenant/action-configs` Action Configuration:
  - action enable/disable;
  - safe action-form field/default configuration;
  - command schema compatibility preview;
  - publish and audit/result feedback.
- `/admin/tenant/configuration` Configuration Overview:
  - active/draft/version timeline;
  - validation summary;
  - export/import controls;
  - audit timeline;
  - recovery guidance for invalid config.

User-facing copy must be Russian by default. Builder screens must be dense but readable and must not look like generic CRUD tables.

## 8. E2E scenarios

| E2E ID | Scenario | User role | Fixture | Test path | Status |
|---|---|---|---|---|---|
| E2E-090 | Admin renames roles/stages and runtime UI changes | Tenant admin | Seed Tenant A with project/process template using stable role/stage keys | `e2e/tests/phase10/labels-runtime.spec.ts` | planned |
| E2E-091 | Admin adds custom project field and uses it in a control surface | Tenant admin | Seed Tenant A project/control surface with custom-field-capable layout | `e2e/tests/phase10/custom-field-control-surface.spec.ts` | planned |
| E2E-092 | Admin edits KPI threshold and sees effect in evaluation | Tenant admin | Seed Tenant A KPI definition/evaluation source data | `e2e/tests/phase10/kpi-builder-effect.spec.ts` | planned |
| E2E-093 | Admin configures a control surface layout and saves it | Tenant admin | Seed Tenant A configurable Portfolio/KPI/Resource control surface | `e2e/tests/phase10/control-surface-layout-builder.spec.ts` | planned |
| E2E-094 | Invalid configuration is rejected with actionable validation | Tenant admin | Seed Tenant A invalid duplicate key, invalid formula, invalid layout, and unsafe action config drafts | `e2e/tests/phase10/config-validation.spec.ts` | planned |
| E2E-095 | Previous runtime behavior remains stable after unrelated configuration change | Tenant admin | Seed Tenant A active project/runtime views plus unrelated config draft | `e2e/tests/phase10/config-regression.spec.ts` | planned |

Required assertion pattern:

- User sees starting configuration and target runtime state.
- Authorized tenant admin previews and publishes a configuration version.
- Unauthorized/read-only/out-of-tenant users cannot publish through UI or direct API.
- UI shows validation, preview, result, and audit/action evidence.
- API/domain readback shows new version and runtime projections.
- Runtime surfaces use the new config only where intended after reload.
- Historical or unrelated runtime behavior remains stable.
- Export/import preview/apply proves validation and tenant isolation where applicable.
- Cleanup/reset is verified or state is deterministic in-memory/test-only.

## 9. Unit and integration tests

- TenantConfiguration version lifecycle tests.
- LabelSetVersion tests for stable keys, duplicate rejection, runtime projection, and no domain-logic label branching.
- ProcessTemplate builder tests for draft/edit/publish, unsafe active-project change rejection, and future-project version binding.
- CustomFieldDefinition tests for target entity, type validation, visibility/filterability, value validation, and Tenant B isolation.
- KPI threshold builder tests for safe formula/threshold validation, versioning, impact preview, future evaluation, and historical evaluation stability.
- SavedView/Layout tests for field/filter/action validation, permission-aware layout readback, and reload persistence.
- ActionConfiguration tests for command binding compatibility, disabled action backend denial, form default validation, and audit.
- API integration tests for every preview/publish/export/import route, permissions, tenant isolation, stale preview, invalid input, and no partial write.
- Web component tests for all admin surfaces: loading, empty, error, denied, validation, preview, publish result, audit feedback, and refetch/reload behavior.
- Matrix verifier regression tests for P10 required rows, E2E ids, paths, placeholder blockers, cleanup, and strict structured E2E evidence.

## 10. Test data and fixtures

Seed Tenant A:

- tenant admin, read-only observer, project manager/runtime user;
- active configuration version with labels, process template, KPI threshold, saved views, action configs, and custom-field-capable surfaces;
- project created from an earlier process-template version;
- project/control surface that can show tenant labels and custom project fields;
- KPI definition and evaluation source data from P7;
- control surface definition/action definitions from P8;
- retrospective/template-improvement version history from P9 where needed for future-template stability;
- valid and invalid configuration drafts;
- export package and import preview package.

Seed Tenant B:

- private tenant configuration, project, custom field, KPI threshold, and saved view data for no-leak tests.

Reset rules:

- Phase 10 reset restores active/draft configuration versions, label sets, process templates, custom fields/values, KPI thresholds/evaluations, saved views/layouts, action configs, export/import previews, action executions, and audit events.
- No live external services, production data, random ids, or order-dependent fixtures.
- Write-flow E2E must prove reset/readback or deterministic in-memory state restoration.

## 11. Phase exit gate

The phase is complete only when all criteria below pass.

- [ ] Functional scope P10-001..P10-010 implemented.
- [ ] Mandatory E2E scenarios E2E-090..095 implemented and passing through `npm run test:e2e:phase -- --phase=10`.
- [ ] Earlier critical E2E scenarios still passing where impacted.
- [ ] Unit/integration tests passing for changed modules.
- [ ] Typecheck/lint pass where relevant.
- [ ] Tenant labels/roles/stages change runtime UI without code changes while domain logic uses stable keys.
- [ ] Custom project fields are typed, validated, visible in runtime/control surfaces, and tenant-scoped.
- [ ] KPI threshold changes affect future evaluation while historical evaluations remain traceable.
- [ ] Saved views and control-surface layouts publish, reload, and respect permissions.
- [ ] Action enable/disable and form configuration cannot bypass governed action engine validation.
- [ ] Validation rejects unsafe/invalid configuration without partial writes.
- [ ] Export/import preview/apply is tenant-scoped, validated, audited, and resettable.
- [ ] Permissions enforced at backend/application layer and proven by UI visibility plus direct API denial.
- [ ] API/domain readback, projection refresh, reload persistence, and cleanup/reset are proven for write flows.
- [ ] `docs/status/phase10-requirements-matrix.json` passes without `--allow-blocked`.
- [ ] No unresolved Critical or Important review findings remain.
- [ ] Docs, matrix, handoff, and agent-bus state are updated.

## 12. Risks and decisions

- P10 E2E ids are E2E-090..095, following `docs/04_MASTER_PHASE_PLAN.md` and `docs/e2e/E2E_SCENARIOS.md`. Older product docs that attach E2E-060..062 to P10 admin screens are stale because Phase 7 owns E2E-060..064.
- P10 must reuse constrained P7/P8/P9 engines and command bindings. It must not introduce arbitrary code execution under the name of no-code.
- Full active-project migration is intentionally out of scope. Unsafe template changes should be blocked with validation and future migration can be planned separately.
- Configuration export/import in P10 is tenant configuration only. P11 owns external system import/migration.
- If existing runtime surfaces lack enough configuration seams, implementation should add narrow versioned extension points rather than rewrite P3-P9 flows.
