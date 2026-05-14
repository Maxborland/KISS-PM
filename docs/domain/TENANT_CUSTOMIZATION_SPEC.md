# Tenant Customization Spec

## 1. Purpose

KISS PM must be configurable by tenants without code changes. Customization is data-driven, constrained, versioned, validated, and previewable. It is not an unrestricted scripting platform.

## 2. Configurable objects

- `RoleTemplate`;
- `ProcessTemplate`;
- `StageTemplate`;
- `ArtifactTemplate`;
- `TaskTemplate`;
- `ApprovalTemplate`;
- `KpiDefinition`;
- `FormulaDefinition`;
- `ThresholdRule`;
- `ControlSurfaceDefinition`;
- `ActionDefinition`;
- `CustomFieldDefinition`;
- `AccessProfile`;
- `SavedView`;
- `FeatureFlag`.

## 3. Configuration root

```txt
TenantConfiguration
- id
- tenantId
- version
- labelSetVersion
- processTemplateVersions[]
- accessProfileVersions[]
- kpiDefinitionVersions[]
- controlSurfaceVersions[]
- actionDefinitionVersions[]
- customFieldDefinitionVersions[]
- status: draft | active | archived
- createdBy
- createdAt
- activatedAt
```

## 4. Stable keys and labels

Domain logic uses stable system keys. UI uses tenant labels.

Example:

```txt
systemKey: concept_design
defaultLabel: Concept / Preliminary Design
tenantLabel: Tenant configured Russian or industry label
```

Forbidden patterns:

```txt
if tenant.name == "Specific Company"
if stage.label == "GZMPK"
if role.label == "GAP"
```

## 5. Custom fields

Custom fields must define:

- target entity type;
- stable key;
- tenant label;
- value type;
- validation rules;
- visibility rules;
- permission rules where needed;
- whether the field can be used in filters/control surfaces/KPI source bindings;
- version.

## 6. Validation and preview

Every builder/admin surface that changes runtime behavior must support validation. Risky configuration should support preview before activation.

Validation examples:

- duplicate stable keys rejected;
- removing a stage used by active projects requires migration or deactivation rule;
- formula references unknown source binding rejected;
- action references unknown command binding rejected;
- custom field type changes require migration policy.

## 7. Versioning rules

- Active runtime entities keep references to the configuration version that shaped them.
- Editing a template creates a new version unless the change is metadata-only.
- Updating a template must not silently rewrite active project history.
- Later phases may add explicit migration actions with preview and audit.

## 8. KISS simplicity rules

- Prefer safe presets over blank-slate configuration.
- Prefer guided builders over raw JSON.
- Use progressive disclosure for advanced settings.
- Show validation in operational language.
- Provide preview/dry-run for large configuration changes.

