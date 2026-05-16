import { createActionExecutionLog } from "@kiss-pm/action-engine";
import type { ActionExecutionLog } from "@kiss-pm/action-engine";
import type { TenantId, TenantUserId } from "@kiss-pm/domain-core";
import {
  createControlSignalFromEvaluation,
  defineFormula,
  defineKpi,
  defineThresholdRuleSet,
  evaluateFormula,
  evaluateKpi,
  evaluateThreshold,
  upsertControlSignalFromEvaluation
} from "@kiss-pm/kpi-engine";
import type {
  KpiControlSignal,
  KpiDefinition,
  KpiEntityType,
  KpiEvaluation,
  KpiEvaluationCadence,
  KpiEvaluationPeriod,
  KpiFormulaDefinition,
  KpiSourceBindingDefinition,
  KpiSourceValue,
  KpiThresholdRule,
  KpiThresholdRuleSet
} from "@kiss-pm/kpi-engine";

const PHASE7_TIMESTAMP_START = Date.parse("2026-05-16T12:00:00.000Z");
const SEED_PERIOD: KpiEvaluationPeriod = { start: "2026-06-01", end: "2026-06-07" };

export type Phase7RuntimeState = ReturnType<typeof createPhase7RuntimeState>;

export type KpiDefinitionConfigInput = {
  id: string;
  systemKey: string;
  label: string;
  entityType: KpiEntityType;
  ownerRoleKey: string;
  unit: string;
  evaluationCadence: KpiEvaluationCadence;
  formula: {
    id: string;
    expression: string;
    sourceBindings: KpiSourceBindingDefinition[];
  };
  thresholdRuleSet: {
    id: string;
    rules: KpiThresholdRule[];
  };
};

export type KpiDefinitionPreviewInput = KpiDefinitionConfigInput & {
  sampleValues: Record<string, number>;
};

export type KpiEvaluationRunInput = {
  definitionId: string;
  entity: { type: KpiEntityType; id: string };
  period: KpiEvaluationPeriod;
  sourceValues?: KpiSourceValue[];
};

export type KpiDefinitionBundle = {
  definition: KpiDefinition;
  formula: KpiFormulaDefinition;
  thresholdRuleSet: KpiThresholdRuleSet;
};

type Phase7TenantState = {
  definitions: KpiDefinition[];
  formulas: KpiFormulaDefinition[];
  thresholdRuleSets: KpiThresholdRuleSet[];
  sourceValues: KpiSourceValue[];
  evaluations: KpiEvaluation[];
  signals: KpiControlSignal[];
  actionExecutions: ActionExecutionLog[];
  version: number;
};

function clone<T>(value: T): T {
  return structuredClone(value) as T;
}

function notFound(message: string): Error & { code: "not_found" } {
  return Object.assign(new Error(message), { code: "not_found" as const });
}

function conflict(message: string): Error & { code: "conflict" } {
  return Object.assign(new Error(message), { code: "conflict" as const });
}

function preconditionFailed(message: string): Error & { code: "precondition_failed" } {
  return Object.assign(new Error(message), { code: "precondition_failed" as const });
}

function definitionSeed(tenantId: TenantId, suffix: string, active = true): KpiDefinitionBundle {
  const formula = defineFormula({
    id: `formula-schedule-variance-${suffix}-v1`,
    tenantId,
    version: 1,
    expression: "((plannedWorkHours - actualWorkHours) / plannedWorkHours) * 100",
    sourceBindings: [
      {
        key: "plannedWorkHours",
        label: "Плановые часы",
        sourceType: "schedule",
        sourceField: "plannedWorkHours",
        valueType: "number"
      },
      {
        key: "actualWorkHours",
        label: "Фактические часы",
        sourceType: "worklog",
        sourceField: "actualWorkHours",
        valueType: "number"
      }
    ]
  });
  const thresholdRuleSet = defineThresholdRuleSet({
    id: `threshold-schedule-variance-${suffix}-v1`,
    tenantId,
    version: 1,
    rules: [
      {
        id: "schedule-variance-critical",
        severity: "critical",
        condition: { operator: "lte", value: -25 },
        explanation: "Критическое отклонение трудозатрат",
        recommendedActionKeys: ["create_corrective_action", "escalate"]
      },
      {
        id: "schedule-variance-warning",
        severity: "warning",
        condition: { operator: "lte", value: -10 },
        explanation: "Предупреждение по трудозатратам",
        recommendedActionKeys: ["request_explanation"]
      }
    ]
  });
  const definition = defineKpi({
    id: `kpi-schedule-variance-${suffix}`,
    tenantId,
    systemKey: "schedule_variance",
    label: "Отклонение трудозатрат",
    entityType: "project",
    ownerRoleKey: "project_manager",
    unit: "percent",
    version: 1,
    formulaDefinitionId: formula.id,
    thresholdRuleSetId: thresholdRuleSet.id,
    evaluationCadence: "weekly",
    active
  });

  return { definition, formula, thresholdRuleSet };
}

function seedSourceValues(tenantId: TenantId, projectId: string, actualWorkHours = 100): KpiSourceValue[] {
  return [
    {
      tenantId,
      bindingKey: "plannedWorkHours",
      value: 80,
      sourceEntityType: "project",
      sourceEntityId: projectId,
      sourceField: "plannedWorkHours",
      observedAt: "2026-06-08T08:00:00.000Z"
    },
    {
      tenantId,
      bindingKey: "actualWorkHours",
      value: actualWorkHours,
      sourceEntityType: "project",
      sourceEntityId: projectId,
      sourceField: "actualWorkHours",
      observedAt: "2026-06-08T08:00:00.000Z"
    }
  ];
}

function createSeedState(tenantId: TenantId): Phase7TenantState {
  const isTenantB = tenantId === "tenant-b";
  const projectId = isTenantB ? "project-private-b" : "project-alpha-a";
  const warningProjectId = isTenantB ? "project-private-warning-b" : "project-warning-a";
  const suffix = isTenantB ? "private-b" : "a";
  const bundle = definitionSeed(tenantId, suffix);
  const criticalSourceValues = seedSourceValues(tenantId, projectId);
  const warningSourceValues = seedSourceValues(tenantId, warningProjectId, 90);
  const sourceValues = [...criticalSourceValues, ...warningSourceValues];
  const evaluation = evaluateKpi({
    id: isTenantB ? "eval-kpi-private-b-1" : "eval-kpi-schedule-variance-a-1",
    tenantId,
    definition: bundle.definition,
    formula: bundle.formula,
    thresholdRuleSet: bundle.thresholdRuleSet,
    entity: { type: "project", id: projectId },
    period: SEED_PERIOD,
    evaluatedAt: "2026-06-08T09:00:00.000Z",
    sourceValues: criticalSourceValues
  });
  const warningEvaluation = evaluateKpi({
    id: isTenantB ? "eval-kpi-private-b-warning-1" : "eval-kpi-schedule-variance-a-warning-1",
    tenantId,
    definition: bundle.definition,
    formula: bundle.formula,
    thresholdRuleSet: bundle.thresholdRuleSet,
    entity: { type: "project", id: warningProjectId },
    period: SEED_PERIOD,
    evaluatedAt: "2026-06-08T09:02:00.000Z",
    sourceValues: warningSourceValues
  });
  const signal = createControlSignalFromEvaluation({
    id: isTenantB ? "signal-kpi-private-b" : "signal-kpi-schedule-variance-a",
    evaluation,
    createdAt: "2026-06-08T09:01:00.000Z"
  });
  const warningSignal = createControlSignalFromEvaluation({
    id: isTenantB ? "signal-kpi-private-b-warning" : "signal-kpi-schedule-variance-a-warning",
    evaluation: warningEvaluation,
    createdAt: "2026-06-08T09:03:00.000Z"
  });

  return {
    definitions: [bundle.definition],
    formulas: [bundle.formula],
    thresholdRuleSets: [bundle.thresholdRuleSet],
    sourceValues,
    evaluations: [evaluation, warningEvaluation],
    signals: [signal, warningSignal].filter((candidate): candidate is KpiControlSignal => candidate !== null),
    actionExecutions: [],
    version: 1
  };
}

function buildBundleFromInput(tenantId: TenantId, input: KpiDefinitionConfigInput, active: boolean): KpiDefinitionBundle {
  const formula = defineFormula({
    id: input.formula.id,
    tenantId,
    version: 1,
    expression: input.formula.expression,
    sourceBindings: input.formula.sourceBindings
  });
  const thresholdRuleSet = defineThresholdRuleSet({
    id: input.thresholdRuleSet.id,
    tenantId,
    version: 1,
    rules: input.thresholdRuleSet.rules
  });
  const definition = defineKpi({
    id: input.id,
    tenantId,
    systemKey: input.systemKey,
    label: input.label,
    entityType: input.entityType,
    ownerRoleKey: input.ownerRoleKey,
    unit: input.unit,
    version: 1,
    formulaDefinitionId: formula.id,
    thresholdRuleSetId: thresholdRuleSet.id,
    evaluationCadence: input.evaluationCadence,
    active
  });

  return { definition, formula, thresholdRuleSet };
}

function bundleDto(bundle: KpiDefinitionBundle): KpiDefinitionBundle {
  return clone(bundle);
}

export function createPhase7RuntimeState() {
  const states = new Map<string, Phase7TenantState>();
  let timestampCounter = 0;

  function now(): string {
    timestampCounter += 1;
    return new Date(PHASE7_TIMESTAMP_START + timestampCounter * 60_000).toISOString();
  }

  function getState(tenantId: TenantId): Phase7TenantState {
    const existing = states.get(tenantId);
    if (existing !== undefined) return existing;
    const next = createSeedState(tenantId);
    states.set(tenantId, next);
    return next;
  }

  function getBundle(tenantId: TenantId, definitionId: string): KpiDefinitionBundle | undefined {
    const state = getState(tenantId);
    const definition = state.definitions.find((candidate) => candidate.id === definitionId);
    if (!definition) return undefined;
    const formula = state.formulas.find((candidate) => candidate.id === definition.formulaDefinitionId);
    const thresholdRuleSet = state.thresholdRuleSets.find((candidate) => candidate.id === definition.thresholdRuleSetId);
    if (!formula || !thresholdRuleSet) return undefined;

    return bundleDto({ definition, formula, thresholdRuleSet });
  }

  function listDefinitions(tenantId: TenantId): KpiDefinitionBundle[] {
    return getState(tenantId).definitions
      .map((definition) => getBundle(tenantId, definition.id))
      .filter((bundle): bundle is KpiDefinitionBundle => bundle !== undefined);
  }

  function previewDefinition(tenantId: TenantId, input: KpiDefinitionPreviewInput) {
    const bundle = buildBundleFromInput(tenantId, input, true);
    const formulaResult = evaluateFormula(bundle.formula, {
      tenantId,
      values: input.sampleValues
    });
    const thresholdResult = evaluateThreshold(bundle.thresholdRuleSet, {
      tenantId,
      value: formulaResult.value
    });

    return {
      mutatesState: false,
      value: formulaResult.value,
      severity: thresholdResult.severity,
      matchedRuleId: thresholdResult.matchedRuleId,
      formulaTrace: formulaResult.trace,
      thresholdTrace: thresholdResult.trace,
      recommendedActionKeys: thresholdResult.recommendedActionKeys
    };
  }

  function createDefinition(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    accessProfileId?: string;
    config: KpiDefinitionConfigInput;
  }) {
    const tenantId = input.tenantId;
    const config = input.config;
    const state = getState(tenantId);
    if (
      state.definitions.some((definition) => definition.id === config.id) ||
      state.formulas.some((formula) => formula.id === config.formula.id) ||
      state.thresholdRuleSets.some((thresholdRuleSet) => thresholdRuleSet.id === config.thresholdRuleSet.id)
    ) {
      throw conflict("KPI definition, formula, or threshold id already exists");
    }
    const bundle = buildBundleFromInput(tenantId, config, false);
    state.definitions = [...state.definitions, bundle.definition];
    state.formulas = [...state.formulas, bundle.formula];
    state.thresholdRuleSets = [...state.thresholdRuleSets, bundle.thresholdRuleSet];
    state.version += 1;
    const timestamp = now();
    const actionExecution = createActionExecutionLog({
      actor: {
        tenantId,
        actorId: input.actorId,
        ...(input.accessProfileId !== undefined ? { accessProfileId: input.accessProfileId } : {}),
        correlationId: `kpi-definition-create-${bundle.definition.id}-${state.version}`
      },
      commandType: "kpi.definition.create",
      requiredPermission: "kpi.config:write",
      status: "succeeded",
      source: { entityType: "kpiDefinitionConfig", entityId: bundle.definition.id },
      target: { entityType: "kpiDefinition", entityId: bundle.definition.id },
      before: null,
      after: { definition: bundle.definition },
      timestamp,
      trace: ["kpi_config:permission kpi.config:write allowed", "kpi_config:draft created"]
    });
    state.actionExecutions = [...state.actionExecutions, actionExecution];

    return { definition: bundleDto(bundle), actionExecution: clone(actionExecution) };
  }

  function setDefinitionActive(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    accessProfileId?: string;
    definitionId: string;
    expectedVersion: number;
    active: boolean;
    commandType: "kpi.definition.publish" | "kpi.definition.retire";
    reason?: string;
  }) {
    const state = getState(input.tenantId);
    const definition = state.definitions.find((candidate) => candidate.id === input.definitionId);
    if (!definition) throw notFound("KPI definition not found");
    if (definition.version !== input.expectedVersion) {
      throw conflict("KPI definition version conflict");
    }
    const before = getBundle(input.tenantId, input.definitionId);
    state.definitions = state.definitions.map((candidate) =>
      candidate.id === input.definitionId ? { ...candidate, active: input.active } : candidate
    );
    state.version += 1;
    const after = getBundle(input.tenantId, input.definitionId);
    const timestamp = now();
    const actionExecution = createActionExecutionLog({
      actor: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        ...(input.accessProfileId !== undefined ? { accessProfileId: input.accessProfileId } : {}),
        correlationId: `kpi-${input.commandType}-${input.definitionId}-${state.version}`
      },
      commandType: input.commandType,
      requiredPermission: "kpi.config:write",
      status: "succeeded",
      source: { entityType: "kpiDefinition", entityId: input.definitionId },
      target: { entityType: "kpiDefinition", entityId: input.definitionId },
      before: before ? { definition: before.definition } : null,
      after: after ? { definition: after.definition, reason: input.reason } : null,
      timestamp,
      trace: [
        "kpi_config:permission kpi.config:write allowed",
        `kpi_config:${input.active ? "published" : "retired"}`
      ]
    });
    state.actionExecutions = [...state.actionExecutions, actionExecution];

    return { definition: after, actionExecution: clone(actionExecution) };
  }

  function runEvaluation(input: {
    tenantId: TenantId;
    actorId: TenantUserId;
    accessProfileId?: string;
    command: KpiEvaluationRunInput;
  }) {
    const state = getState(input.tenantId);
    const bundle = getBundle(input.tenantId, input.command.definitionId);
    if (!bundle) throw notFound("KPI definition not found");
    if (!bundle.definition.active) throw preconditionFailed("KPI definition is not published");
    const sourceValues =
      input.command.sourceValues ??
      state.sourceValues.filter(
        (sourceValue) =>
          sourceValue.sourceEntityType === input.command.entity.type &&
          sourceValue.sourceEntityId === input.command.entity.id
      );
    if (
      sourceValues.some(
        (sourceValue) =>
          sourceValue.sourceEntityType !== input.command.entity.type ||
          sourceValue.sourceEntityId !== input.command.entity.id
      )
    ) {
      throw preconditionFailed("KPI source values must belong to the evaluated entity");
    }
    const evaluation = evaluateKpi({
      id: `eval-kpi-${bundle.definition.id}-${state.evaluations.length + 1}`,
      tenantId: input.tenantId,
      definition: bundle.definition,
      formula: bundle.formula,
      thresholdRuleSet: bundle.thresholdRuleSet,
      entity: input.command.entity,
      period: input.command.period,
      evaluatedAt: now(),
      sourceValues
    });
    const signal = upsertControlSignalFromEvaluation({
      id: `signal-kpi-${bundle.definition.id}-${state.signals.length + 1}`,
      evaluation,
      existingSignals: state.signals,
      changedAt: now()
    });
    state.evaluations = [...state.evaluations, evaluation];
    if (signal) {
      state.signals = [
        ...state.signals.filter((candidate) => candidate.id !== signal.id),
        signal
      ];
    }
    state.version += 1;
    const actionExecution = createActionExecutionLog({
      actor: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        ...(input.accessProfileId !== undefined ? { accessProfileId: input.accessProfileId } : {}),
        correlationId: `kpi-evaluation-${evaluation.id}`
      },
      commandType: "kpi.evaluation.run",
      requiredPermission: "kpi.evaluate:execute",
      status: "succeeded",
      source: { entityType: "kpiDefinition", entityId: bundle.definition.id },
      target: { entityType: evaluation.entityType, entityId: evaluation.entityId },
      before: null,
      after: { evaluation, signal },
      timestamp: now(),
      trace: [
        "kpi_evaluation:permission kpi.evaluate:execute allowed",
        `kpi_evaluation:definition ${bundle.definition.id}@${bundle.definition.version}`,
        `kpi_evaluation:severity ${evaluation.severity}`
      ]
    });
    state.actionExecutions = [...state.actionExecutions, actionExecution];

    return {
      evaluation: clone(evaluation),
      signal: signal ? clone(signal) : null,
      actionExecution: clone(actionExecution)
    };
  }

  function getEvaluation(tenantId: TenantId, evaluationId: string): KpiEvaluation | undefined {
    const evaluation = getState(tenantId).evaluations.find((candidate) => candidate.id === evaluationId);
    return evaluation ? clone(evaluation) : undefined;
  }

  function listSignals(tenantId: TenantId): KpiControlSignal[] {
    return getState(tenantId).signals.map((signal) => clone(signal));
  }

  function getSignalDetail(tenantId: TenantId, signalId: string) {
    const state = getState(tenantId);
    const signal = state.signals.find((candidate) => candidate.id === signalId);
    if (!signal) return undefined;
    const evaluation = state.evaluations.find((candidate) => candidate.id === signal.sourceEvaluationId);
    if (!evaluation) return undefined;

    return { signal: clone(signal), evaluation: clone(evaluation) };
  }

  function listActionExecutions(tenantId: TenantId): ActionExecutionLog[] {
    return getState(tenantId).actionExecutions.map((entry) => clone(entry));
  }

  return {
    now,
    listDefinitions,
    getBundle,
    previewDefinition,
    createDefinition,
    publishDefinition(input: Omit<Parameters<typeof setDefinitionActive>[0], "active" | "commandType">) {
      return setDefinitionActive({ ...input, active: true, commandType: "kpi.definition.publish" });
    },
    retireDefinition(input: Omit<Parameters<typeof setDefinitionActive>[0], "active" | "commandType">) {
      return setDefinitionActive({ ...input, active: false, commandType: "kpi.definition.retire" });
    },
    runEvaluation,
    getEvaluation,
    listSignals,
    getSignalDetail,
    listActionExecutions
  };
}
