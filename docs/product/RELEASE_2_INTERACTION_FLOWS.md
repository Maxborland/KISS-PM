# Release 2 Interaction Flows

Updated: 2026-05-17

## 1. Universal Management Loop

Every major Release 2 interaction follows this shape:

```txt
start state
  -> user sees operational projection
  -> system exposes control signal and consequence
  -> user selects recommended governed action
  -> system validates permission and preconditions
  -> risky action shows preview/dry-run
  -> authorized apply executes backend command
  -> UI shows API/domain result and audit evidence
  -> related projections refetch
  -> reload preserves result
```

This loop happens inside report-like surfaces such as schedule, portfolio, resource load, KPI deviation, closed portfolio, and operational readiness screens. A report without an action loop is not Release 2-ready.

## 2. Opportunity To Authorized Project

- Screens: `R2-S0-CRM-INTAKE-CONTROL`, `R2-S0-CAPACITY-FEASIBILITY-CONTROL`, `R2-S1-CONTRACT-AUTHORIZATION-CONTROL`, `R2-S2-PROJECT-STARTUP-CONTROL`.
- Start: opportunity has minimum commercial data.
- Signal: missing intake fields, capacity infeasibility, contract/role blocker.
- Action: run demand estimate, reserve capacity, create project draft, authorize active project.
- Preview: affected stages, role demand, reservations, startup task generation, template version.
- Result: linked draft/active project, startup checklist, generated canonical tasks, audit evidence.
- Permissions: Sales/PM/Resource Manager/Project Principal permissions are distinct; backend denial is required for direct API attempts.
- Reload: opportunity decision, project link, reservation, and startup state persist.

## 3. Startup To Baseline Plan

- Screens: `R2-S2-PROJECT-STARTUP-CONTROL`, `R2-S2-PROJECT-GANTT-PLANNER`, `R2-X-RESOURCE-LOAD-CONTROL`, `R2-X-KPI-DEVIATION-CONTROL`.
- Start: authorized project exists.
- Signal: missing roles, infeasible dates, overloads, missing KPI targets.
- Action: generate stage tasks, adjust plan, assign/reserve resources, approve baseline draft.
- Preview: before/after WBS, dates, dependencies, resource load, baseline snapshot.
- Result: canonical tasks appear in Gantt/My Work/Kanban/resource projections; baseline is auditable.
- Reload: WBS, dependency, baseline, resource, and KPI setup persist.

## 4. Stage Delivery Control

- Screens: `R2-S3-BRIEFING-READINESS-CONTROL`, `R2-S4-CONCEPT-STAGE-CONTROL`, `R2-S5-DEVELOPMENT-ESTIMATE-CONTROL`, `R2-S6-PRODUCTION-DELIVERY-CONTROL`, `R2-S7-PARALLEL-PACKAGE-CONTROL`.
- Start: active project is in a delivery stage.
- Signal: missing input, rejected artifact, overdue task, quality blocker, estimate gap, dependency conflict.
- Action: request data, create follow-up/rework/review task, approve or reject artifact, adjust dependency, escalate.
- Preview: affected gate, affected tasks, timeline/resource impact, approval consequence.
- Result: artifact/gate/task/package state changes through governed command and audit.
- Reload: stage state and related task/Gantt/resource/KPI projections remain consistent.

## 5. Resource Overload Resolution

- Screens: `R2-X-RESOURCE-LOAD-CONTROL`, `R2-S2-PROJECT-GANTT-PLANNER`, `R2-X-PORTFOLIO-CONTROL`.
- Start: overload signal exists in load bucket.
- Signal: severity, affected resource, affected assignment/reservation, period, explanation.
- Action: shift work, split work, reassign work, reserve capacity, accept overload with reason.
- Preview: before/after load buckets, schedule impact, remaining overload, related project effects.
- Result: command execution id, audit event, refreshed load and portfolio signals.
- Denial: read-only and wrong-tenant direct API mutations must fail without leakage.
- Reload: load read model and audit evidence persist.

## 6. KPI Or Portfolio Deviation To Management Action

- Screens: `R2-X-KPI-DEVIATION-CONTROL`, `R2-X-PORTFOLIO-CONTROL`, `R2-X-ACTION-AUDIT-CONTROL`.
- Start: KPI/resource/schedule/lifecycle signal is visible.
- Signal: severity, source condition, affected project/owner, consequence.
- Action: create corrective action, open Gantt, request explanation, escalate, accept risk.
- Preview: target entity, expected effect, owner, due date, risk acceptance consequence.
- Result: action execution/audit, source signal handled state, refreshed portfolio/KPI projection.
- Reload: signal handling and audit links persist.

## 7. Closure To Retrospective Improvement

- Screens: `R2-S8-CLOSURE-CONTROL`, `R2-S8-CLOSED-PORTFOLIO-RETROSPECTIVE`, `R2-X-TENANT-CONFIGURATION-CONTROL`.
- Start: project has delivery complete or closure blockers.
- Signal: missing final approval, final KPI gap, open blocker, retrospective trend.
- Action: create final rework task, capture final KPI, close project, create improvement action, publish future template change.
- Preview: closure snapshot, immutable facts, open risks, future-template impact.
- Result: closed snapshot, retrospective insight, future template version, audit evidence.
- Reload: snapshot stays immutable; future templates change only through versioned config.

## 8. Tenant Configuration To Runtime Effect

- Screens: `R2-X-TENANT-CONFIGURATION-CONTROL` and affected runtime management planes.
- Start: Tenant Admin drafts labels, roles, process templates, fields, KPI rules, saved views, or action availability.
- Signal: validation blocker, incompatible field/action, affected active object count.
- Action: validate draft, preview impact, publish version, import/export config.
- Preview: affected screens/entities, active-history policy, future-template effect, rollback/restore path.
- Result: versioned config, audit evidence, affected surfaces refetch.
- Reload: active configuration and affected runtime labels/fields/actions persist.

## 9. Integration Import To Canonical Operation

- Screens: `R2-X-INTEGRATION-IMPORT-CONTROL`, `R2-S0-CRM-INTAKE-CONTROL`, `R2-S1-CONTRACT-AUTHORIZATION-CONTROL`.
- Start: external payload or adapter connection is available.
- Signal: validation issue, mapping conflict, rate-limit/failure diagnostic.
- Action: run import preview, repair mapping, apply import, retry safe failure.
- Preview: canonical entities to create/update/skip/error, idempotency key, conflicts.
- Result: canonical opportunity/project/task records and ExternalMapping/audit evidence.
- Reload: canonical entities continue through normal KISS PM flow without live adapter dependency.

## 10. Operator Evidence Flow

- Screens: operator/readiness surfaces from the accepted P12 baseline plus Release 2 matrices/verifiers.
- Start: release candidate or verification task exists.
- Signal: matrix gap, failed command, permission/tenant isolation failure, stale evidence.
- Action: run verifier/test, create blocker, re-run failed check.
- Preview: non-mutating command summary where applicable.
- Result: command output, matrix status, blocker or accepted evidence.
- Reload: latest run and evidence link remain available.
