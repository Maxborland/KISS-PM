import { and, desc, eq, inArray, notInArray } from "drizzle-orm";

import type { TenantId } from "@kiss-pm/domain";

import type { KissPmDatabase } from "./connection";
import {
  opportunities,
  opportunityDemands,
  projectPositionDemands,
  projects
} from "./schema";

export type OpportunityStatus =
  | "new"
  | "intake"
  | "feasibility"
  | "ready_to_activate"
  | "won_closed"
  | "lost_rejected";

export type OpportunityFinalStatus = "won_closed" | "lost_rejected";
const finalOpportunityStatuses: string[] = ["won_closed", "lost_rejected"];

export type ProjectStatus = "draft" | "active" | "paused" | "closed" | "cancelled";
export type ProjectSourceType = "opportunity" | "workspace_inbox" | "manual";

export type PositionDemandRecord = {
  positionId: string;
  requiredHours: number;
};

export type OpportunityRecord = {
  id: string;
  tenantId: TenantId;
  clientId: string | null;
  primaryContactId: string | null;
  ownerUserId: string | null;
  projectTypeId: string | null;
  stageId: string | null;
  crmPipelineId: string | null;
  crmPipelineStageId: string | null;
  crmPipelineStateUpdatedAt: Date | null;
  clientName: string;
  contactName: string;
  title: string;
  projectType: string;
  description: string | null;
  plannedStart: Date;
  plannedFinish: Date;
  contractValue: number;
  plannedHourlyRate: number;
  plannedHours: number;
  probability: number;
  status: OpportunityStatus;
  templateId: string | null;
  feasibilityStatus: string | null;
  feasibilityResult: Record<string, unknown> | null;
  feasibilityCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  demand: PositionDemandRecord[];
  customFieldValues: Record<string, string>;
};

export type OpportunityInput = Omit<
  OpportunityRecord,
  | "createdAt"
  | "updatedAt"
  | "feasibilityStatus"
  | "feasibilityResult"
  | "feasibilityCheckedAt"
  | "ownerUserId"
  | "customFieldValues"
  | "crmPipelineStateUpdatedAt"
  | "crmPipelineId"
  | "crmPipelineStageId"
> & {
  ownerUserId?: string | null;
  crmPipelineId?: string | null;
  crmPipelineStageId?: string | null;
  customFieldValues?: Record<string, string>;
};

export type OpportunityFeasibilityUpdate = {
  tenantId: TenantId;
  opportunityId: string;
  status: OpportunityStatus;
  feasibilityStatus: string;
  feasibilityResult: Record<string, unknown>;
};

export type ProjectRecord = {
  id: string;
  tenantId: TenantId;
  sourceType: ProjectSourceType;
  sourceOpportunityId: string | null;
  clientId: string | null;
  projectTypeId: string | null;
  title: string;
  clientName: string;
  status: ProjectStatus;
  plannedStart: Date;
  plannedFinish: Date;
  contractValue: number;
  plannedHours: number;
  templateId: string | null;
  createdAt: Date;
  activatedAt: Date | null;
  closedAt: Date | null;
  demand: PositionDemandRecord[];
};

export type ProjectInput = Omit<
  ProjectRecord,
  "createdAt" | "activatedAt" | "closedAt" | "sourceType" | "sourceOpportunityId"
> & {
  sourceOpportunityId: string;
};
export type ProjectDraftActivationInput = {
  tenantId: TenantId;
  projectId: string;
};

export type WorkspaceInboxProjectInput = {
  tenantId: TenantId;
  plannedStart: Date;
  plannedFinish: Date;
};

export type ProjectIntakeRepository = {
  listOpportunities(tenantId: TenantId): Promise<OpportunityRecord[]>;
  findOpportunityById(
    tenantId: TenantId,
    opportunityId: string
  ): Promise<OpportunityRecord | undefined>;
  createOpportunity(input: OpportunityInput): Promise<OpportunityRecord>;
  updateOpportunity(input: OpportunityInput): Promise<OpportunityRecord | undefined>;
  updateOpportunityFeasibility(
    input: OpportunityFeasibilityUpdate
  ): Promise<OpportunityRecord | undefined>;
  updateOpportunityStage(input: {
    tenantId: TenantId;
    opportunityId: string;
    stageId: string;
  }): Promise<OpportunityRecord | undefined>;
  transitionOpportunityCrmPipelineStage(input: {
    tenantId: TenantId;
    opportunityId: string;
    pipelineId: string;
    currentStageId: string;
    targetStageId: string;
  }): Promise<OpportunityRecord | undefined>;
  finalizeOpportunity(input: {
    tenantId: TenantId;
    opportunityId: string;
    status: OpportunityFinalStatus;
  }): Promise<OpportunityRecord | undefined>;
  listProjects(tenantId: TenantId): Promise<ProjectRecord[]>;
  ensureWorkspaceInboxProject(input: WorkspaceInboxProjectInput): Promise<ProjectRecord>;
  createProjectDraftFromOpportunity(input: ProjectInput): Promise<ProjectRecord>;
  activateProjectDraft(input: ProjectDraftActivationInput): Promise<ProjectRecord>;
};

export function createProjectIntakeRepository(
  db: KissPmDatabase
): ProjectIntakeRepository {
  async function listOpportunityDemand(
    tenantId: TenantId,
    opportunityIds: readonly string[]
  ): Promise<Map<string, PositionDemandRecord[]>> {
    const demandByOpportunity = new Map<string, PositionDemandRecord[]>();
    if (opportunityIds.length === 0) return demandByOpportunity;

    const rows = await db
      .select()
      .from(opportunityDemands)
      .where(eq(opportunityDemands.tenantId, tenantId));

    for (const row of rows) {
      if (!opportunityIds.includes(row.opportunityId)) continue;
      const demand = demandByOpportunity.get(row.opportunityId) ?? [];
      demand.push({
        positionId: row.positionId,
        requiredHours: row.requiredHours
      });
      demandByOpportunity.set(row.opportunityId, demand);
    }

    return demandByOpportunity;
  }

  async function listProjectDemand(
    tenantId: TenantId,
    projectIds: readonly string[]
  ): Promise<Map<string, PositionDemandRecord[]>> {
    const demandByProject = new Map<string, PositionDemandRecord[]>();
    if (projectIds.length === 0) return demandByProject;

    const rows = await db
      .select()
      .from(projectPositionDemands)
      .where(eq(projectPositionDemands.tenantId, tenantId));

    for (const row of rows) {
      if (!projectIds.includes(row.projectId)) continue;
      const demand = demandByProject.get(row.projectId) ?? [];
      demand.push({
        positionId: row.positionId,
        requiredHours: row.requiredHours
      });
      demandByProject.set(row.projectId, demand);
    }

    return demandByProject;
  }

  return {
    async listOpportunities(tenantId) {
      const rows = await db
        .select()
        .from(opportunities)
        .where(eq(opportunities.tenantId, tenantId))
        .orderBy(desc(opportunities.createdAt), desc(opportunities.id));
      const demandByOpportunity = await listOpportunityDemand(
        tenantId,
        rows.map((row) => row.id)
      );

      return rows.map((row) =>
        mapOpportunityRecord(row, demandByOpportunity.get(row.id) ?? [])
      );
    },
    async findOpportunityById(tenantId, opportunityId) {
      const [row] = await db
        .select()
        .from(opportunities)
        .where(
          and(
            eq(opportunities.tenantId, tenantId),
            eq(opportunities.id, opportunityId)
          )
        )
        .limit(1);

      if (!row) return undefined;
      const demandByOpportunity = await listOpportunityDemand(tenantId, [opportunityId]);
      return mapOpportunityRecord(row, demandByOpportunity.get(row.id) ?? []);
    },
    async createOpportunity(input) {
      return db.transaction(async (transaction) => {
        const [row] = await transaction
          .insert(opportunities)
          .values({
            id: input.id,
            tenantId: input.tenantId,
            clientId: input.clientId,
            primaryContactId: input.primaryContactId,
            ownerUserId: input.ownerUserId ?? null,
            projectTypeId: input.projectTypeId,
            stageId: input.stageId,
            crmPipelineId: input.crmPipelineId ?? null,
            crmPipelineStageId: input.crmPipelineStageId ?? null,
            crmPipelineStateUpdatedAt: input.crmPipelineId && input.crmPipelineStageId ? new Date() : null,
            clientName: input.clientName,
            contactName: input.contactName,
            title: input.title,
            projectType: input.projectType,
            description: input.description,
            plannedStart: input.plannedStart,
            plannedFinish: input.plannedFinish,
            contractValue: input.contractValue,
            plannedHourlyRate: input.plannedHourlyRate,
            plannedHours: input.plannedHours,
            probability: input.probability,
            status: input.status,
            templateId: input.templateId,
            customFieldValues: input.customFieldValues ?? {},
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();

        if (!row) throw new Error("Opportunity insert returned no row");

        if (input.demand.length > 0) {
          await transaction.insert(opportunityDemands).values(
            input.demand.map((line) => ({
              tenantId: input.tenantId,
              opportunityId: input.id,
              positionId: line.positionId,
              requiredHours: line.requiredHours
            }))
          );
        }

        return mapOpportunityRecord(row, input.demand);
      });
    },
    async updateOpportunityFeasibility(input) {
      const [row] = await db
        .update(opportunities)
        .set({
          status: input.status,
          feasibilityStatus: input.feasibilityStatus,
          feasibilityResult: input.feasibilityResult,
          feasibilityCheckedAt: new Date(),
          updatedAt: new Date()
        })
        .where(
          and(
            eq(opportunities.tenantId, input.tenantId),
            eq(opportunities.id, input.opportunityId),
            notInArray(opportunities.status, finalOpportunityStatuses)
          )
        )
        .returning();

      if (!row) return undefined;
      const demandByOpportunity = await listOpportunityDemand(input.tenantId, [
        input.opportunityId
      ]);

      return mapOpportunityRecord(row, demandByOpportunity.get(row.id) ?? []);
    },
    async updateOpportunity(input) {
      return db.transaction(async (transaction) => {
        const now = new Date();
        const [row] = await transaction
          .update(opportunities)
          .set({
            clientId: input.clientId,
            primaryContactId: input.primaryContactId,
            ownerUserId: input.ownerUserId ?? null,
            projectTypeId: input.projectTypeId,
            stageId: input.stageId,
            crmPipelineId: input.crmPipelineId ?? null,
            crmPipelineStageId: input.crmPipelineStageId ?? null,
            crmPipelineStateUpdatedAt:
              input.crmPipelineId && input.crmPipelineStageId
                ? now
                : null,
            clientName: input.clientName,
            contactName: input.contactName,
            title: input.title,
            projectType: input.projectType,
            description: input.description,
            plannedStart: input.plannedStart,
            plannedFinish: input.plannedFinish,
            contractValue: input.contractValue,
            plannedHourlyRate: input.plannedHourlyRate,
            plannedHours: input.plannedHours,
            probability: input.probability,
            status: input.status,
            templateId: input.templateId,
            customFieldValues: input.customFieldValues ?? {},
            feasibilityStatus: null,
            feasibilityResult: null,
            feasibilityCheckedAt: null,
            updatedAt: now
          })
          .where(
            and(
              eq(opportunities.tenantId, input.tenantId),
              eq(opportunities.id, input.id),
              notInArray(opportunities.status, finalOpportunityStatuses)
            )
          )
          .returning();

        if (!row) return undefined;

        await transaction
          .delete(opportunityDemands)
          .where(
            and(
              eq(opportunityDemands.tenantId, input.tenantId),
              eq(opportunityDemands.opportunityId, input.id)
            )
          );

        if (input.demand.length > 0) {
          await transaction.insert(opportunityDemands).values(
            input.demand.map((line) => ({
              tenantId: input.tenantId,
              opportunityId: input.id,
              positionId: line.positionId,
              requiredHours: line.requiredHours
            }))
          );
        }

        return mapOpportunityRecord(row, input.demand);
      });
    },
    async updateOpportunityStage(input) {
      const [row] = await db
        .update(opportunities)
        .set({
          stageId: input.stageId,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(opportunities.tenantId, input.tenantId),
            eq(opportunities.id, input.opportunityId),
            notInArray(opportunities.status, finalOpportunityStatuses)
          )
        )
        .returning();

      if (!row) return undefined;
      const demandByOpportunity = await listOpportunityDemand(input.tenantId, [
        input.opportunityId
      ]);

      return mapOpportunityRecord(row, demandByOpportunity.get(row.id) ?? []);
    },
    async transitionOpportunityCrmPipelineStage(input) {
      const [row] = await db
        .update(opportunities)
        .set({
          crmPipelineId: input.pipelineId,
          crmPipelineStageId: input.targetStageId,
          crmPipelineStateUpdatedAt: new Date(),
          updatedAt: new Date()
        })
        .where(
          and(
            eq(opportunities.tenantId, input.tenantId),
            eq(opportunities.id, input.opportunityId),
            eq(opportunities.crmPipelineId, input.pipelineId),
            eq(opportunities.crmPipelineStageId, input.currentStageId),
            notInArray(opportunities.status, finalOpportunityStatuses)
          )
        )
        .returning();

      if (!row) return undefined;
      const demandByOpportunity = await listOpportunityDemand(input.tenantId, [
        input.opportunityId
      ]);

      return mapOpportunityRecord(row, demandByOpportunity.get(row.id) ?? []);
    },
    async finalizeOpportunity(input) {
      const [row] = await db
        .update(opportunities)
        .set({
          status: input.status,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(opportunities.tenantId, input.tenantId),
            eq(opportunities.id, input.opportunityId),
            notInArray(opportunities.status, finalOpportunityStatuses)
          )
        )
        .returning();

      if (!row) return undefined;
      const demandByOpportunity = await listOpportunityDemand(input.tenantId, [
        input.opportunityId
      ]);

      return mapOpportunityRecord(row, demandByOpportunity.get(row.id) ?? []);
    },
    async listProjects(tenantId) {
      const rows = await db
        .select()
        .from(projects)
        .where(eq(projects.tenantId, tenantId))
        .orderBy(desc(projects.activatedAt), desc(projects.createdAt), desc(projects.id));
      const demandByProject = await listProjectDemand(
        tenantId,
        rows.map((row) => row.id)
      );

      return rows.map((row) =>
        mapProjectRecord(row, demandByProject.get(row.id) ?? [])
      );
    },
    async ensureWorkspaceInboxProject(input) {
      const now = new Date();
      const [existing] = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.tenantId, input.tenantId),
            eq(projects.sourceType, "workspace_inbox"),
            inArray(projects.status, ["draft", "active", "paused"])
          )
        )
        .limit(1);

      if (existing) {
        const plannedStart =
          existing.plannedStart.getTime() <= input.plannedStart.getTime()
            ? existing.plannedStart
            : input.plannedStart;
        const plannedFinish =
          existing.plannedFinish.getTime() >= input.plannedFinish.getTime()
            ? existing.plannedFinish
            : input.plannedFinish;
        const [row] = await db
          .update(projects)
          .set({
            status: "active",
            plannedStart,
            plannedFinish,
            activatedAt: existing.activatedAt ?? now
          })
          .where(and(eq(projects.tenantId, input.tenantId), eq(projects.id, existing.id)))
          .returning();
        if (!row) throw new Error("Workspace inbox project update returned no row");
        return mapProjectRecord(row, []);
      }

      const preferredInboxId = `workspace-inbox-${input.tenantId}`;
      const [closedPreferredInbox] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.tenantId, input.tenantId), eq(projects.id, preferredInboxId)))
        .limit(1);
      const inboxId = closedPreferredInbox
        ? `${preferredInboxId}-${now.getTime()}`
        : preferredInboxId;

      const [row] = await db
        .insert(projects)
        .values({
          id: inboxId,
          tenantId: input.tenantId,
          sourceType: "workspace_inbox",
          sourceOpportunityId: null,
          clientId: null,
          projectTypeId: null,
          title: "Входящие задачи",
          clientName: "Рабочее пространство",
          status: "active",
          plannedStart: input.plannedStart,
          plannedFinish: input.plannedFinish,
          contractValue: 0,
          plannedHours: 0,
          templateId: null,
          createdAt: now,
          activatedAt: now
        })
        .returning();

      if (!row) throw new Error("Workspace inbox project insert returned no row");
      return mapProjectRecord(row, []);
    },
    async createProjectDraftFromOpportunity(input) {
      return db.transaction(async (transaction) => {
        const now = new Date();
        if (input.status !== "draft") {
          throw new Error("project_draft_requires_draft_status");
        }

        const [sourceOpportunity] = await transaction
          .select({ id: opportunities.id })
          .from(opportunities)
          .where(
            and(
              eq(opportunities.tenantId, input.tenantId),
              eq(opportunities.id, input.sourceOpportunityId ?? ""),
              notInArray(opportunities.status, finalOpportunityStatuses)
            )
          )
          .limit(1);
        if (!sourceOpportunity) {
          throw new Error("source_opportunity_not_draftable");
        }

        try {
          const [row] = await transaction
            .insert(projects)
            .values({
              id: input.id,
              tenantId: input.tenantId,
              sourceType: "opportunity",
              sourceOpportunityId: input.sourceOpportunityId,
              clientId: input.clientId,
              projectTypeId: input.projectTypeId,
              title: input.title,
              clientName: input.clientName,
              status: input.status,
              plannedStart: input.plannedStart,
              plannedFinish: input.plannedFinish,
              contractValue: input.contractValue,
              plannedHours: input.plannedHours,
              templateId: input.templateId,
              createdAt: now,
              activatedAt: null
            })
            .returning();

          if (!row) throw new Error("Project draft insert returned no row");

          if (input.demand.length > 0) {
            await transaction.insert(projectPositionDemands).values(
              input.demand.map((line) => ({
                tenantId: input.tenantId,
                projectId: input.id,
                positionId: line.positionId,
                requiredHours: line.requiredHours
              }))
            );
          }

          return mapProjectRecord(row, input.demand);
        } catch (error) {
          if (isSingleSourceOpportunityProjectError(error)) {
            throw new Error("source_opportunity_already_has_project");
          }
          throw error;
        }
      });
    },
    async activateProjectDraft(input) {
      return db.transaction(async (transaction) => {
        const now = new Date();
        const [draft] = await transaction
          .select()
          .from(projects)
          .where(
            and(
              eq(projects.tenantId, input.tenantId),
              eq(projects.id, input.projectId),
              eq(projects.status, "draft")
            )
          )
          .limit(1);
        if (!draft) {
          throw new Error("project_draft_not_activatable");
        }
        if (!draft.sourceOpportunityId) {
          throw new Error("source_opportunity_required");
        }

        const [updatedOpportunity] = await transaction
          .update(opportunities)
          .set({
            status: "won_closed",
            updatedAt: now
          })
          .where(
            and(
              eq(opportunities.tenantId, input.tenantId),
              eq(opportunities.id, draft.sourceOpportunityId),
              notInArray(opportunities.status, finalOpportunityStatuses)
            )
          )
          .returning({ id: opportunities.id });
        if (!updatedOpportunity) {
          throw new Error("source_opportunity_already_activated");
        }

        const [row] = await transaction
          .update(projects)
          .set({
            status: "active",
            activatedAt: now
          })
          .where(
            and(
              eq(projects.tenantId, input.tenantId),
              eq(projects.id, input.projectId),
              eq(projects.status, "draft")
            )
          )
          .returning();

        if (!row) throw new Error("Project draft activation returned no row");

        const demandByProject = await listProjectDemand(input.tenantId, [input.projectId]);
        return mapProjectRecord(row, demandByProject.get(row.id) ?? []);
      });
    }
  };
}

function isSingleSourceOpportunityProjectError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("projects_tenant_source_opportunity_uidx")
  );
}

function mapOpportunityRecord(
  row: typeof opportunities.$inferSelect,
  demand: PositionDemandRecord[]
): OpportunityRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    clientId: row.clientId,
    primaryContactId: row.primaryContactId,
    ownerUserId: row.ownerUserId,
    projectTypeId: row.projectTypeId,
    stageId: row.stageId,
    crmPipelineId: row.crmPipelineId,
    crmPipelineStageId: row.crmPipelineStageId,
    crmPipelineStateUpdatedAt: row.crmPipelineStateUpdatedAt,
    clientName: row.clientName,
    contactName: row.contactName,
    title: row.title,
    projectType: row.projectType,
    description: row.description,
    plannedStart: row.plannedStart,
    plannedFinish: row.plannedFinish,
    contractValue: row.contractValue,
    plannedHourlyRate: row.plannedHourlyRate,
    plannedHours: row.plannedHours,
    probability: row.probability,
    status: row.status as OpportunityStatus,
    templateId: row.templateId,
    feasibilityStatus: row.feasibilityStatus,
    feasibilityResult: row.feasibilityResult ?? null,
    feasibilityCheckedAt: row.feasibilityCheckedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    demand,
    customFieldValues: normalizeCustomFieldValues(row.customFieldValues)
  };
}

function normalizeCustomFieldValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const result: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue === "string") result[key] = rawValue;
  }

  return result;
}

function mapProjectRecord(
  row: typeof projects.$inferSelect,
  demand: PositionDemandRecord[]
): ProjectRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    sourceType: row.sourceType as ProjectSourceType,
    sourceOpportunityId: row.sourceOpportunityId,
    clientId: row.clientId,
    projectTypeId: row.projectTypeId,
    title: row.title,
    clientName: row.clientName,
    status: row.status as ProjectStatus,
    plannedStart: row.plannedStart,
    plannedFinish: row.plannedFinish,
    contractValue: row.contractValue,
    plannedHours: row.plannedHours,
    templateId: row.templateId,
    createdAt: row.createdAt,
    activatedAt: row.activatedAt,
    closedAt: row.closedAt,
    demand
  };
}
