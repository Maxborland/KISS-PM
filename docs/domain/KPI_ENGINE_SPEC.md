# KPI Engine Spec

## 1. Purpose

The KPI engine evaluates configurable metrics, stores traceable results, and produces control signals when thresholds are crossed. KPI logic must not live in UI components, route handlers, or tenant-specific code branches.

## 2. Core responsibilities

- Store tenant-configurable KPI definitions.
- Store safe constrained formula definitions.
- Version formulas and thresholds.
- Evaluate KPI values against source data.
- Produce reproducible evaluation traces.
- Create or update control signals/deviations.
- Preserve historical evaluations when definitions change.

## 3. Definition model

```txt
KpiDefinition
- id
- tenantId
- systemKey
- label
- entityType
- ownerRoleKey
- unit
- evaluationPeriod
- formulaDefinitionId
- thresholdRuleSetId
- availableActionKeys[]
- active
- version

FormulaDefinition
- id
- tenantId
- expression
- sourceBindings[]
- safeFunctionSet
- version
- active

ThresholdRule
- id
- thresholdRuleSetId
- severity
- condition
- label
- actionRecommendationKeys[]
- version
```

## 4. Safe formula rules

Formula execution must be constrained. Phase 0 does not select the final expression library, but implementation must prohibit:

- arbitrary JavaScript;
- arbitrary SQL;
- network or filesystem access;
- dynamic imports;
- tenant-provided executable code.

Allowed formula inputs should be named source bindings such as planned dates, actual dates, planned work, actual work, resource capacity, progress, approval age, or opportunity readiness values.

## 5. Evaluation model

```txt
KpiEvaluation
- id
- tenantId
- kpiDefinitionId
- kpiVersion
- formulaVersion
- thresholdVersion
- entityType
- entityId
- periodStart
- periodEnd
- value
- severity
- sourceTrace
- formulaTrace
- thresholdTrace
- evaluatedAt
```

## 6. Control signal creation

A KPI evaluation creates or updates a control signal when a threshold result requires attention or critical action.

```txt
ControlSignal
- id
- tenantId
- sourceType: kpi | resource | schedule | process | crm_intake
- sourceEntityType
- sourceEntityId
- kpiEvaluationId
- severity
- status: open | in_progress | accepted | resolved | superseded
- recommendedActionKeys[]
- createdAt
- resolvedAt
```

## 7. Initial KPI families

- schedule variance;
- planned vs actual work;
- progress vs plan;
- resource utilization;
- capacity feasibility risk;
- overdue approval;
- overdue stage gate;
- intake readiness score;
- project margin/economic rate when financial data exists;
- quality/client satisfaction after closure.

## 8. Versioning rules

- Changing formula or threshold creates a new version.
- Historical `KpiEvaluation` rows keep the version they used.
- Future evaluations use the active version unless a phase document defines backfill behavior.
- Control signals keep traceability to the evaluation that produced them.

## 9. Testing rules

- Formula evaluation is deterministic unit-tested logic.
- Threshold mapping is unit-tested.
- Versioning behavior is integration-tested.
- User-facing KPI deviation workflows are E2E-tested.

