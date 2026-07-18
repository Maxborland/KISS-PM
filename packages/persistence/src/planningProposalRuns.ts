import { and, eq } from "drizzle-orm";

import type { KissPmDatabase } from "./connection";
import { planningScenarioRuns, planningSolverRuns } from "./schema";
import type {
  PlanningScenarioRunInput,
  PlanningScenarioRunRecord,
  PlanningSolverRunInput,
  PlanningSolverRunRecord
} from "./planningRepository";

export function createPlanningProposalRunStore(db: KissPmDatabase) {
  return {
    async createPlanningScenarioRun(input: PlanningScenarioRunInput): Promise<PlanningScenarioRunRecord> {
      const [row] = await db
        .insert(planningScenarioRuns)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          projectId: input.projectId,
          planVersion: input.planVersion,
          engineVersion: input.engineVersion,
          targetConflict: input.targetConflict,
          proposalPayload: input.proposalPayload,
          proposalPayloadHash: input.proposalPayloadHash,
          actorUserId: input.actorUserId,
          expiresAt: input.expiresAt,
          appliedAt: input.appliedAt ?? null,
          rejectedAt: input.rejectedAt ?? null,
          rejectedReason: input.rejectedReason ?? null,
          createdAt: input.createdAt ?? new Date()
        })
        .onConflictDoUpdate({
          target: [
            planningScenarioRuns.tenantId,
            planningScenarioRuns.projectId,
            planningScenarioRuns.id
          ],
          set: {
            planVersion: input.planVersion,
            engineVersion: input.engineVersion,
            targetConflict: input.targetConflict,
            proposalPayload: input.proposalPayload,
            proposalPayloadHash: input.proposalPayloadHash,
            actorUserId: input.actorUserId,
            expiresAt: input.expiresAt,
            appliedAt: input.appliedAt ?? null,
            rejectedAt: input.rejectedAt ?? null,
            rejectedReason: input.rejectedReason ?? null
          }
        })
        .returning();
      if (!row) throw new Error("Planning scenario insert returned no row");
      return mapPlanningScenarioRun(row);
    },

    async findPlanningScenarioRun(
      tenantId: string,
      projectId: string,
      scenarioRunId: string
    ): Promise<PlanningScenarioRunRecord | undefined> {
      const [row] = await db
        .select()
        .from(planningScenarioRuns)
        .where(
          and(
            eq(planningScenarioRuns.tenantId, tenantId),
            eq(planningScenarioRuns.projectId, projectId),
            eq(planningScenarioRuns.id, scenarioRunId)
          )
        )
        .limit(1);
      return row ? mapPlanningScenarioRun(row) : undefined;
    },

    async markPlanningScenarioRunApplied(input: {
      tenantId: string;
      projectId: string;
      scenarioRunId: string;
      appliedAt: Date;
    }): Promise<void> {
      await db
        .update(planningScenarioRuns)
        .set({ appliedAt: input.appliedAt })
        .where(
          and(
            eq(planningScenarioRuns.tenantId, input.tenantId),
            eq(planningScenarioRuns.projectId, input.projectId),
            eq(planningScenarioRuns.id, input.scenarioRunId)
          )
        );
    },

    async markPlanningScenarioRunRejected(input: {
      tenantId: string;
      projectId: string;
      scenarioRunId: string;
      rejectedAt: Date;
      rejectedReason: string | null;
    }): Promise<void> {
      await db
        .update(planningScenarioRuns)
        .set({ rejectedAt: input.rejectedAt, rejectedReason: input.rejectedReason })
        .where(
          and(
            eq(planningScenarioRuns.tenantId, input.tenantId),
            eq(planningScenarioRuns.projectId, input.projectId),
            eq(planningScenarioRuns.id, input.scenarioRunId)
          )
        );
    },

    async createPlanningSolverRun(input: PlanningSolverRunInput): Promise<PlanningSolverRunRecord> {
      const [row] = await db
        .insert(planningSolverRuns)
        .values({
          id: input.id,
          tenantId: input.tenantId,
          projectId: input.projectId,
          mode: input.mode,
          clientPlanVersion: input.clientPlanVersion,
          engineVersion: input.engineVersion,
          inputSnapshotMetadata: input.inputSnapshotMetadata,
          targetDeadline: input.targetDeadline,
          proposals: input.proposals,
          proposalPayloadHash: input.proposalPayloadHash,
          actorUserId: input.actorUserId,
          expiresAt: input.expiresAt,
          appliedProposalId: input.appliedProposalId ?? null,
          appliedAt: input.appliedAt ?? null,
          rejectedAt: input.rejectedAt ?? null,
          rejectedReason: input.rejectedReason ?? null,
          createdAt: input.createdAt ?? new Date()
        })
        .onConflictDoUpdate({
          target: [planningSolverRuns.tenantId, planningSolverRuns.projectId, planningSolverRuns.id],
          set: {
            mode: input.mode,
            clientPlanVersion: input.clientPlanVersion,
            engineVersion: input.engineVersion,
            inputSnapshotMetadata: input.inputSnapshotMetadata,
            targetDeadline: input.targetDeadline,
            proposals: input.proposals,
            proposalPayloadHash: input.proposalPayloadHash,
            actorUserId: input.actorUserId,
            expiresAt: input.expiresAt,
            appliedProposalId: input.appliedProposalId ?? null,
            appliedAt: input.appliedAt ?? null,
            rejectedAt: input.rejectedAt ?? null,
            rejectedReason: input.rejectedReason ?? null
          }
        })
        .returning();
      if (!row) throw new Error("Planning solver run insert returned no row");
      return mapPlanningSolverRun(row);
    },

    async findPlanningSolverRun(
      tenantId: string,
      projectId: string,
      solverRunId: string
    ): Promise<PlanningSolverRunRecord | undefined> {
      const [row] = await db
        .select()
        .from(planningSolverRuns)
        .where(
          and(
            eq(planningSolverRuns.tenantId, tenantId),
            eq(planningSolverRuns.projectId, projectId),
            eq(planningSolverRuns.id, solverRunId)
          )
        )
        .limit(1);
      return row ? mapPlanningSolverRun(row) : undefined;
    },

    async markPlanningSolverRunApplied(input: {
      tenantId: string;
      projectId: string;
      solverRunId: string;
      proposalId: string;
      appliedAt: Date;
    }): Promise<void> {
      await db
        .update(planningSolverRuns)
        .set({ appliedProposalId: input.proposalId, appliedAt: input.appliedAt })
        .where(
          and(
            eq(planningSolverRuns.tenantId, input.tenantId),
            eq(planningSolverRuns.projectId, input.projectId),
            eq(planningSolverRuns.id, input.solverRunId)
          )
        );
    },

    async markPlanningSolverRunRejected(input: {
      tenantId: string;
      projectId: string;
      solverRunId: string;
      rejectedAt: Date;
      rejectedReason: string | null;
    }): Promise<void> {
      await db
        .update(planningSolverRuns)
        .set({ rejectedAt: input.rejectedAt, rejectedReason: input.rejectedReason })
        .where(
          and(
            eq(planningSolverRuns.tenantId, input.tenantId),
            eq(planningSolverRuns.projectId, input.projectId),
            eq(planningSolverRuns.id, input.solverRunId)
          )
        );
    }
  };
}

function mapPlanningScenarioRun(
  row: typeof planningScenarioRuns.$inferSelect
): PlanningScenarioRunRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    planVersion: row.planVersion,
    engineVersion: row.engineVersion,
    targetConflict: row.targetConflict,
    proposalPayload: row.proposalPayload,
    proposalPayloadHash: row.proposalPayloadHash,
    actorUserId: row.actorUserId,
    expiresAt: row.expiresAt,
    appliedAt: row.appliedAt,
    rejectedAt: row.rejectedAt,
    rejectedReason: row.rejectedReason,
    createdAt: row.createdAt
  };
}

function mapPlanningSolverRun(row: typeof planningSolverRuns.$inferSelect): PlanningSolverRunRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    mode: row.mode as PlanningSolverRunRecord["mode"],
    clientPlanVersion: row.clientPlanVersion,
    engineVersion: row.engineVersion,
    inputSnapshotMetadata: row.inputSnapshotMetadata,
    targetDeadline: row.targetDeadline,
    proposals: row.proposals,
    proposalPayloadHash: row.proposalPayloadHash,
    actorUserId: row.actorUserId,
    expiresAt: row.expiresAt,
    appliedProposalId: row.appliedProposalId,
    appliedAt: row.appliedAt,
    rejectedAt: row.rejectedAt,
    rejectedReason: row.rejectedReason,
    createdAt: row.createdAt
  };
}
