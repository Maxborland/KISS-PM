import {
  canManageClients,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";

import type { CrmClientCommandDataPort } from "../apiDataPorts";
import type {
  ClientRecord,
  ManagementAuditDataSource,
  ManagementAuditEventInput
} from "../apiTypes";
import { parseClientBody } from "../crmParsers";

type ClientCommandDeps = {
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: CrmClientCommandDataPort) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ManagementAuditDataSource
  ): Promise<string>;
};

type ClientBodyReaderResult =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 | 415; error: string };

type ClientCommandErrorStatus = 400 | 403 | 404 | 409 | 413 | 415;

type ClientCommandResult =
  | { status: 200; body: { client: ClientRecord } }
  | { status: 201; body: { client: ClientRecord } }
  | { status: ClientCommandErrorStatus; body: { error: string } };

export async function executeCreateClientCommand(input: {
  actor: TenantUser;
  profile: AccessProfile;
  readBody(): Promise<ClientBodyReaderResult>;
  deps: ClientCommandDeps;
}): Promise<ClientCommandResult> {
  const decision = canManageClients({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) {
    await appendClientDeniedAudit({
      actor: input.actor,
      actionType: "client.create_denied",
      sourceEntity: { type: "Client", id: "unknown" },
      commandInput: { endpoint: "createClient" },
      permissionResult: decision,
      error: decision.reason,
      deps: input.deps
    });
    return { status: 403, body: { error: decision.reason } };
  }

  const body = await input.readBody();
  if (!body.ok) return { status: body.status, body: { error: body.error } };
  const parsed = parseClientBody(body.value, input.actor.tenantId);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };

  let client: ClientRecord;
  try {
    client = await input.deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createClient) {
        throw new Error("transactional_client_create_not_configured");
      }
      const created = await transactionDataSource.createClient(parsed.value);
      await input.deps.appendManagementAuditEvent(
        clientAuditInput({
          actor: input.actor,
          actionType: "client.created",
          sourceEntity: { type: "Client", id: created.id },
          commandInput: parsed.value,
          beforeState: null,
          afterState: created,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return created;
    });
  } catch (error) {
    const conflict = clientUniqueConflict(error);
    if (conflict) return { status: 409, body: { error: conflict } };
    throw error;
  }

  return { status: 201, body: { client } };
}

export async function executeUpdateClientCommand(input: {
  actor: TenantUser;
  profile: AccessProfile;
  clientId: string;
  readBody(): Promise<ClientBodyReaderResult>;
  dataSource: Pick<CrmClientCommandDataPort, "findClientById">;
  deps: ClientCommandDeps;
}): Promise<ClientCommandResult> {
  const decision = canManageClients({
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  });
  if (!decision.allowed) {
    await appendClientDeniedAudit({
      actor: input.actor,
      actionType: "client.update_denied",
      sourceEntity: { type: "Client", id: input.clientId },
      commandInput: { endpoint: "updateClient", clientId: input.clientId },
      permissionResult: decision,
      error: decision.reason,
      deps: input.deps
    });
    return { status: 403, body: { error: decision.reason } };
  }

  if (!input.dataSource.findClientById) {
    throw new Error("client_lookup_not_configured");
  }
  const beforeState = await input.dataSource.findClientById(input.actor.tenantId, input.clientId);
  if (!beforeState) return { status: 404, body: { error: "client_not_found" } };
  const body = await input.readBody();
  if (!body.ok) return { status: body.status, body: { error: body.error } };
  if (!isObjectBody(body.value)) return { status: 400, body: { error: "invalid_body" } };

  const parsed = parseClientBody({ ...body.value, id: input.clientId }, input.actor.tenantId);
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } };

  let client: ClientRecord;
  try {
    client = await input.deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.updateClient) {
        throw new Error("transactional_client_update_not_configured");
      }
      const updated = await transactionDataSource.updateClient(parsed.value);
      await input.deps.appendManagementAuditEvent(
        clientAuditInput({
          actor: input.actor,
          actionType: "client.updated",
          sourceEntity: { type: "Client", id: updated.id },
          commandInput: parsed.value,
          beforeState,
          afterState: updated,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return updated;
    });
  } catch (error) {
    const conflict = clientUniqueConflict(error);
    if (conflict) return { status: 409, body: { error: conflict } };
    throw error;
  }

  return { status: 200, body: { client } };
}

async function appendClientDeniedAudit(input: {
  actor: TenantUser;
  actionType: string;
  sourceEntity: { type: string; id: string };
  commandInput: Record<string, unknown>;
  permissionResult: PolicyDecision;
  error: string;
  deps: ClientCommandDeps;
}) {
  await input.deps.appendManagementAuditEvent({
    tenantId: input.actor.tenantId,
    actorUserId: input.actor.id,
    actionType: input.actionType,
    sourceWorkflow: "crm_foundation",
    sourceEntity: input.sourceEntity,
    commandInput: input.commandInput,
    beforeState: null,
    afterState: null,
    permissionResult: input.permissionResult,
    executionResult: {
      status: "denied",
      error: input.error
    }
  });
}

function clientAuditInput(input: {
  actor: TenantUser;
  actionType: string;
  sourceEntity: { type: string; id: string };
  commandInput: Record<string, unknown>;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  permissionResult: PolicyDecision;
}): ManagementAuditEventInput {
  return {
    tenantId: input.actor.tenantId,
    actorUserId: input.actor.id,
    actionType: input.actionType,
    sourceWorkflow: "crm_foundation",
    sourceEntity: input.sourceEntity,
    commandInput: input.commandInput,
    beforeState: input.beforeState,
    afterState: input.afterState,
    permissionResult: input.permissionResult
  };
}


function clientUniqueConflict(error: unknown): "client_name_taken" | null {
  let current: unknown = error;
  for (let depth = 0; current != null && depth < 8; depth += 1) {
    const rec = current as {
      code?: unknown;
      constraint?: unknown;
      constraint_name?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (rec.code === "23505") {
      const marker = String(rec.constraint ?? rec.constraint_name ?? rec.message ?? "");
      if (marker.includes("clients_tenant_id_name_uidx")) return "client_name_taken";
    }
    current = rec.cause;
  }
  return null;
}
function isObjectBody(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
