# Access Control Spec

## 1. Purpose

Access control protects tenant data and governs who can view or change operational state. UI visibility is not sufficient. Permissions must be enforced in API/application/action layers.

## 2. Core responsibilities

- Define access profiles and permissions.
- Evaluate boolean permissions and scoped permissions.
- Return traceable allow/deny decisions.
- Support tenant configuration without hardcoded company roles.
- Protect API routes, application services, and action execution.

## 3. Permission model

```txt
AccessProfile
- id
- tenantId
- systemKey
- label
- permissions[]
- scopeRules[]
- active
- version

Permission
- key
- description
- category

ScopeRule
- permissionKey
- scope: own | team | department | project | tenant | all
- constraints
```

## 4. Evaluation input

```txt
PolicyRequest
- tenantId
- actorId
- permissionKey
- targetEntityType
- targetEntityId
- targetTenantId
- contextRefs
```

## 5. Evaluation output

```txt
PolicyEvaluation
- allowed
- reasonCode
- scope
- trace[]
```

Traces are required for tests and admin diagnostics. They should be safe to expose to authorized admins and must not leak sensitive cross-tenant data.

## 6. Initial permission categories

- tenant administration;
- access profile administration;
- CRM intake read/write/action;
- project read/write/action;
- task read/write/action;
- Gantt/schedule read/write/action;
- resource planning read/write/action;
- KPI definition read/write;
- KPI deviation action;
- control surface read/action;
- action/audit read;
- retrospective read/action;
- integration administration.

## 7. Invariants

- Tenant mismatch denies access before entity details are exposed.
- Read permission does not imply mutation permission.
- Control-surface action execution checks permission even when UI button is hidden or disabled.
- Permission evaluation is deterministic and covered by tests.
- Tenant-specific role labels do not become permission logic.

