import { evaluatePipelineChange } from "@kiss-pm/domain";
import type { TenantUser } from "@kiss-pm/domain";
import { authorizeOpportunityPipelineChange } from "./authorization";
import { isFinalOpportunityStatus } from "./opportunityStatus";
import type {
  ChangeOpportunityPipelineResult,
  ProjectIntakeServiceDeps
} from "./types";

// Мультиворонки: перенос сделки в другую воронку на её стадию.
export async function changeOpportunityPipeline(
  deps: ProjectIntakeServiceDeps,
  input: {
    actor: TenantUser;
    opportunityId: string;
    pipelineId: string;
    stageId: string;
  }
): Promise<ChangeOpportunityPipelineResult> {
  const authorization = await authorizeOpportunityPipelineChange(deps, input);
  if (!authorization.ok) return authorization;

  const opportunity = await deps.dataSource.findOpportunityById!(
    input.actor.tenantId,
    input.opportunityId
  );
  if (!opportunity) return { ok: false, status: 404, error: "opportunity_not_found" };

  // Резолв целевой воронки и стадии (без проверки активности здесь —
  // её делает домен evaluatePipelineChange по полю status).
  const pipeline = await deps.dataSource.findPipelineById!(
    input.actor.tenantId,
    input.pipelineId
  );
  if (!pipeline) return { ok: false, status: 404, error: "pipeline_not_found" };

  const stage = await deps.dataSource.findDealStageById!(
    input.actor.tenantId,
    input.stageId
  );
  if (!stage) return { ok: false, status: 404, error: "deal_stage_not_found" };

  // Финальность сделки вычисляет вызывающий (домен её не знает) и передаёт флагом.
  const decision = evaluatePipelineChange({
    opportunity: { finalized: isFinalOpportunityStatus(opportunity.status) },
    targetPipeline: { id: pipeline.id, status: pipeline.status },
    targetStage: { pipelineId: stage.pipelineId ?? null, status: stage.status }
  });
  if (!decision.allowed) {
    return { ok: false, status: 409, error: decision.reason };
  }

  const opportunityAfterChange = await deps.runDataSourceTransaction(
    async (transactionDataSource) => {
      if (!transactionDataSource.updateOpportunityPipeline) {
        throw new Error("transactional_opportunity_pipeline_not_configured");
      }

      const updated = await transactionDataSource.updateOpportunityPipeline({
        tenantId: input.actor.tenantId,
        opportunityId: opportunity.id,
        stageId: stage.id,
        pipelineId: pipeline.id
      });
      if (!updated) {
        return undefined;
      }
      await deps.appendManagementAuditEvent(
        {
          tenantId: input.actor.tenantId,
          actorUserId: input.actor.id,
          actionType: "opportunity.pipeline_changed",
          sourceWorkflow: "crm_intake",
          sourceEntity: {
            type: "Opportunity",
            id: opportunity.id
          },
          commandInput: {
            opportunityId: opportunity.id,
            pipelineId: pipeline.id,
            stageId: stage.id
          },
          beforeState: opportunity,
          afterState: updated,
          permissionResult: authorization.decision
        },
        transactionDataSource
      );

      return updated;
    }
  );

  // Сделка завершилась гонкой финализации между резолвом и транзакцией.
  if (!opportunityAfterChange) {
    return { ok: false, status: 409, error: "opportunity_finalized" };
  }

  return { ok: true, status: 200, opportunity: opportunityAfterChange };
}
