import type { TenantUser } from "@kiss-pm/domain";

import type {
  ApiTenantDataSource,
  ClientRecord,
  ContactRecord,
  DealStageRecord,
  OpportunityInput,
  ProjectTypeRecord
} from "../apiTypes";

type OpportunityLinkDataSource = Pick<
  ApiTenantDataSource,
  | "findClientById"
  | "findContactById"
  | "findDealStageById"
  | "findProjectTypeById"
  | "findUserById"
>;

export async function resolveOpportunityLinks(
  dataSource: OpportunityLinkDataSource,
  tenantId: string,
  input: OpportunityInput
): Promise<
  | {
      ok: true;
      client: ClientRecord;
      contact: ContactRecord;
      owner: TenantUser | null;
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

  const stage = await dataSource.findDealStageById?.(tenantId, input.stageId ?? "");
  if (!stage || stage.status !== "active") {
    return { ok: false, status: 404, error: "deal_stage_not_found" };
  }

  return { ok: true, client, contact, owner: owner ?? null, projectType, stage };
}
