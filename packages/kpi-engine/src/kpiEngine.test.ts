import { describe, expect, it } from "vitest";

import {
  KpiEngineError,
  createControlSignalFromEvaluation,
  defineFormula,
  defineKpi,
  defineThresholdRuleSet,
  evaluateFormula,
  evaluateKpi,
  evaluateThreshold,
  upsertControlSignalFromEvaluation,
  previewKpiThresholdRuleSetPublish,
  publishKpiThresholdRuleSetPreview,
} from "./index";

const tenantId = "tenant-alpha";
const formula = defineFormula({
  id: "formula-schedule-variance-v1",
  tenantId,
  version: 1,
  expression: "((plannedWorkHours - actualWorkHours) / plannedWorkHours) * 100",
  sourceBindings: [
    {
      key: "plannedWorkHours",
      label: "Плановые часы",
      sourceType: "schedule",
      sourceField: "plannedWorkHours",
      valueType: "number",
    },
    {
      key: "actualWorkHours",
      label: "Фактические часы",
      sourceType: "worklog",
      sourceField: "actualWorkHours",
      valueType: "number",
    },
  ],
});

const thresholds = defineThresholdRuleSet({
  id: "threshold-schedule-variance-v1",
  tenantId,
  version: 1,
  rules: [
    {
      id: "variance-critical",
      severity: "critical",
      condition: { operator: "lte", value: -25 },
      explanation: "Отклонение превышает 25%",
      recommendedActionKeys: ["create_corrective_action", "escalate"],
    },
    {
      id: "variance-warning",
      severity: "warning",
      condition: { operator: "lte", value: -10 },
      explanation: "Отклонение превышает 10%",
      recommendedActionKeys: ["create_corrective_action"],
    },
    {
      id: "variance-attention",
      severity: "attention",
      condition: { operator: "between", min: -10, max: 0, inclusive: false },
      explanation: "Есть отрицательное отклонение",
      recommendedActionKeys: ["request_explanation"],
    },
  ],
});

const kpi = defineKpi({
  id: "kpi-schedule-variance",
  tenantId,
  systemKey: "schedule_variance",
  label: "Отклонение трудозатрат",
  entityType: "project",
  ownerRoleKey: "project_manager",
  unit: "percent",
  version: 1,
  formulaDefinitionId: formula.id,
  thresholdRuleSetId: thresholds.id,
  evaluationCadence: "weekly",
});

describe("P7 KPI engine domain foundation", () => {
  it("defines tenant-owned versioned KPI, formula, and threshold models", () => {
    expect(kpi).toMatchObject({
      id: "kpi-schedule-variance",
      tenantId,
      systemKey: "schedule_variance",
      formulaDefinitionId: formula.id,
      thresholdRuleSetId: thresholds.id,
      version: 1,
      active: true,
    });
    expect(formula.sourceBindings.map((binding) => binding.key)).toEqual([
      "plannedWorkHours",
      "actualWorkHours",
    ]);
    expect(thresholds.rules.map((rule) => rule.severity)).toEqual([
      "critical",
      "warning",
      "attention",
    ]);
  });

  it("rejects unsafe or ambiguous formula expressions before evaluation", () => {
    expect(() =>
      defineFormula({
        id: "formula-unsafe",
        tenantId,
        version: 1,
        expression: "globalThis.process.exit(1)",
        sourceBindings: formula.sourceBindings,
      }),
    ).toThrow(KpiEngineError);

    expect(() =>
      defineFormula({
        id: "formula-unknown-binding",
        tenantId,
        version: 1,
        expression: "plannedWorkHours - missingHours",
        sourceBindings: [formula.sourceBindings[0]],
      }),
    ).toThrow(/unknown_formula_binding/);
  });

  it("rejects invalid runtime enum values and duplicate threshold rules", () => {
    expect(() =>
      defineKpi({
        id: "kpi-invalid-runtime",
        tenantId,
        systemKey: "invalid_runtime",
        label: "Invalid runtime",
        entityType: "department" as never,
        ownerRoleKey: "project_manager",
        unit: "percent",
        version: 1,
        formulaDefinitionId: formula.id,
        thresholdRuleSetId: thresholds.id,
        evaluationCadence: "weekly",
      }),
    ).toThrow(/invalid_entity_type/);

    expect(() =>
      defineThresholdRuleSet({
        id: "threshold-duplicate-rule",
        tenantId,
        version: 1,
        rules: [
          thresholds.rules[0],
          {
            ...thresholds.rules[1],
            id: thresholds.rules[0].id,
          },
        ],
      }),
    ).toThrow(/duplicate_threshold_rule/);
  });

  it("evaluates constrained arithmetic formulas with deterministic trace", () => {
    const result = evaluateFormula(formula, {
      tenantId,
      values: {
        plannedWorkHours: 80,
        actualWorkHours: 100,
      },
    });

    expect(result.value).toBe(-25);
    expect(result.trace).toEqual([
      "formula:formula-schedule-variance-v1@1",
      "binding:actualWorkHours=100",
      "binding:plannedWorkHours=80",
      "expression:((plannedWorkHours - actualWorkHours) / plannedWorkHours) * 100",
      "result:-25",
    ]);
  });

  it("rejects missing, non-finite, and cross-tenant formula inputs without partial evaluation", () => {
    expect(() =>
      evaluateFormula(formula, {
        tenantId,
        values: { plannedWorkHours: 0, actualWorkHours: 100 },
      }),
    ).toThrow(/formula_non_finite_result/);

    expect(() =>
      evaluateFormula(formula, {
        tenantId: "tenant-beta",
        values: { plannedWorkHours: 80, actualWorkHours: 100 },
      }),
    ).toThrow(/tenant_mismatch/);

    expect(() =>
      evaluateFormula(formula, {
        tenantId,
        values: { plannedWorkHours: 80 },
      }),
    ).toThrow(/missing_source_value/);
  });

  it("maps KPI values to the strongest matching threshold severity", () => {
    expect(evaluateThreshold(thresholds, { tenantId, value: -25 })).toMatchObject({
      severity: "critical",
      matchedRuleId: "variance-critical",
      recommendedActionKeys: ["create_corrective_action", "escalate"],
    });
    expect(evaluateThreshold(thresholds, { tenantId, value: -12 })).toMatchObject({
      severity: "warning",
      matchedRuleId: "variance-warning",
    });
    expect(evaluateThreshold(thresholds, { tenantId, value: 5 })).toMatchObject({
      severity: "none",
      matchedRuleId: null,
    });
  });

  it("evaluates KPI from canonical source values with source, formula, and threshold trace", () => {
    const evaluation = evaluateKpi({
      id: "eval-schedule-variance-001",
      tenantId,
      definition: kpi,
      formula,
      thresholdRuleSet: thresholds,
      entity: { type: "project", id: "project-alpha" },
      period: { start: "2026-05-01", end: "2026-05-07" },
      evaluatedAt: "2026-05-08T09:00:00.000Z",
      sourceValues: [
        {
          tenantId,
          bindingKey: "plannedWorkHours",
          value: 80,
          sourceEntityType: "project",
          sourceEntityId: "project-alpha",
          sourceField: "plannedWorkHours",
          observedAt: "2026-05-08T08:00:00.000Z",
        },
        {
          tenantId,
          bindingKey: "actualWorkHours",
          value: 100,
          sourceEntityType: "project",
          sourceEntityId: "project-alpha",
          sourceField: "actualWorkHours",
          observedAt: "2026-05-08T08:00:00.000Z",
        },
      ],
    });

    expect(evaluation).toMatchObject({
      id: "eval-schedule-variance-001",
      tenantId,
      kpiDefinitionId: kpi.id,
      kpiDefinitionVersion: 1,
      entityType: "project",
      entityId: "project-alpha",
      value: -25,
      severity: "critical",
      matchedThresholdRuleId: "variance-critical",
      recommendedActionKeys: ["create_corrective_action", "escalate"],
    });
    expect(evaluation.sourceTrace).toHaveLength(2);
    expect(evaluation.formulaTrace).toContain("result:-25");
    expect(evaluation.thresholdTrace).toContain(
      "matched:variance-critical:critical",
    );
  });

  it("rejects KPI evaluation when definition, formula, thresholds, or sources cross tenants", () => {
    expect(() =>
      evaluateKpi({
        id: "eval-inactive-kpi",
        tenantId,
        definition: { ...kpi, active: false },
        formula,
        thresholdRuleSet: thresholds,
        entity: { type: "project", id: "project-alpha" },
        period: { start: "2026-05-01", end: "2026-05-07" },
        evaluatedAt: "2026-05-08T09:00:00.000Z",
        sourceValues: [],
      }),
    ).toThrow(/kpi_inactive/);

    expect(() =>
      evaluateKpi({
        id: "eval-cross-tenant",
        tenantId,
        definition: kpi,
        formula: { ...formula, tenantId: "tenant-beta" },
        thresholdRuleSet: thresholds,
        entity: { type: "project", id: "project-alpha" },
        period: { start: "2026-05-01", end: "2026-05-07" },
        evaluatedAt: "2026-05-08T09:00:00.000Z",
        sourceValues: [],
      }),
    ).toThrow(/tenant_mismatch/);
  });

  it("rejects invalid evaluation periods and malformed source trace fields", () => {
    const validSourceValues = [
      {
        tenantId,
        bindingKey: "plannedWorkHours",
        value: 80,
        sourceEntityType: "project" as const,
        sourceEntityId: "project-alpha",
        sourceField: "plannedWorkHours",
        observedAt: "2026-05-08T08:00:00.000Z",
      },
      {
        tenantId,
        bindingKey: "actualWorkHours",
        value: 100,
        sourceEntityType: "project" as const,
        sourceEntityId: "project-alpha",
        sourceField: "actualWorkHours",
        observedAt: "2026-05-08T08:00:00.000Z",
      },
    ];

    expect(() =>
      evaluateKpi({
        id: "eval-invalid-period",
        tenantId,
        definition: kpi,
        formula,
        thresholdRuleSet: thresholds,
        entity: { type: "project", id: "project-alpha" },
        period: { start: "2026-99-01", end: "2026-05-07" },
        evaluatedAt: "2026-05-08T09:00:00.000Z",
        sourceValues: validSourceValues,
      }),
    ).toThrow(/invalid_iso_date/);

    expect(() =>
      evaluateKpi({
        id: "eval-invalid-source",
        tenantId,
        definition: kpi,
        formula,
        thresholdRuleSet: thresholds,
        entity: { type: "project", id: "project-alpha" },
        period: { start: "2026-05-01", end: "2026-05-07" },
        evaluatedAt: "2026-05-08T09:00:00.000Z",
        sourceValues: [
          validSourceValues[0],
          {
            ...validSourceValues[1],
            sourceEntityId: "",
            observedAt: "not-a-date",
          },
        ],
      }),
    ).toThrow(/source_entity_id/);

    expect(() =>
      evaluateKpi({
        id: "eval-date-only-timestamp",
        tenantId,
        definition: kpi,
        formula,
        thresholdRuleSet: thresholds,
        entity: { type: "project", id: "project-alpha" },
        period: { start: "2026-05-01", end: "2026-05-07" },
        evaluatedAt: "2026-05-08",
        sourceValues: validSourceValues,
      }),
    ).toThrow(/invalid_iso_datetime/);
  });

  it("creates traceable KPI control signals without executing P8 actions", () => {
    const evaluation = evaluateKpi({
      id: "eval-signal-001",
      tenantId,
      definition: kpi,
      formula,
      thresholdRuleSet: thresholds,
      entity: { type: "project", id: "project-alpha" },
      period: { start: "2026-05-01", end: "2026-05-07" },
      evaluatedAt: "2026-05-08T09:00:00.000Z",
      sourceValues: [
        {
          tenantId,
          bindingKey: "plannedWorkHours",
          value: 80,
          sourceEntityType: "project",
          sourceEntityId: "project-alpha",
          sourceField: "plannedWorkHours",
          observedAt: "2026-05-08T08:00:00.000Z",
        },
        {
          tenantId,
          bindingKey: "actualWorkHours",
          value: 100,
          sourceEntityType: "project",
          sourceEntityId: "project-alpha",
          sourceField: "actualWorkHours",
          observedAt: "2026-05-08T08:00:00.000Z",
        },
      ],
    });

    const signal = createControlSignalFromEvaluation({
      id: "signal-kpi-001",
      evaluation,
      createdAt: "2026-05-08T09:01:00.000Z",
    });

    expect(signal).toMatchObject({
      id: "signal-kpi-001",
      tenantId,
      sourceType: "kpi_evaluation",
      sourceEvaluationId: "eval-signal-001",
      entityType: "project",
      entityId: "project-alpha",
      severity: "critical",
      status: "open",
      recommendedActionKeys: ["create_corrective_action", "escalate"],
    });
    expect(signal?.actionExecutionState).toBe("not_executed");
  });

  it("deduplicates open KPI signals for the same definition, entity, and period", () => {
    const baseEvaluation = evaluateKpi({
      id: "eval-signal-002",
      tenantId,
      definition: kpi,
      formula,
      thresholdRuleSet: thresholds,
      entity: { type: "project", id: "project-alpha" },
      period: { start: "2026-05-01", end: "2026-05-07" },
      evaluatedAt: "2026-05-08T09:00:00.000Z",
      sourceValues: [
        {
          tenantId,
          bindingKey: "plannedWorkHours",
          value: 80,
          sourceEntityType: "project",
          sourceEntityId: "project-alpha",
          sourceField: "plannedWorkHours",
          observedAt: "2026-05-08T08:00:00.000Z",
        },
        {
          tenantId,
          bindingKey: "actualWorkHours",
          value: 92,
          sourceEntityType: "project",
          sourceEntityId: "project-alpha",
          sourceField: "actualWorkHours",
          observedAt: "2026-05-08T08:00:00.000Z",
        },
      ],
    });

    const updatedEvaluation = evaluateKpi({
      id: "eval-signal-003",
      tenantId,
      definition: kpi,
      formula,
      thresholdRuleSet: thresholds,
      entity: { type: "project", id: "project-alpha" },
      period: { start: "2026-05-01", end: "2026-05-07" },
      evaluatedAt: "2026-05-08T09:05:00.000Z",
      sourceValues: [
        {
          tenantId,
          bindingKey: "plannedWorkHours",
          value: 80,
          sourceEntityType: "project",
          sourceEntityId: "project-alpha",
          sourceField: "plannedWorkHours",
          observedAt: "2026-05-08T08:30:00.000Z",
        },
        {
          tenantId,
          bindingKey: "actualWorkHours",
          value: 100,
          sourceEntityType: "project",
          sourceEntityId: "project-alpha",
          sourceField: "actualWorkHours",
          observedAt: "2026-05-08T08:30:00.000Z",
        },
      ],
    });

    const first = createControlSignalFromEvaluation({
      id: "signal-kpi-002",
      evaluation: baseEvaluation,
      createdAt: "2026-05-08T09:01:00.000Z",
    });
    const upserted = upsertControlSignalFromEvaluation({
      id: "signal-kpi-003",
      evaluation: updatedEvaluation,
      existingSignals: first ? [first] : [],
      changedAt: "2026-05-08T09:05:00.000Z",
    });

    expect(upserted).toMatchObject({
      id: "signal-kpi-002",
      sourceEvaluationId: "eval-signal-003",
      severity: "critical",
      status: "open",
      updatedAt: "2026-05-08T09:05:00.000Z",
    });
  });

  it("previews and publishes a future threshold version without mutating historical evaluations", () => {
    const historicalEvaluation = evaluateKpi({
      id: "eval-threshold-history-001",
      tenantId,
      definition: kpi,
      formula,
      thresholdRuleSet: thresholds,
      entity: { type: "project", id: "project-alpha" },
      period: { start: "2026-05-01", end: "2026-05-07" },
      evaluatedAt: "2026-05-08T09:00:00.000Z",
      sourceValues: [
        {
          tenantId,
          bindingKey: "plannedWorkHours",
          value: 80,
          sourceEntityType: "project",
          sourceEntityId: "project-alpha",
          sourceField: "plannedWorkHours",
          observedAt: "2026-05-08T08:00:00.000Z",
        },
        {
          tenantId,
          bindingKey: "actualWorkHours",
          value: 100,
          sourceEntityType: "project",
          sourceEntityId: "project-alpha",
          sourceField: "actualWorkHours",
          observedAt: "2026-05-08T08:00:00.000Z",
        },
      ],
    });

    const preview = previewKpiThresholdRuleSetPublish(thresholds, {
      id: "preview-thresholds-001",
      actorId: "tenant-admin-a",
      expectedVersion: 1,
      rules: [
        {
          id: "variance-critical",
          severity: "critical",
          condition: { operator: "lte", value: -30 },
          explanation: "Отклонение превышает 30%",
          recommendedActionKeys: ["create_corrective_action", "escalate"],
        },
        {
          id: "variance-warning",
          severity: "warning",
          condition: { operator: "lte", value: -10 },
          explanation: "Отклонение превышает 10%",
          recommendedActionKeys: ["create_corrective_action"],
        },
      ],
      sampleValue: -25,
      affectedRuntimeSurfaces: ["kpi.deviation.control"],
      createdAt: "2026-08-01T00:01:00.000Z",
    });

    expect(preview).toMatchObject({
      mutatesState: false,
      before: { version: 1, severity: "critical", matchedRuleId: "variance-critical" },
      after: { version: 2, severity: "warning", matchedRuleId: "variance-warning" },
      thresholdRuleSet: { id: thresholds.id, version: 2 },
    });
    expect(thresholds.version).toBe(1);
    expect(evaluateThreshold(thresholds, { tenantId, value: -25 }).severity).toBe("critical");

    const result = publishKpiThresholdRuleSetPreview(thresholds, {
      preview,
      expectedVersion: 1,
      auditEventId: "audit-kpi-thresholds-001",
      publishedAt: "2026-08-01T00:02:00.000Z",
    });

    expect(result.audit).toMatchObject({
      commandType: "kpi_threshold.publish",
      beforeVersion: 1,
      afterVersion: 2,
      auditEventId: "audit-kpi-thresholds-001",
    });
    expect(result.thresholdRuleSet.version).toBe(2);

    const futureEvaluation = evaluateKpi({
      id: "eval-threshold-future-001",
      tenantId,
      definition: { ...kpi, thresholdRuleSetId: result.thresholdRuleSet.id },
      formula,
      thresholdRuleSet: result.thresholdRuleSet,
      entity: { type: "project", id: "project-alpha" },
      period: { start: "2026-05-08", end: "2026-05-14" },
      evaluatedAt: "2026-05-15T09:00:00.000Z",
      sourceValues: historicalEvaluation.sourceTrace,
    });

    expect(futureEvaluation).toMatchObject({
      severity: "warning",
      thresholdRuleSetVersion: 2,
      matchedThresholdRuleId: "variance-warning",
    });
    expect(historicalEvaluation).toMatchObject({
      severity: "critical",
      thresholdRuleSetVersion: 1,
      matchedThresholdRuleId: "variance-critical",
    });
  });

  it("rejects stale or invalid threshold publish previews without partial mutation", () => {
    expect(() =>
      previewKpiThresholdRuleSetPublish(thresholds, {
        id: "preview-thresholds-invalid",
        actorId: "tenant-admin-a",
        expectedVersion: 1,
        rules: [
          {
            id: "bad-range",
            severity: "warning",
            condition: { operator: "between", min: 10, max: -10 },
            explanation: "Неверный диапазон",
            recommendedActionKeys: ["request_explanation"],
          },
        ],
        sampleValue: -25,
        affectedRuntimeSurfaces: ["kpi.deviation.control"],
        createdAt: "2026-08-01T00:01:00.000Z",
      }),
    ).toThrow(/threshold_invalid_range/);

    const preview = previewKpiThresholdRuleSetPublish(thresholds, {
      id: "preview-thresholds-stale",
      actorId: "tenant-admin-a",
      expectedVersion: 1,
      rules: [
        {
          id: "variance-warning",
          severity: "warning",
          condition: { operator: "lte", value: -20 },
          explanation: "Отклонение превышает 20%",
          recommendedActionKeys: ["request_explanation"],
        },
      ],
      sampleValue: -25,
      affectedRuntimeSurfaces: ["kpi.deviation.control"],
      createdAt: "2026-08-01T00:01:00.000Z",
    });

    expect(() =>
      publishKpiThresholdRuleSetPreview({ ...thresholds, version: 2 }, {
        preview,
        expectedVersion: 2,
        auditEventId: "audit-kpi-thresholds-stale",
        publishedAt: "2026-08-01T00:02:00.000Z",
      }),
    ).toThrow(/stale/);
  });
});
