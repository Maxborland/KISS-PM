import type { TenantUser } from "@kiss-pm/domain";

import type {
  ApiTenantDataSource,
  ClientRecord,
  ContactRecord,
  OpportunityInput,
  OpportunityRecord,
  ProjectTypeRecord
} from "../apiTypes";

type OpportunityLinkDataSource = Pick<
  ApiTenantDataSource,
  | "findClientById"
  | "findContactById"
  | "findCrmPipelineById"
  | "findCrmPipelineStageById"
  | "findDealStageById"
  | "findProjectTypeById"
  | "findUserById"
>;

export async function resolveOpportunityLinks(
  dataSource: OpportunityLinkDataSource,
  tenantId: string,
  input: OpportunityInput,
  existingOpportunity?: Pick<
    OpportunityRecord,
    "crmPipelineId" | "crmPipelineStageId"
  >
): Promise<
  | {
      ok: true;
      client: ClientRecord;
      contact: ContactRecord;
      owner: TenantUser | null;
      projectType: ProjectTypeRecord;
    }
  | {
      ok: false;
      status: 400 | 404 | 409 | 501;
      error: string;
    }
> {
  const client = await dataSource.findClientById?.(tenantId, input.clientId ?? "");
  if (!client || client.status !== "active") {
    return { ok: false, status: 404, error: "client_not_found" };
  }

  const contact = await dataSource.findContactById?.(
    tenantId,
    input.primaryContactId ?? ""
  );
  if (!contact || contact.status !== "active" || contact.clientId !== client.id) {
    return { ok: false, status: 404, error: "contact_not_found" };
  }

  const owner = input.ownerUserId
    ? await dataSource.findUserById(input.ownerUserId)
    : null;
  if (input.ownerUserId && (!owner || owner.tenantId !== tenantId)) {
    return { ok: false, status: 404, error: "owner_user_not_found" };
  }

  const projectType = await dataSource.findProjectTypeById?.(
    tenantId,
    input.projectTypeId ?? ""
  );
  if (!projectType || projectType.status !== "active") {
    return { ok: false, status: 404, error: "project_type_not_found" };
  }

  const compatibilityStage = await dataSource.findDealStageById?.(
    tenantId,
    input.stageId ?? ""
  );
  if (!compatibilityStage || compatibilityStage.status !== "active") {
    return { ok: false, status: 404, error: "opportunity_stage_not_found" };
  }

  const hasCrmPipelineId = Object.prototype.hasOwnProperty.call(
    input,
    "crmPipelineId"
  );
  const hasCrmPipelineStageId = Object.prototype.hasOwnProperty.call(
    input,
    "crmPipelineStageId"
  );
  if (hasCrmPipelineId !== hasCrmPipelineStageId) {
    return { ok: false, status: 400, error: "invalid_crm_pipeline_state" };
  }

  if ((input.crmPipelineId == null) !== (input.crmPipelineStageId == null)) {
    return { ok: false, status: 400, error: "invalid_crm_pipeline_state" };
  }
  if (
    hasCrmPipelineId &&
    hasCrmPipelineStageId &&
    input.crmPipelineId === null &&
    input.crmPipelineStageId === null &&
    existingOpportunity &&
    (existingOpportunity.crmPipelineId !== null ||
      existingOpportunity.crmPipelineStageId !== null)
  ) {
    return {
      ok: false,
      status: 409,
      error: "crm_pipeline_transition_required"
    };
  }
  if (input.crmPipelineId && input.crmPipelineStageId) {
    const pipeline = await dataSource.findCrmPipelineById?.(
      tenantId,
      input.crmPipelineId
    );
    if (!pipeline || pipeline.status !== "active") {
      return { ok: false, status: 404, error: "crm_pipeline_not_found" };
    }

    const pipelineStage = await dataSource.findCrmPipelineStageById?.(
      tenantId,
      input.crmPipelineId,
      input.crmPipelineStageId
    );
    if (!pipelineStage || pipelineStage.status !== "active") {
      return { ok: false, status: 404, error: "crm_pipeline_stage_not_found" };
    }

    const isInitialStage = pipeline.lifecycleGraphMetadata.initialStageId === input.crmPipelineStageId;
    if (existingOpportunity) {
      const isInitialized =
        existingOpportunity.crmPipelineId !== null ||
        existingOpportunity.crmPipelineStageId !== null;
      if (isInitialized) {
        const isSamePipelineState =
          existingOpportunity.crmPipelineId === input.crmPipelineId &&
          existingOpportunity.crmPipelineStageId === input.crmPipelineStageId;
        if (!isSamePipelineState) {
          return {
            ok: false,
            status: 409,
            error: "crm_pipeline_transition_required"
          };
        }
      } else if (!isInitialStage) {
        return initialCrmPipelineStageRequired();
      }
    } else if (!isInitialStage) {
      return initialCrmPipelineStageRequired();
    }
  }

  return { ok: true, client, contact, owner: owner ?? null, projectType };
}

function initialCrmPipelineStageRequired(): {
  ok: false;
  status: 409;
  error: "crm_pipeline_initial_stage_required";
} {
  return { ok: false, status: 409, error: "crm_pipeline_initial_stage_required" };
}
