import {
  canManageClients,
  canManageContacts,
  canManageDealStages,
  canManageProjectTypes,
  canReadClients,
  canReadContacts,
  canReadDealStages,
  canReadProjectTypes,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";
import type {
  ApiTenantDataSource,
  ManagementAuditEventInput
} from "./apiTypes";
import {
  parseClientBody,
  parseContactBody,
  parseDealStageBody,
  parseProjectTypeBody
} from "./crmParsers";
import { readLimitedJsonBody } from "./jsonBody";

type CrmRouteDeps = {
  dataSource: ApiTenantDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: ApiTenantDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ApiTenantDataSource
  ): Promise<void>;
};

export function registerCrmRoutes(app: Hono, deps: CrmRouteDeps) {
  const {
    appendManagementAuditEvent,
    dataSource,
    getActorProfile,
    getSessionActorFromHeaders,
    runDataSourceTransaction
  } = deps;

  app.get("/api/workspace/clients", async (context) => {
    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listClients) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadClients({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({ clients: await dataSource.listClients(actor.tenantId) });
  });

  app.post("/api/workspace/clients", async (context) => {
    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.createClient || !dataSource.appendAuditEvent || !dataSource.withTransaction) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManageClients({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "client.create_denied",
        sourceEntity: { type: "Client", id: "unknown" },
        commandInput: { endpoint: "createClient" },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseClientBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const client = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createClient) {
        throw new Error("transactional_client_create_not_configured");
      }
      const created = await transactionDataSource.createClient(parsed.value);
      await appendManagementAuditEvent(
        auditInput({
          actor,
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

    return context.json({ client }, 201);
  });

  app.get("/api/workspace/contacts", async (context) => {
    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listContacts) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadContacts({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({ contacts: await dataSource.listContacts(actor.tenantId) });
  });

  app.post("/api/workspace/contacts", async (context) => {
    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.createContact ||
      !dataSource.findClientById ||
      !dataSource.appendAuditEvent ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManageContacts({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "contact.create_denied",
        sourceEntity: { type: "Contact", id: "unknown" },
        commandInput: { endpoint: "createContact" },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseContactBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const client = await dataSource.findClientById(actor.tenantId, parsed.value.clientId);
    if (!client || client.status !== "active") {
      return context.json({ error: "client_not_found" }, 404);
    }

    const contact = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createContact) {
        throw new Error("transactional_contact_create_not_configured");
      }
      const created = await transactionDataSource.createContact(parsed.value);
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "contact.created",
          sourceEntity: { type: "Contact", id: created.id },
          commandInput: parsed.value,
          beforeState: null,
          afterState: created,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return created;
    });

    return context.json({ contact }, 201);
  });

  app.get("/api/workspace/project-types", async (context) => {
    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listProjectTypes) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadProjectTypes({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({
      projectTypes: await dataSource.listProjectTypes(actor.tenantId)
    });
  });

  app.post("/api/workspace/project-types", async (context) => {
    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.createProjectType ||
      !dataSource.appendAuditEvent ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManageProjectTypes({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "project_type.create_denied",
        sourceEntity: { type: "ProjectType", id: "unknown" },
        commandInput: { endpoint: "createProjectType" },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseProjectTypeBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const projectType = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createProjectType) {
        throw new Error("transactional_project_type_create_not_configured");
      }
      const created = await transactionDataSource.createProjectType(parsed.value);
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "project_type.created",
          sourceEntity: { type: "ProjectType", id: created.id },
          commandInput: parsed.value,
          beforeState: null,
          afterState: created,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return created;
    });

    return context.json({ projectType }, 201);
  });

  app.get("/api/workspace/deal-stages", async (context) => {
    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listDealStages) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadDealStages({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({ dealStages: await dataSource.listDealStages(actor.tenantId) });
  });

  app.post("/api/workspace/deal-stages", async (context) => {
    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.createDealStage ||
      !dataSource.appendAuditEvent ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManageDealStages({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "deal_stage.create_denied",
        sourceEntity: { type: "DealStage", id: "unknown" },
        commandInput: { endpoint: "createDealStage" },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseDealStageBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const dealStage = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createDealStage) {
        throw new Error("transactional_deal_stage_create_not_configured");
      }
      const created = await transactionDataSource.createDealStage(parsed.value);
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "deal_stage.created",
          sourceEntity: { type: "DealStage", id: created.id },
          commandInput: parsed.value,
          beforeState: null,
          afterState: created,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return created;
    });

    return context.json({ dealStage }, 201);
  });

  async function getActor(cookie: string | null): Promise<TenantUser | undefined> {
    return getSessionActorFromHeaders(cookie);
  }

  async function appendDeniedAudit(input: {
    actor: TenantUser;
    actionType: string;
    sourceEntity: {
      type: string;
      id: string;
    };
    commandInput: Record<string, unknown>;
    permissionResult: PolicyDecision;
    error: string;
  }) {
    await appendManagementAuditEvent({
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
}

function auditInput(input: {
  actor: TenantUser;
  actionType: string;
  sourceEntity: {
    type: string;
    id: string;
  };
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
