import {
  canManageClients,
  canManageContacts,
  canManageProducts,
  canManageProjectTypes,
  canReadClients,
  canReadContacts,
  canReadProducts,
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
  parseProductBody,
  parseProjectTypeBody
} from "./crmParsers";
import { readLimitedJsonBody } from "./jsonBody";
import {
  parseClientIdParam,
  parseContactIdParam,
  parseProductIdParam,
  parseProjectTypeIdParam
} from "./routeParamParsers";

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
  ): Promise<string>;
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

  app.patch("/api/workspace/clients/:clientId", async (context) => {
    const parsedClientId = parseClientIdParam(context.req.param("clientId"));
    if (!parsedClientId.ok) {
      return context.json({ error: parsedClientId.error }, 400);
    }

    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.findClientById ||
      !dataSource.updateClient ||
      !dataSource.appendAuditEvent ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManageClients({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    const clientId = parsedClientId.value;
    if (!decision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "client.update_denied",
        sourceEntity: { type: "Client", id: clientId },
        commandInput: { endpoint: "updateClient", clientId },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const beforeState = await dataSource.findClientById(actor.tenantId, clientId);
    if (!beforeState) return context.json({ error: "client_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    if (!isObjectBody(body.value)) return context.json({ error: "invalid_body" }, 400);
    const parsed = parseClientBody({ ...body.value, id: clientId }, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const client = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.updateClient) {
        throw new Error("transactional_client_update_not_configured");
      }
      const updated = await transactionDataSource.updateClient(parsed.value);
      await appendManagementAuditEvent(
        auditInput({
          actor,
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

    return context.json({ client });
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

  app.patch("/api/workspace/contacts/:contactId", async (context) => {
    const parsedContactId = parseContactIdParam(context.req.param("contactId"));
    if (!parsedContactId.ok) {
      return context.json({ error: parsedContactId.error }, 400);
    }

    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.findContactById ||
      !dataSource.findClientById ||
      !dataSource.updateContact ||
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
    const contactId = parsedContactId.value;
    if (!decision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "contact.update_denied",
        sourceEntity: { type: "Contact", id: contactId },
        commandInput: { endpoint: "updateContact", contactId },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const beforeState = await dataSource.findContactById(actor.tenantId, contactId);
    if (!beforeState) return context.json({ error: "contact_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    if (!isObjectBody(body.value)) return context.json({ error: "invalid_body" }, 400);
    const parsed = parseContactBody({ ...body.value, id: contactId }, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const client = await dataSource.findClientById(actor.tenantId, parsed.value.clientId);
    const isReassigningClient = parsed.value.clientId !== beforeState.clientId;
    if (!client || (isReassigningClient && client.status !== "active")) {
      return context.json({ error: "client_not_found" }, 404);
    }

    const contact = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.updateContact) {
        throw new Error("transactional_contact_update_not_configured");
      }
      const updated = await transactionDataSource.updateContact(parsed.value);
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "contact.updated",
          sourceEntity: { type: "Contact", id: updated.id },
          commandInput: parsed.value,
          beforeState,
          afterState: updated,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return updated;
    });

    return context.json({ contact });
  });

  app.get("/api/workspace/products", async (context) => {
    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listProducts) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadProducts({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({ products: await dataSource.listProducts(actor.tenantId) });
  });

  app.post("/api/workspace/products", async (context) => {
    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.createProduct ||
      !dataSource.appendAuditEvent ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManageProducts({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "product.create_denied",
        sourceEntity: { type: "Product", id: "unknown" },
        commandInput: { endpoint: "createProduct" },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseProductBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const product = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createProduct) {
        throw new Error("transactional_product_create_not_configured");
      }
      const created = await transactionDataSource.createProduct(parsed.value);
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "product.created",
          sourceEntity: { type: "Product", id: created.id },
          commandInput: parsed.value,
          beforeState: null,
          afterState: created,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return created;
    });

    return context.json({ product }, 201);
  });

  app.patch("/api/workspace/products/:productId", async (context) => {
    const parsedProductId = parseProductIdParam(context.req.param("productId"));
    if (!parsedProductId.ok) {
      return context.json({ error: parsedProductId.error }, 400);
    }

    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.findProductById ||
      !dataSource.updateProduct ||
      !dataSource.appendAuditEvent ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManageProducts({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    const productId = parsedProductId.value;
    if (!decision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "product.update_denied",
        sourceEntity: { type: "Product", id: productId },
        commandInput: { endpoint: "updateProduct", productId },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const beforeState = await dataSource.findProductById(actor.tenantId, productId);
    if (!beforeState) return context.json({ error: "product_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    if (!isObjectBody(body.value)) return context.json({ error: "invalid_body" }, 400);
    const parsed = parseProductBody({ ...body.value, id: productId }, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const product = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.updateProduct) {
        throw new Error("transactional_product_update_not_configured");
      }
      const updated = await transactionDataSource.updateProduct(parsed.value);
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "product.updated",
          sourceEntity: { type: "Product", id: updated.id },
          commandInput: parsed.value,
          beforeState,
          afterState: updated,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return updated;
    });

    return context.json({ product });
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

  app.patch("/api/workspace/project-types/:projectTypeId", async (context) => {
    const parsedProjectTypeId = parseProjectTypeIdParam(
      context.req.param("projectTypeId")
    );
    if (!parsedProjectTypeId.ok) {
      return context.json({ error: parsedProjectTypeId.error }, 400);
    }

    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.findProjectTypeById ||
      !dataSource.updateProjectType ||
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
    const projectTypeId = parsedProjectTypeId.value;
    if (!decision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "project_type.update_denied",
        sourceEntity: { type: "ProjectType", id: projectTypeId },
        commandInput: { endpoint: "updateProjectType", projectTypeId },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const beforeState = await dataSource.findProjectTypeById(actor.tenantId, projectTypeId);
    if (!beforeState) return context.json({ error: "project_type_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    if (!isObjectBody(body.value)) return context.json({ error: "invalid_body" }, 400);
    const parsed = parseProjectTypeBody(
      { ...body.value, id: projectTypeId },
      actor.tenantId
    );
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const projectType = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.updateProjectType) {
        throw new Error("transactional_project_type_update_not_configured");
      }
      const updated = await transactionDataSource.updateProjectType(parsed.value);
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "project_type.updated",
          sourceEntity: { type: "ProjectType", id: updated.id },
          commandInput: parsed.value,
          beforeState,
          afterState: updated,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return updated;
    });

    return context.json({ projectType });
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

function isObjectBody(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
