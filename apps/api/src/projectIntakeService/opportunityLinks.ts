import type {
  ApiTenantDataSource,
  ClientRecord,
  ContactRecord,
  DealStageRecord,
  OpportunityInput,
  ProjectTypeRecord
} from "../apiTypes";

export async function resolveOpportunityLinks(
  dataSource: ApiTenantDataSource,
  tenantId: string,
  input: OpportunityInput
): Promise<
  | {
      ok: true;
      client: ClientRecord;
      contact: ContactRecord;
      projectType: ProjectTypeRecord;
      stage: DealStageRecord;
    }
  | {
      ok: false;
      status: 404 | 501;
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

  const projectType = await dataSource.findProjectTypeById?.(
    tenantId,
    input.projectTypeId ?? ""
  );
  if (!projectType || projectType.status !== "active") {
    return { ok: false, status: 404, error: "project_type_not_found" };
  }

  const stage = await dataSource.findDealStageById?.(tenantId, input.stageId ?? "");
  if (!stage || stage.status !== "active") {
    return { ok: false, status: 404, error: "deal_stage_not_found" };
  }

  return { ok: true, client, contact, projectType, stage };
}
