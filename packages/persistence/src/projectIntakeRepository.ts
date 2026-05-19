import { and, desc, eq, ne } from "drizzle-orm";

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
  | "rejected"
  | "converted";

export type ProjectStatus = "draft" | "active" | "paused" | "closed" | "cancelled";

export type PositionDemandRecord = {
  positionId: string;
  requiredHours: number;
};

export type OpportunityRecord = {
  id: string;
  tenantId: TenantId;
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
};

export type OpportunityInput = Omit<
  OpportunityRecord,
  "createdAt" | "updatedAt" | "feasibilityStatus" | "feasibilityResult" | "feasibilityCheckedAt"
>;

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
  sourceOpportunityId: string;
  title: string;
  clientName: string;
  status: ProjectStatus;
  plannedStart: Date;
  plannedFinish: Date;
  contractValue: number;
  plannedHours: number;
  templateId: string | null;
  createdAt: Date;
  activatedAt: Date;
  demand: PositionDemandRecord[];
};

export type ProjectInput = Omit<ProjectRecord, "createdAt" | "activatedAt">;

export type ProjectIntakeRepository = {
  listOpportunities(tenantId: TenantId): Promise<OpportunityRecord[]>;
  findOpportunityById(
    tenantId: TenantId,
    opportunityId: string
  ): Promise<OpportunityRecord | undefined>;
  createOpportunity(input: OpportunityInput): Promise<OpportunityRecord>;
  updateOpportunityFeasibility(
    input: OpportunityFeasibilityUpdate
  ): Promise<OpportunityRecord>;
  listProjects(tenantId: TenantId): Promise<ProjectRecord[]>;
  activateProjectFromOpportunity(input: ProjectInput): Promise<ProjectRecord>;
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
            eq(opportunities.id, input.opportunityId)
          )
        )
        .returning();

      if (!row) throw new Error("Opportunity feasibility update returned no row");
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
        .orderBy(desc(projects.activatedAt), desc(projects.id));
      const demandByProject = await listProjectDemand(
        tenantId,
        rows.map((row) => row.id)
      );

      return rows.map((row) =>
        mapProjectRecord(row, demandByProject.get(row.id) ?? [])
      );
    },
    async activateProjectFromOpportunity(input) {
      return db.transaction(async (transaction) => {
        const now = new Date();
        const [updatedOpportunity] = await transaction
          .update(opportunities)
          .set({
            status: "converted",
            updatedAt: now
          })
          .where(
            and(
              eq(opportunities.tenantId, input.tenantId),
              eq(opportunities.id, input.sourceOpportunityId),
              ne(opportunities.status, "converted"),
              ne(opportunities.status, "rejected")
            )
          )
          .returning({ id: opportunities.id });

        if (!updatedOpportunity) {
          throw new Error("source_opportunity_already_activated");
        }

        const [row] = await transaction
          .insert(projects)
          .values({
            id: input.id,
            tenantId: input.tenantId,
            sourceOpportunityId: input.sourceOpportunityId,
            title: input.title,
            clientName: input.clientName,
            status: input.status,
            plannedStart: input.plannedStart,
            plannedFinish: input.plannedFinish,
            contractValue: input.contractValue,
            plannedHours: input.plannedHours,
            templateId: input.templateId,
            createdAt: now,
            activatedAt: now
          })
          .returning();

        if (!row) throw new Error("Project insert returned no row");

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
      });
    }
  };
}

function mapOpportunityRecord(
  row: typeof opportunities.$inferSelect,
  demand: PositionDemandRecord[]
): OpportunityRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
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
    demand
  };
}

function mapProjectRecord(
  row: typeof projects.$inferSelect,
  demand: PositionDemandRecord[]
): ProjectRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    sourceOpportunityId: row.sourceOpportunityId,
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
    demand
  };
}
