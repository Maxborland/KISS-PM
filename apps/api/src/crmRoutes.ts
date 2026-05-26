import {
  canManageClients,
  canManageContacts,
  canManageDealStages,
  canManageProducts,
  canManageProjectTypes,
  canReadClients,
  canReadContacts,
  canReadDealStages,
  canReadProducts,
  canReadProjectTypes,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";
import type {
  ApiTenantDataSource,
  ManagementAuditDataSource,
  ManagementAuditEventInput
} from "./apiTypes";
import {
  parseClientBody,
  parseContactBody,
  parseDealStageBody,
  parseProductBody,
  parseProjectTypeBody
} from "./crmParsers";
import { runGovernedMutation, writeGovernedDeniedAudit } from "./governedAction";
import { readLimitedJsonBody } from "./jsonBody";

type CrmRouteDeps = {
  dataSource: CrmRouteDataSource;
  getSessionActorFromHeaders(cookie: string | null): Promise<TenantUser | undefined>;
  getActorProfile(actor: TenantUser): Promise<AccessProfile>;
  runDataSourceTransaction<T>(
    operation: (transactionDataSource: CrmMutationDataSource) => Promise<T>
  ): Promise<T>;
  appendManagementAuditEvent(
    input: ManagementAuditEventInput,
    auditDataSource?: ManagementAuditDataSource
  ): Promise<string>;
};

type CrmRouteDataSource = Pick<
  ApiTenantDataSource,
  | "appendAuditEvent"
  | "createClient"
  | "createContact"
  | "createDealStage"
  | "createProduct"
  | "createProjectType"
  | "findClientById"
  | "findContactById"
  | "findDealStageById"
  | "findProductById"
  | "findProjectTypeById"
  | "listClients"
  | "listContacts"
  | "listDealStages"
  | "listProducts"
  | "listProjectTypes"
  | "updateClient"
  | "updateContact"
  | "updateDealStage"
  | "updateProduct"
  | "updateProjectType"
  | "withTransaction"
>;

type CrmMutationDataSource = Pick<
  ApiTenantDataSource,
  | "appendAuditEvent"
  | "createClient"
  | "createContact"
  | "createDealStage"
  | "createProduct"
  | "createProjectType"
  | "updateClient"
  | "updateContact"
  | "updateDealStage"
  | "updateProduct"
  | "updateProjectType"
>;

export function registerCrmRoutes(app: Hono, deps: CrmRouteDeps) {
  const {
    dataSource,
    getActorProfile,
    getSessionActorFromHeaders
  } = deps;
  const sourceWorkflow = "crm_foundation";

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
    const deniedAudit = {
      actionType: "client.create_denied",
      sourceEntity: { type: "Client", id: "unknown" },
      commandInput: { endpoint: "createClient" }
    };
    if (!decision.allowed) {
      const denied = await runDeniedCrmMutation({ actor, deniedAudit, permissionResult: decision });
      return context.json({ error: denied.error }, denied.status);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseClientBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const result = await runCrmMutation({
      actor,
      deniedAudit,
      execute: async (transactionDataSource) => {
        if (!transactionDataSource.createClient) {
          throw new Error("transactional_client_create_not_configured");
        }
        return transactionDataSource.createClient(parsed.value);
      },
      permissionResult: decision,
      successAudit: (created) => ({
        actionType: "client.created",
        sourceEntity: { type: "Client", id: created.id },
        commandInput: parsed.value,
        beforeState: null,
        afterState: created
      })
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ client: result.value }, 201);
  });

  app.patch("/api/workspace/clients/:clientId", async (context) => {
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
    const clientId = context.req.param("clientId");
    const deniedAudit = {
      actionType: "client.update_denied",
      sourceEntity: { type: "Client", id: clientId },
      commandInput: { endpoint: "updateClient", clientId }
    };
    if (!decision.allowed) {
      const denied = await runDeniedCrmMutation({ actor, deniedAudit, permissionResult: decision });
      return context.json({ error: denied.error }, denied.status);
    }

    const beforeState = await dataSource.findClientById(actor.tenantId, clientId);
    if (!beforeState) return context.json({ error: "client_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    if (!isObjectBody(body.value)) return context.json({ error: "invalid_body" }, 400);
    const parsed = parseClientBody({ ...body.value, id: clientId }, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const result = await runCrmMutation({
      actor,
      deniedAudit,
      execute: async (transactionDataSource) => {
        if (!transactionDataSource.updateClient) {
          throw new Error("transactional_client_update_not_configured");
        }
        return transactionDataSource.updateClient(parsed.value);
      },
      permissionResult: decision,
      successAudit: (updated) => ({
        actionType: "client.updated",
        sourceEntity: { type: "Client", id: updated.id },
        commandInput: parsed.value,
        beforeState,
        afterState: updated
      })
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ client: result.value });
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
    const deniedAudit = {
      actionType: "contact.create_denied",
      sourceEntity: { type: "Contact", id: "unknown" },
      commandInput: { endpoint: "createContact" }
    };
    if (!decision.allowed) {
      const denied = await runDeniedCrmMutation({ actor, deniedAudit, permissionResult: decision });
      return context.json({ error: denied.error }, denied.status);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseContactBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const client = await dataSource.findClientById(actor.tenantId, parsed.value.clientId);
    if (!client || client.status !== "active") {
      return context.json({ error: "client_not_found" }, 404);
    }

    const result = await runCrmMutation({
      actor,
      deniedAudit,
      execute: async (transactionDataSource) => {
        if (!transactionDataSource.createContact) {
          throw new Error("transactional_contact_create_not_configured");
        }
        return transactionDataSource.createContact(parsed.value);
      },
      permissionResult: decision,
      successAudit: (created) => ({
        actionType: "contact.created",
        sourceEntity: { type: "Contact", id: created.id },
        commandInput: parsed.value,
        beforeState: null,
        afterState: created
      })
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ contact: result.value }, 201);
  });

  app.patch("/api/workspace/contacts/:contactId", async (context) => {
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
    const contactId = context.req.param("contactId");
    const deniedAudit = {
      actionType: "contact.update_denied",
      sourceEntity: { type: "Contact", id: contactId },
      commandInput: { endpoint: "updateContact", contactId }
    };
    if (!decision.allowed) {
      const denied = await runDeniedCrmMutation({ actor, deniedAudit, permissionResult: decision });
      return context.json({ error: denied.error }, denied.status);
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

    const result = await runCrmMutation({
      actor,
      deniedAudit,
      execute: async (transactionDataSource) => {
        if (!transactionDataSource.updateContact) {
          throw new Error("transactional_contact_update_not_configured");
        }
        return transactionDataSource.updateContact(parsed.value);
      },
      permissionResult: decision,
      successAudit: (updated) => ({
        actionType: "contact.updated",
        sourceEntity: { type: "Contact", id: updated.id },
        commandInput: parsed.value,
        beforeState,
        afterState: updated
      })
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ contact: result.value });
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
    const deniedAudit = {
      actionType: "product.create_denied",
      sourceEntity: { type: "Product", id: "unknown" },
      commandInput: { endpoint: "createProduct" }
    };
    if (!decision.allowed) {
      const denied = await runDeniedCrmMutation({ actor, deniedAudit, permissionResult: decision });
      return context.json({ error: denied.error }, denied.status);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseProductBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const result = await runCrmMutation({
      actor,
      deniedAudit,
      execute: async (transactionDataSource) => {
        if (!transactionDataSource.createProduct) {
          throw new Error("transactional_product_create_not_configured");
        }
        return transactionDataSource.createProduct(parsed.value);
      },
      permissionResult: decision,
      successAudit: (created) => ({
        actionType: "product.created",
        sourceEntity: { type: "Product", id: created.id },
        commandInput: parsed.value,
        beforeState: null,
        afterState: created
      })
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ product: result.value }, 201);
  });

  app.patch("/api/workspace/products/:productId", async (context) => {
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
    const productId = context.req.param("productId");
    const deniedAudit = {
      actionType: "product.update_denied",
      sourceEntity: { type: "Product", id: productId },
      commandInput: { endpoint: "updateProduct", productId }
    };
    if (!decision.allowed) {
      const denied = await runDeniedCrmMutation({ actor, deniedAudit, permissionResult: decision });
      return context.json({ error: denied.error }, denied.status);
    }

    const beforeState = await dataSource.findProductById(actor.tenantId, productId);
    if (!beforeState) return context.json({ error: "product_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    if (!isObjectBody(body.value)) return context.json({ error: "invalid_body" }, 400);
    const parsed = parseProductBody({ ...body.value, id: productId }, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const result = await runCrmMutation({
      actor,
      deniedAudit,
      execute: async (transactionDataSource) => {
        if (!transactionDataSource.updateProduct) {
          throw new Error("transactional_product_update_not_configured");
        }
        return transactionDataSource.updateProduct(parsed.value);
      },
      permissionResult: decision,
      successAudit: (updated) => ({
        actionType: "product.updated",
        sourceEntity: { type: "Product", id: updated.id },
        commandInput: parsed.value,
        beforeState,
        afterState: updated
      })
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ product: result.value });
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
    const deniedAudit = {
      actionType: "project_type.create_denied",
      sourceEntity: { type: "ProjectType", id: "unknown" },
      commandInput: { endpoint: "createProjectType" }
    };
    if (!decision.allowed) {
      const denied = await runDeniedCrmMutation({ actor, deniedAudit, permissionResult: decision });
      return context.json({ error: denied.error }, denied.status);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseProjectTypeBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const result = await runCrmMutation({
      actor,
      deniedAudit,
      execute: async (transactionDataSource) => {
        if (!transactionDataSource.createProjectType) {
          throw new Error("transactional_project_type_create_not_configured");
        }
        return transactionDataSource.createProjectType(parsed.value);
      },
      permissionResult: decision,
      successAudit: (created) => ({
        actionType: "project_type.created",
        sourceEntity: { type: "ProjectType", id: created.id },
        commandInput: parsed.value,
        beforeState: null,
        afterState: created
      })
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ projectType: result.value }, 201);
  });

  app.patch("/api/workspace/project-types/:projectTypeId", async (context) => {
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
    const projectTypeId = context.req.param("projectTypeId");
    const deniedAudit = {
      actionType: "project_type.update_denied",
      sourceEntity: { type: "ProjectType", id: projectTypeId },
      commandInput: { endpoint: "updateProjectType", projectTypeId }
    };
    if (!decision.allowed) {
      const denied = await runDeniedCrmMutation({ actor, deniedAudit, permissionResult: decision });
      return context.json({ error: denied.error }, denied.status);
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

    const result = await runCrmMutation({
      actor,
      deniedAudit,
      execute: async (transactionDataSource) => {
        if (!transactionDataSource.updateProjectType) {
          throw new Error("transactional_project_type_update_not_configured");
        }
        return transactionDataSource.updateProjectType(parsed.value);
      },
      permissionResult: decision,
      successAudit: (updated) => ({
        actionType: "project_type.updated",
        sourceEntity: { type: "ProjectType", id: updated.id },
        commandInput: parsed.value,
        beforeState,
        afterState: updated
      })
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ projectType: result.value });
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
    const deniedAudit = {
      actionType: "deal_stage.create_denied",
      sourceEntity: { type: "DealStage", id: "unknown" },
      commandInput: { endpoint: "createDealStage" }
    };
    if (!decision.allowed) {
      const denied = await runDeniedCrmMutation({ actor, deniedAudit, permissionResult: decision });
      return context.json({ error: denied.error }, denied.status);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseDealStageBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const result = await runCrmMutation({
      actor,
      deniedAudit,
      execute: async (transactionDataSource) => {
        if (!transactionDataSource.createDealStage) {
          throw new Error("transactional_deal_stage_create_not_configured");
        }
        return transactionDataSource.createDealStage(parsed.value);
      },
      permissionResult: decision,
      successAudit: (created) => ({
        actionType: "deal_stage.created",
        sourceEntity: { type: "DealStage", id: created.id },
        commandInput: parsed.value,
        beforeState: null,
        afterState: created
      })
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ dealStage: result.value }, 201);
  });

  app.patch("/api/workspace/deal-stages/:stageId", async (context) => {
    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.findDealStageById ||
      !dataSource.updateDealStage ||
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
    const stageId = context.req.param("stageId");
    const deniedAudit = {
      actionType: "deal_stage.update_denied",
      sourceEntity: { type: "DealStage", id: stageId },
      commandInput: { endpoint: "updateDealStage", stageId }
    };
    if (!decision.allowed) {
      const denied = await runDeniedCrmMutation({ actor, deniedAudit, permissionResult: decision });
      return context.json({ error: denied.error }, denied.status);
    }

    const beforeState = await dataSource.findDealStageById(actor.tenantId, stageId);
    if (!beforeState) return context.json({ error: "deal_stage_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    if (!isObjectBody(body.value)) return context.json({ error: "invalid_body" }, 400);
    const parsed = parseDealStageBody({ ...body.value, id: stageId }, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const result = await runCrmMutation({
      actor,
      deniedAudit,
      execute: async (transactionDataSource) => {
        if (!transactionDataSource.updateDealStage) {
          throw new Error("transactional_deal_stage_update_not_configured");
        }
        return transactionDataSource.updateDealStage(parsed.value);
      },
      permissionResult: decision,
      successAudit: (updated) => ({
        actionType: "deal_stage.updated",
        sourceEntity: { type: "DealStage", id: updated.id },
        commandInput: parsed.value,
        beforeState,
        afterState: updated
      })
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ dealStage: result.value });
  });

  async function getActor(cookie: string | null): Promise<TenantUser | undefined> {
    return getSessionActorFromHeaders(cookie);
  }

  async function runDeniedCrmMutation(input: {
    actor: TenantUser;
    permissionResult: PolicyDecision;
    deniedAudit: {
      actionType: string;
      sourceEntity: { type: string; id: string };
      commandInput: Record<string, unknown>;
    };
  }) {
    return writeGovernedDeniedAudit({
      actor: input.actor,
      appendManagementAuditEvent: deps.appendManagementAuditEvent,
      deniedAudit: input.deniedAudit,
      permissionResult: input.permissionResult,
      sourceWorkflow
    });
  }

  async function runCrmMutation<T>(input: {
    actor: TenantUser;
    permissionResult: PolicyDecision;
    deniedAudit: {
      actionType: string;
      sourceEntity: { type: string; id: string };
      commandInput: Record<string, unknown>;
    };
    execute(transactionDataSource: CrmMutationDataSource): Promise<T>;
    successAudit(value: T): {
      actionType: string;
      sourceEntity: { type: string; id: string };
      commandInput: Record<string, unknown>;
      beforeState?: Record<string, unknown> | null;
      afterState?: Record<string, unknown> | null;
    };
  }) {
    return runGovernedMutation({
      actor: input.actor,
      appendManagementAuditEvent: deps.appendManagementAuditEvent,
      deniedAudit: input.deniedAudit,
      execute: input.execute,
      permissionResult: input.permissionResult,
      runDataSourceTransaction: deps.runDataSourceTransaction,
      sourceWorkflow,
      successAudit: input.successAudit
    });
  }
}

function isObjectBody(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
