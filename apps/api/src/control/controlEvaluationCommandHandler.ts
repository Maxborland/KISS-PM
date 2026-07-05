import { randomUUID } from "node:crypto";

import {
  canManageControlSignals,
  canReadControlSignals,
  canReadProjectPlan,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import {
  buildResourceLoadMatrix,
  calculatePlan,
  createControlSignalsFromEvaluations,
  createDefaultProjectKpiDefinitions,
  evaluateProjectKpis,
  proposeManagementActions,
  type ControlSignal,
  type KpiDefinition,
  type KpiEvaluation,
  type ManagementActionCandidate,
  type TenantUser
} from "@kiss-pm/domain";

import type { ControlDataPort, TransactionDataPort } from "../apiDataPorts";
import type {
  ManagementAuditDataSource,
  ManagementAuditEventInput
} from "../apiTypes";
import { persistControlSignalNotifications } from "../collaborationNotificationService";
import { PLANNING_ENGINE_VERSION } from "../planning/planningConstants";

type ControlEvaluationDeps = {
  dataSource: ControlDataPort & Partial<TransactionDataPort>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ControlDataPort) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ManagementAuditDataSource
  ): Promise<string>;
};

type ControlEvaluationResult =
  | {
      ok: true;
      evaluations: KpiEvaluation[];
      signals: ControlSignal[];
      actionCandidates: ManagementActionCandidate[];
      auditEventId: string;
    }
  | { ok: false; status: 403 | 404 | 501; error: string };

export async function executeControlEvaluation(input: {
  actor: TenantUser;
  profile: AccessProfile;
  projectId: string;
  deps: ControlEvaluationDeps;
}): Promise<ControlEvaluationResult> {
  if (
    !input.deps.dataSource.getPlanSnapshot ||
    !input.deps.dataSource.listKpiDefinitions ||
    !input.deps.dataSource.upsertKpiDefinition ||
    !input.deps.dataSource.createKpiEvaluation ||
    !input.deps.dataSource.upsertControlSignal ||
    !input.deps.dataSource.appendAuditEvent
  ) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const readPlanDecision = canReadProjectPlan({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!readPlanDecision.allowed) return { ok: false, status: 403, error: readPlanDecision.reason };

  const controlDecision = canReadControlSignals({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!controlDecision.allowed) return { ok: false, status: 403, error: controlDecision.reason };

  const controlManageDecision = canManageControlSignals({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!controlManageDecision.allowed) return { ok: false, status: 403, error: controlManageDecision.reason };

  if (!input.deps.dataSource.withTransaction) {
    return { ok: false, status: 501, error: "persistence_not_configured" };
  }

  const snapshot = await input.deps.dataSource.getPlanSnapshot(input.actor.tenantId, input.projectId);
  if (!snapshot) return { ok: false, status: 404, error: "project_not_found" };

  const now = new Date().toISOString();
  const definitions = await input.deps.runDataSourceTransaction((transactionDataSource) =>
    ensureDefinitionsOrDefaults(input.actor.tenantId, transactionDataSource)
  );
  const calculatedPlan = calculatePlan(snapshot, {
    calculatedAt: now,
    engineVersion: PLANNING_ENGINE_VERSION
  });
  const resourceLoad = buildResourceLoadMatrix({
    plan: calculatedPlan,
    resources: snapshot.resources,
    assignments: snapshot.assignments,
    assignmentAllocations: snapshot.assignmentAllocations,
    calendars: snapshot.calendars,
    calendarExceptions: snapshot.calendarExceptions,
    reservations: snapshot.reservations,
    rangeStart: snapshot.project.plannedStart,
    rangeFinish: calculatedPlan.projectFinish ?? snapshot.project.plannedFinish,
    granularities: ["day"]
  });
  const evaluations = withUniqueEvaluationIds(
    evaluateProjectKpis({ definitions, snapshot, calculatedPlan, resourceLoad, evaluatedAt: now })
  );
  const rawSignals = createControlSignalsFromEvaluations({
    definitions,
    evaluations,
    snapshot,
    now
  });
  const proposals = proposeManagementActions({
    snapshot,
    calculatedPlan,
    resourceLoad,
    signals: rawSignals,
    calculatedAt: now
  });
  const signals = rawSignals.map((signal) => ({
    ...signal,
    scenarioProposals: proposals.filter((proposal) => proposal.targetEntity.id === signal.id)
  }));

  const result = await input.deps.runDataSourceTransaction(async (transactionDataSource) => {
    if (
      !transactionDataSource.createKpiEvaluation ||
      !transactionDataSource.upsertControlSignal ||
      !transactionDataSource.appendAuditEvent
    ) {
      return { ok: false as const, status: 501 as const, error: "persistence_not_configured" };
    }

    const previousSignals =
      (await transactionDataSource.listControlSignals?.(input.actor.tenantId, input.projectId)) ?? [];
    const persistedEvaluations = [];
    for (const evaluation of evaluations) {
      persistedEvaluations.push(await transactionDataSource.createKpiEvaluation(evaluation));
    }
    const persistedSignals = [];
    for (const signal of signals) {
      persistedSignals.push(await transactionDataSource.upsertControlSignal(signal));
    }
    await persistControlSignalNotifications({
      dataSource: transactionDataSource,
      tenantId: input.actor.tenantId,
      actorUserId: input.actor.id,
      snapshot,
      signals: persistedSignals,
      previousSignals
    });
    const auditEventId = await input.deps.appendManagementAuditEvent(
      controlEvaluationAuditInput({
        actor: input.actor,
        projectId: input.projectId,
        planVersion: snapshot.planVersion,
        persistedEvaluations,
        persistedSignals,
        permissionResult: controlManageDecision
      }),
      transactionDataSource
    );
    return { ok: true as const, persistedEvaluations, persistedSignals, auditEventId };
  });
  if (!result.ok) return result;

  return {
    ok: true,
    evaluations: result.persistedEvaluations,
    signals: result.persistedSignals,
    actionCandidates: proposals,
    auditEventId: result.auditEventId
  };
}

async function ensureDefinitionsOrDefaults(
  tenantId: string,
  dataSource: ControlDataPort
): Promise<KpiDefinition[]> {
  const definitions = await dataSource.listKpiDefinitions?.(tenantId);
  if (!definitions || definitions.length > 0) return definitions ?? createDefaultProjectKpiDefinitions(tenantId);
  const defaults = createDefaultProjectKpiDefinitions(tenantId);
  const persisted: KpiDefinition[] = [];
  for (const definition of defaults) {
    const upserted = await dataSource.upsertKpiDefinition?.(definition);
    if (!upserted) throw new Error("kpi_definition_persistence_not_configured");
    persisted.push(upserted);
  }
  return persisted;
}

function withUniqueEvaluationIds<T extends { id: string }>(evaluations: T[]): T[] {
  return evaluations.map((evaluation) => ({ ...evaluation, id: `kpi-eval-${randomUUID()}` }));
}

function controlEvaluationAuditInput(input: {
  actor: TenantUser;
  projectId: string;
  planVersion: number;
  persistedEvaluations: KpiEvaluation[];
  persistedSignals: ControlSignal[];
  permissionResult: PolicyDecision;
}): ManagementAuditEventInput {
  return {
    tenantId: input.actor.tenantId,
    actorUserId: input.actor.id,
    actionType: "kpi.evaluated",
    sourceWorkflow: "control",
    sourceEntity: { type: "Project", id: input.projectId },
    commandInput: { projectId: input.projectId, planVersion: input.planVersion },
    beforeState: null,
    afterState: {
      evaluationIds: input.persistedEvaluations.map((evaluation) => evaluation.id),
      signalIds: input.persistedSignals.map((signal) => signal.id)
    },
    permissionResult: input.permissionResult,
    executionResult: { status: "succeeded" }
  };
}
