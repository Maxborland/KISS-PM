import { and, asc, desc, eq, inArray, or } from "drizzle-orm";

import type {
  ControlSignal,
  CorrectiveAction,
  KpiDefinition,
  KpiEvaluation,
  ManagementActionCandidate
} from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import {
  actionExecutions,
  controlSignals,
  correctiveActions,
  kpiDefinitions,
  kpiEvaluations
} from "./schema";

export type ActionExecutionStatus = "previewed" | "succeeded" | "failed" | "denied";

export type ActionExecutionRecord = {
  id: string;
  tenantId: string;
  projectId: string;
  actionType: string;
  targetEntity: { type: string; id: string };
  actorUserId: string;
  input: Record<string, unknown>;
  previewPayload: Record<string, unknown> | null;
  resultPayload: Record<string, unknown> | null;
  status: ActionExecutionStatus;
  auditEventId: string | null;
  createdAt: Date;
};

export type ActionExecutionInput = Omit<ActionExecutionRecord, "createdAt"> & {
  createdAt?: Date;
};

export type ControlRepository = {
  listKpiDefinitions(tenantId: string): Promise<KpiDefinition[]>;
  upsertKpiDefinition(input: KpiDefinition): Promise<KpiDefinition>;
  createKpiEvaluation(input: KpiEvaluation): Promise<KpiEvaluation>;
  listKpiEvaluations(tenantId: string, projectId: string): Promise<KpiEvaluation[]>;
  upsertControlSignal(input: ControlSignal): Promise<ControlSignal>;
  listControlSignalsForProjects(tenantId: string, projectIds: string[]): Promise<ControlSignal[]>;
  listControlSignals(tenantId: string, projectId: string): Promise<ControlSignal[]>;
  createCorrectiveAction(input: CorrectiveAction): Promise<CorrectiveAction>;
  updateCorrectiveAction(input: CorrectiveAction): Promise<CorrectiveAction>;
  listCorrectiveActionsForProjects(tenantId: string, projectIds: string[]): Promise<CorrectiveAction[]>;
  listCorrectiveActions(tenantId: string, projectId: string): Promise<CorrectiveAction[]>;
  createActionExecution(input: ActionExecutionInput): Promise<ActionExecutionRecord>;
  listActionExecutions(tenantId: string, projectId: string): Promise<ActionExecutionRecord[]>;
};

export function createControlRepository(db: KissPmDatabase): ControlRepository {
  return {
    async listKpiDefinitions(tenantId) {
      const rows = await db
        .select()
        .from(kpiDefinitions)
        .where(eq(kpiDefinitions.tenantId, tenantId))
        .orderBy(asc(kpiDefinitions.code));
      return rows.map(mapKpiDefinition);
    },
    async upsertKpiDefinition(input) {
      const now = new Date();
      const matchingRows = await db
        .select()
        .from(kpiDefinitions)
        .where(
          and(
            eq(kpiDefinitions.tenantId, input.tenantId),
            or(eq(kpiDefinitions.id, input.id), eq(kpiDefinitions.code, input.code))
          )
        )
        .limit(2);
      if (matchingRows.length > 1) {
        throw new Error("KPI definition id and code match different rows");
      }
      const normalizedInput = matchingRows[0] ? { ...input, id: matchingRows[0].id } : input;
      const [row] = await db
        .insert(kpiDefinitions)
        .values({ ...toKpiDefinitionRow(normalizedInput), createdAt: now, updatedAt: now })
        .onConflictDoUpdate({
          target: [kpiDefinitions.tenantId, kpiDefinitions.id],
          set: {
            entityType: normalizedInput.entityType,
            code: normalizedInput.code,
            label: normalizedInput.label,
            formula: normalizedInput.formula,
            unit: normalizedInput.unit,
            period: normalizedInput.period,
            thresholdRules: normalizedInput.thresholdRules,
            ownerRole: normalizedInput.ownerRole,
            allowedActions: normalizedInput.allowedActions,
            version: normalizedInput.version,
            status: normalizedInput.status,
            updatedAt: now
          }
        })
        .returning();
      if (!row) throw new Error("KPI definition upsert returned no row");
      return mapKpiDefinition(row);
    },
    async createKpiEvaluation(input) {
      const [row] = await db
        .insert(kpiEvaluations)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          projectId: input.projectId,
          definitionId: input.definitionId,
          definitionVersion: input.definitionVersion,
          formulaVersion: input.formulaVersion,
          sourceData: input.sourceData,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          threshold: input.threshold,
          calculatedValue: input.calculatedValue,
          severity: input.severity,
          evaluatedAt: new Date(input.evaluatedAt)
        })
        .returning();
      if (!row) throw new Error("KPI evaluation insert returned no row");
      return mapKpiEvaluation(row);
    },
    async listKpiEvaluations(tenantId, projectId) {
      const rows = await db
        .select()
        .from(kpiEvaluations)
        .where(and(eq(kpiEvaluations.tenantId, tenantId), eq(kpiEvaluations.projectId, projectId)))
        .orderBy(desc(kpiEvaluations.evaluatedAt), asc(kpiEvaluations.definitionId));
      return rows.map(mapKpiEvaluation);
    },
    async upsertControlSignal(input) {
      const createdAt = new Date(input.createdAt);
      const updatedAt = new Date(input.updatedAt);
      const [row] = await db
        .insert(controlSignals)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          projectId: input.projectId,
          evaluationId: input.evaluationId,
          sourceEntity: input.sourceEntity,
          sourceMetric: input.sourceMetric,
          severity: input.severity,
          explanation: input.explanation,
          ownerUserId: input.ownerUserId,
          allowedActions: input.allowedActions,
          scenarioProposals: input.scenarioProposals,
          status: input.status,
          createdAt,
          updatedAt,
          resolvedAt: input.status === "resolved" ? updatedAt : null
        })
        .onConflictDoUpdate({
          target: [controlSignals.tenantId, controlSignals.projectId, controlSignals.id],
          set: {
            evaluationId: input.evaluationId,
            severity: input.severity,
            explanation: input.explanation,
            ownerUserId: input.ownerUserId,
            allowedActions: input.allowedActions,
            scenarioProposals: input.scenarioProposals,
            status: input.status,
            updatedAt,
            resolvedAt: input.status === "resolved" ? updatedAt : null
          }
        })
        .returning();
      if (!row) throw new Error("Control signal upsert returned no row");
      return mapControlSignal(row);
    },
    async listControlSignalsForProjects(tenantId, projectIds) {
      if (projectIds.length === 0) return [];
      const rows = await db
        .select()
        .from(controlSignals)
        .where(and(eq(controlSignals.tenantId, tenantId), inArray(controlSignals.projectId, projectIds)))
        .orderBy(desc(controlSignals.createdAt), asc(controlSignals.id));
      return rows.map(mapControlSignal);
    },
    async listControlSignals(tenantId, projectId) {
      const rows = await db
        .select()
        .from(controlSignals)
        .where(and(eq(controlSignals.tenantId, tenantId), eq(controlSignals.projectId, projectId)))
        .orderBy(desc(controlSignals.createdAt), asc(controlSignals.id));
      return rows.map(mapControlSignal);
    },
    async createCorrectiveAction(input) {
      const now = new Date();
      const [row] = await db
        .insert(correctiveActions)
        .values({ ...toCorrectiveActionRow(input), createdAt: now, updatedAt: now })
        .returning();
      if (!row) throw new Error("Corrective action insert returned no row");
      return mapCorrectiveAction(row);
    },
    async updateCorrectiveAction(input) {
      const [row] = await db
        .update(correctiveActions)
        .set({
          title: input.title,
          description: input.description,
          responsibleUserId: input.responsibleUserId,
          dueDate: input.dueDate,
          status: input.status,
          result: input.result,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(correctiveActions.tenantId, input.tenantId),
            eq(correctiveActions.projectId, input.projectId),
            eq(correctiveActions.id, input.id)
          )
        )
        .returning();
      if (!row) throw new Error("Corrective action update returned no row");
      return mapCorrectiveAction(row);
    },
    async listCorrectiveActionsForProjects(tenantId, projectIds) {
      if (projectIds.length === 0) return [];
      const rows = await db
        .select()
        .from(correctiveActions)
        .where(and(eq(correctiveActions.tenantId, tenantId), inArray(correctiveActions.projectId, projectIds)))
        .orderBy(desc(correctiveActions.createdAt), asc(correctiveActions.id));
      return rows.map(mapCorrectiveAction);
    },
    async listCorrectiveActions(tenantId, projectId) {
      const rows = await db
        .select()
        .from(correctiveActions)
        .where(and(eq(correctiveActions.tenantId, tenantId), eq(correctiveActions.projectId, projectId)))
        .orderBy(desc(correctiveActions.createdAt), asc(correctiveActions.id));
      return rows.map(mapCorrectiveAction);
    },
    async createActionExecution(input) {
      const [row] = await db
        .insert(actionExecutions)
        .values({ ...input, createdAt: input.createdAt ?? new Date() })
        .returning();
      if (!row) throw new Error("Action execution insert returned no row");
      return mapActionExecution(row);
    },
    async listActionExecutions(tenantId, projectId) {
      const rows = await db
        .select()
        .from(actionExecutions)
        .where(and(eq(actionExecutions.tenantId, tenantId), eq(actionExecutions.projectId, projectId)))
        .orderBy(desc(actionExecutions.createdAt), asc(actionExecutions.id));
      return rows.map(mapActionExecution);
    }
  };
}

function toKpiDefinitionRow(input: KpiDefinition): typeof kpiDefinitions.$inferInsert {
  return {
    id: input.id,
    tenantId: input.tenantId,
    entityType: input.entityType,
    code: input.code,
    label: input.label,
    formula: input.formula,
    unit: input.unit,
    period: input.period,
    thresholdRules: input.thresholdRules,
    ownerRole: input.ownerRole,
    allowedActions: input.allowedActions,
    version: input.version,
    status: input.status,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function mapKpiDefinition(row: typeof kpiDefinitions.$inferSelect): KpiDefinition {
  return {
    id: row.id,
    tenantId: row.tenantId,
    entityType: row.entityType as KpiDefinition["entityType"],
    code: row.code,
    label: row.label,
    formula: row.formula as KpiDefinition["formula"],
    unit: row.unit as KpiDefinition["unit"],
    period: row.period as KpiDefinition["period"],
    thresholdRules: row.thresholdRules as KpiDefinition["thresholdRules"],
    ownerRole: row.ownerRole,
    allowedActions: row.allowedActions as KpiDefinition["allowedActions"],
    version: row.version,
    status: row.status as KpiDefinition["status"]
  };
}

function mapKpiEvaluation(row: typeof kpiEvaluations.$inferSelect): KpiEvaluation {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    definitionId: row.definitionId,
    definitionVersion: row.definitionVersion,
    formulaVersion: row.formulaVersion,
    sourceData: row.sourceData,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    threshold: row.threshold as KpiEvaluation["threshold"],
    calculatedValue: row.calculatedValue,
    severity: row.severity as KpiEvaluation["severity"],
    evaluatedAt: row.evaluatedAt.toISOString()
  };
}

function mapControlSignal(row: typeof controlSignals.$inferSelect): ControlSignal {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    sourceEntity: row.sourceEntity,
    sourceMetric: row.sourceMetric,
    evaluationId: row.evaluationId,
    severity: row.severity as ControlSignal["severity"],
    explanation: row.explanation,
    ownerUserId: row.ownerUserId,
    allowedActions: row.allowedActions as ControlSignal["allowedActions"],
    scenarioProposals: row.scenarioProposals as ManagementActionCandidate[],
    status: row.status as ControlSignal["status"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function toCorrectiveActionRow(input: CorrectiveAction): typeof correctiveActions.$inferInsert {
  return {
    id: input.id,
    tenantId: input.tenantId,
    projectId: input.projectId,
    controlSignalId: input.controlSignalId,
    title: input.title,
    description: input.description,
    responsibleUserId: input.responsibleUserId,
    dueDate: input.dueDate,
    status: input.status,
    result: input.result,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function mapCorrectiveAction(row: typeof correctiveActions.$inferSelect): CorrectiveAction {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    controlSignalId: row.controlSignalId,
    title: row.title,
    description: row.description,
    responsibleUserId: row.responsibleUserId,
    dueDate: row.dueDate,
    status: row.status as CorrectiveAction["status"],
    result: row.result
  };
}

function mapActionExecution(row: typeof actionExecutions.$inferSelect): ActionExecutionRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    actionType: row.actionType,
    targetEntity: row.targetEntity,
    actorUserId: row.actorUserId,
    input: row.input,
    previewPayload: row.previewPayload,
    resultPayload: row.resultPayload,
    status: row.status as ActionExecutionStatus,
    auditEventId: row.auditEventId,
    createdAt: row.createdAt
  };
}
