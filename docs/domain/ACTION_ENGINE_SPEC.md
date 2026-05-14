# Action Engine Spec

## 1. Purpose

The action engine governs state-changing management actions from control surfaces, workflows, and command UIs. It protects KISS PM from becoming a set of screens that mutate state inconsistently.

## 2. Core responsibilities

- Define allowed actions as versioned data.
- Validate action inputs.
- Check permissions and scope.
- Check domain preconditions.
- Provide dry-run/preview for risky operations.
- Execute bound application commands.
- Write action execution logs and audit events.
- Return results that allow affected views/control surfaces to refresh.

## 3. Action definition model

```txt
ActionDefinition
- id
- tenantId
- systemKey
- label
- description
- targetEntityType
- requiredPermission
- requiredScope
- inputSchema
- commandBindingKey
- preconditions[]
- dryRunPolicy: none | optional | required
- auditPolicy
- notificationPolicy
- refreshPolicy
- active
- version
```

## 4. Execution flow

```txt
Request action
  -> load ActionDefinition
  -> validate tenant and actor context
  -> validate input schema
  -> evaluate permission and scope
  -> load target state
  -> evaluate preconditions
  -> if dry-run: return preview without mutation
  -> execute command binding
  -> persist state change transactionally where practical
  -> write ActionExecution and AuditEvent
  -> emit domain events / refresh projections
  -> return execution result DTO
```

## 5. Execution model

```txt
ActionExecution
- id
- tenantId
- actionDefinitionId
- actionVersion
- actorId
- sourceType: control_surface | workflow | api_command | system
- sourceRef
- targetEntityType
- targetEntityId
- inputSummary
- preconditionTrace
- permissionTrace
- dryRun
- status: requested | previewed | succeeded | failed | denied
- resultSummary
- beforeStateRef
- afterStateRef
- auditEventIds[]
- createdAt
- completedAt
```

## 6. Required initial action types

- create task;
- create corrective action;
- open project Gantt;
- create project from CRM opportunity;
- reserve capacity;
- reassign participant/resource;
- shift task dates;
- split planned work;
- escalate;
- request explanation;
- accept risk/deviation with reason;
- create approval request;
- change lifecycle stage;
- update KPI target when authorized.

## 7. Dry-run requirements

Dry-run is required when an action may materially affect schedule, resource load, multiple tasks, approvals, KPI targets, or accepted-risk state.

A dry-run result should include:

- target entities affected;
- before/after summary;
- warnings and blockers;
- permission result;
- audit policy summary;
- whether confirmation is allowed.

## 8. Permission and precondition rules

- Permission denial returns a traceable denial result and must not mutate state.
- Preconditions are domain/application rules, not UI hints.
- UI disabled reasons may reuse precondition traces, but backend execution remains authoritative.
- Tenant isolation must be checked before target state is exposed.

## 9. Audit rules

Every meaningful management action writes audit evidence. At minimum:

- actor;
- tenant;
- action key/version;
- source surface/workflow/command;
- target entity;
- input summary;
- outcome;
- timestamp;
- correlation ID.

Accepted risk/deviation must include a mandatory reason and trace to the source control signal.

