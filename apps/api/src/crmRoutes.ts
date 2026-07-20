import {
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
  ManagementAuditEventInput
} from "./apiTypes";
import {
  parseContactBody,
  parseDealStageBody,
  parseDealStageOrderBody,
  parsePipelineBody,
  parseProductBody,
  parseProjectTypeBody,
  parseStageTransitionBody
} from "./crmParsers";
import { readLimitedJsonBody } from "./jsonBody";
import { authorizeRoute } from "./routeAuth";
import {
  parseClientIdParam,
  parseContactIdParam,
  parseDealStageIdParam,
  parsePipelineIdParam,
  parseProductIdParam,
  parseProjectTypeIdParam,
  parseStageTransitionIdParam
} from "./routeParamParsers";
import {
  executeCreateClientCommand,
  executeUpdateClientCommand
} from "./crm/clientCommandHandlers";

// Дубликаты CRM-уникальных полей нарушают Postgres 23505. Распознаём, чтобы вернуть 409 вместо 500
// (house-паттерн, как isCredentialEmailConflict в authRegistrationRoutes). Обходим error.cause.
type CrmUniqueConflictCode =
  | "product_sku_taken"
  | "product_name_taken"
  | "contact_email_taken"
  | "deal_stage_sort_order_taken"
  | "deal_stage_name_taken";

function crmUniqueConflict(error: unknown): CrmUniqueConflictCode | null {
  let current: unknown = error;
  for (let depth = 0; current != null && depth < 8; depth += 1) {
    const rec = current as { code?: unknown; constraint?: unknown; constraint_name?: unknown; message?: unknown; cause?: unknown };
    if (rec.code === "23505") {
      const marker = String(rec.constraint ?? rec.constraint_name ?? rec.message ?? "");
      if (marker.includes("products_tenant_id_sku_uidx")) return "product_sku_taken";
      if (marker.includes("products_tenant_id_name_uidx")) return "product_name_taken";
      if (marker.includes("contacts_tenant_id_email_uidx")) return "contact_email_taken";
      // Стадии воронки: (tenant_id, pipeline_id, sort_order) и (tenant_id, pipeline_id, name)
      // — оба индекса immediate. Раньше 23505 отсюда улетал в app.onError как 500.
      if (marker.includes("crm_pipeline_stages_tenant_pipeline_sort_order_uidx")) return "deal_stage_sort_order_taken";
      if (marker.includes("crm_pipeline_stages_tenant_pipeline_name_uidx")) return "deal_stage_name_taken";
    }
    current = rec.cause;
  }
  return null;
}

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
    const auth = await authorizeRoute(context, deps, {
      permission: canReadClients,
      capabilities: ["listClients"]
    });
    if (!auth.ok) return auth.response;
    const { actor, dataSource } = auth.value;

    return context.json({ clients: await dataSource.listClients(actor.tenantId) });
  });

  app.post("/api/workspace/clients", async (context) => {
    const actor = await getActor(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.createClient || !dataSource.appendAuditEvent || !dataSource.withTransaction) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const result = await executeCreateClientCommand({
      actor,
      profile: await getActorProfile(actor),
      readBody: () => readLimitedJsonBody(context),
      deps: {
        appendManagementAuditEvent,
        runDataSourceTransaction: (operation) =>
          runDataSourceTransaction((transactionDataSource) => operation(transactionDataSource))
      }
    });

    return context.json(result.body, result.status);
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

    const result = await executeUpdateClientCommand({
      actor,
      profile: await getActorProfile(actor),
      clientId: parsedClientId.value,
      dataSource,
      readBody: () => readLimitedJsonBody(context),
      deps: {
        appendManagementAuditEvent,
        runDataSourceTransaction: (operation) =>
          runDataSourceTransaction((transactionDataSource) => operation(transactionDataSource))
      }
    });

    return context.json(result.body, result.status);
  });
  app.get("/api/workspace/contacts", async (context) => {
    const auth = await authorizeRoute(context, deps, {
      permission: canReadContacts,
      capabilities: ["listContacts"]
    });
    if (!auth.ok) return auth.response;
    const { actor, dataSource } = auth.value;

    return context.json({ contacts: await dataSource.listContacts(actor.tenantId) });
  });

  app.post("/api/workspace/contacts", async (context) => {
    const auth = await authorizeRoute(context, deps, {
      permission: canManageContacts,
      capabilities: ["createContact", "findClientById", "listContacts", "appendAuditEvent", "withTransaction"],
      onDenied: ({ actor, decision }) =>
        appendDeniedAudit({
          actor,
          actionType: "contact.create_denied",
          sourceEntity: { type: "Contact", id: "unknown" },
          commandInput: { endpoint: "createContact" },
          permissionResult: decision,
          error: decision.reason
        })
    });
    if (!auth.ok) return auth.response;
    const { actor, decision, dataSource } = auth.value;

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseContactBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);
    const client = await dataSource.findClientById(actor.tenantId, parsed.value.clientId);
    if (!client || client.status !== "active") {
      return context.json({ error: "client_not_found" }, 404);
    }
    if (parsed.value.email) {
      const existingContacts = await dataSource.listContacts(actor.tenantId);
      if (existingContacts.some((contact) => contact.email === parsed.value.email)) {
        return context.json({ error: "contact_email_taken" }, 409);
      }
    }

    let contact;
    try {
      contact = await runDataSourceTransaction(async (transactionDataSource) => {
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
    } catch (error) {
      const conflict = crmUniqueConflict(error);
      if (conflict) return context.json({ error: conflict }, 409);
      throw error;
    }

    return context.json({ contact }, 201);
  });

  app.patch("/api/workspace/contacts/:contactId", async (context) => {
    const parsedContactId = parseContactIdParam(context.req.param("contactId"));
    if (!parsedContactId.ok) {
      return context.json({ error: parsedContactId.error }, 400);
    }

    const contactId = parsedContactId.value;
    const auth = await authorizeRoute(context, deps, {
      permission: canManageContacts,
      capabilities: [
        "findContactById",
        "findClientById",
        "listContacts",
        "updateContact",
        "appendAuditEvent",
        "withTransaction"
      ],
      onDenied: ({ actor, decision }) =>
        appendDeniedAudit({
          actor,
          actionType: "contact.update_denied",
          sourceEntity: { type: "Contact", id: contactId },
          commandInput: { endpoint: "updateContact", contactId },
          permissionResult: decision,
          error: decision.reason
        })
    });
    if (!auth.ok) return auth.response;
    const { actor, decision, dataSource } = auth.value;

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
    if (parsed.value.email) {
      const existingContacts = await dataSource.listContacts(actor.tenantId);
      if (existingContacts.some((contact) => contact.id !== contactId && contact.email === parsed.value.email)) {
        return context.json({ error: "contact_email_taken" }, 409);
      }
    }

    let contact;
    try {
      contact = await runDataSourceTransaction(async (transactionDataSource) => {
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
    } catch (error) {
      const conflict = crmUniqueConflict(error);
      if (conflict) return context.json({ error: conflict }, 409);
      throw error;
    }

    return context.json({ contact });
  });

  app.get("/api/workspace/products", async (context) => {
    const auth = await authorizeRoute(context, deps, {
      permission: canReadProducts,
      capabilities: ["listProducts"]
    });
    if (!auth.ok) return auth.response;
    const { actor, dataSource } = auth.value;

    return context.json({ products: await dataSource.listProducts(actor.tenantId) });
  });

  app.post("/api/workspace/products", async (context) => {
    const auth = await authorizeRoute(context, deps, {
      permission: canManageProducts,
      capabilities: ["createProduct", "appendAuditEvent", "withTransaction"],
      onDenied: ({ actor, decision }) =>
        appendDeniedAudit({
          actor,
          actionType: "product.create_denied",
          sourceEntity: { type: "Product", id: "unknown" },
          commandInput: { endpoint: "createProduct" },
          permissionResult: decision,
          error: decision.reason
        })
    });
    if (!auth.ok) return auth.response;
    const { actor, decision } = auth.value;

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseProductBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    let product;
    try {
      product = await runDataSourceTransaction(async (transactionDataSource) => {
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
    } catch (error) {
      const conflict = crmUniqueConflict(error);
      if (conflict) return context.json({ error: conflict }, 409);
      throw error;
    }

    return context.json({ product }, 201);
  });

  app.patch("/api/workspace/products/:productId", async (context) => {
    const parsedProductId = parseProductIdParam(context.req.param("productId"));
    if (!parsedProductId.ok) {
      return context.json({ error: parsedProductId.error }, 400);
    }

    const productId = parsedProductId.value;
    const auth = await authorizeRoute(context, deps, {
      permission: canManageProducts,
      capabilities: ["findProductById", "updateProduct", "appendAuditEvent", "withTransaction"],
      onDenied: ({ actor, decision }) =>
        appendDeniedAudit({
          actor,
          actionType: "product.update_denied",
          sourceEntity: { type: "Product", id: productId },
          commandInput: { endpoint: "updateProduct", productId },
          permissionResult: decision,
          error: decision.reason
        })
    });
    if (!auth.ok) return auth.response;
    const { actor, decision, dataSource } = auth.value;

    const beforeState = await dataSource.findProductById(actor.tenantId, productId);
    if (!beforeState) return context.json({ error: "product_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    if (!isObjectBody(body.value)) return context.json({ error: "invalid_body" }, 400);
    const parsed = parseProductBody({ ...body.value, id: productId }, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    let product;
    try {
      product = await runDataSourceTransaction(async (transactionDataSource) => {
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
    } catch (error) {
      const conflict = crmUniqueConflict(error);
      if (conflict) return context.json({ error: conflict }, 409);
      throw error;
    }

    return context.json({ product });
  });

  app.get("/api/workspace/project-types", async (context) => {
    const auth = await authorizeRoute(context, deps, {
      permission: canReadProjectTypes,
      capabilities: ["listProjectTypes"]
    });
    if (!auth.ok) return auth.response;
    const { actor, dataSource } = auth.value;

    return context.json({
      projectTypes: await dataSource.listProjectTypes(actor.tenantId)
    });
  });

  app.post("/api/workspace/project-types", async (context) => {
    const auth = await authorizeRoute(context, deps, {
      permission: canManageProjectTypes,
      capabilities: ["createProjectType", "appendAuditEvent", "withTransaction"],
      onDenied: ({ actor, decision }) =>
        appendDeniedAudit({
          actor,
          actionType: "project_type.create_denied",
          sourceEntity: { type: "ProjectType", id: "unknown" },
          commandInput: { endpoint: "createProjectType" },
          permissionResult: decision,
          error: decision.reason
        })
    });
    if (!auth.ok) return auth.response;
    const { actor, decision } = auth.value;

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

    const projectTypeId = parsedProjectTypeId.value;
    const auth = await authorizeRoute(context, deps, {
      permission: canManageProjectTypes,
      capabilities: [
        "findProjectTypeById",
        "updateProjectType",
        "appendAuditEvent",
        "withTransaction"
      ],
      onDenied: ({ actor, decision }) =>
        appendDeniedAudit({
          actor,
          actionType: "project_type.update_denied",
          sourceEntity: { type: "ProjectType", id: projectTypeId },
          commandInput: { endpoint: "updateProjectType", projectTypeId },
          permissionResult: decision,
          error: decision.reason
        })
    });
    if (!auth.ok) return auth.response;
    const { actor, decision, dataSource } = auth.value;

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

  app.get("/api/workspace/deal-stages", async (context) => {
    const auth = await authorizeRoute(context, deps, {
      permission: canReadDealStages,
      capabilities: ["listDealStages"]
    });
    if (!auth.ok) return auth.response;
    const { actor, dataSource } = auth.value;

    const dealStages = await dataSource.listDealStages(actor.tenantId);
    if (!dataSource.listPipelines) {
      return context.json({ dealStages });
    }
    const defaultPipelineId = `${actor.tenantId}-pipeline-default`;
    const pipelines = await dataSource.listPipelines(actor.tenantId);
    const defaultPipeline =
      pipelines.find((pipeline) => pipeline.isDefault) ??
      pipelines.find((pipeline) => pipeline.id === defaultPipelineId);
    // pipelineId NOT NULL с миграции 0041 — legacy-ветки «бесхозных» стадий удалены.
    if (!defaultPipeline) {
      return context.json({ dealStages: [] });
    }
    return context.json({
      dealStages: dealStages.filter((stage) => stage.pipelineId === defaultPipeline.id)
    });
  });

  app.post("/api/workspace/deal-stages", async (context) => {
    const auth = await authorizeRoute(context, deps, {
      permission: canManageDealStages,
      capabilities: ["createDealStage", "appendAuditEvent", "withTransaction"],
      onDenied: ({ actor, decision }) =>
        appendDeniedAudit({
          actor,
          actionType: "deal_stage.create_denied",
          sourceEntity: { type: "DealStage", id: "unknown" },
          commandInput: { endpoint: "createDealStage" },
          permissionResult: decision,
          error: decision.reason
        })
    });
    if (!auth.ok) return auth.response;
    const { actor, decision, dataSource } = auth.value;

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseDealStageBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    // Legacy clients may still create deal stages without a pipelineId. The canonical
    // storage needs one, so use the tenant default pipeline and create it atomically
    // when old DB fixtures or clean tenants do not have it yet.
    if (parsed.value.pipelineId !== null) {
      if (!dataSource.findPipelineById) {
        return context.json({ error: "persistence_not_configured" }, 501);
      }
      const pipeline = await dataSource.findPipelineById(actor.tenantId, parsed.value.pipelineId);
      if (!pipeline) return context.json({ error: "pipeline_not_found" }, 404);
    } else if (!dataSource.listPipelines || !dataSource.createPipeline) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    let dealStage;
    try {
      dealStage = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createDealStage) {
        throw new Error("transactional_deal_stage_create_not_configured");
      }
      let stageInput = parsed.value;
      if (stageInput.pipelineId === null) {
        if (!transactionDataSource.listPipelines || !transactionDataSource.createPipeline) {
          throw new Error("transactional_default_pipeline_not_configured");
        }
        const defaultPipelineId = `${actor.tenantId}-pipeline-default`;
        const pipelines = await transactionDataSource.listPipelines(actor.tenantId);
        let defaultPipeline =
          pipelines.find((pipeline) => pipeline.isDefault) ??
          pipelines.find((pipeline) => pipeline.id === defaultPipelineId);
        if (!defaultPipeline) {
          const pipelineInput = {
            id: defaultPipelineId,
            tenantId: actor.tenantId,
            name: "Основная воронка",
            description: null,
            isDefault: true,
            sortOrder: 1,
            status: "active" as const
          };
          defaultPipeline = await transactionDataSource.createPipeline(pipelineInput);
          await appendManagementAuditEvent(
            auditInput({
              actor,
              actionType: "pipeline.created",
              sourceEntity: { type: "Pipeline", id: defaultPipeline.id },
              commandInput: { ...pipelineInput, reason: "legacy_deal_stage_default_pipeline" },
              beforeState: null,
              afterState: defaultPipeline,
              permissionResult: decision
            }),
            transactionDataSource
          );
        }
        stageInput = { ...stageInput, pipelineId: defaultPipeline.id };
      }
      const { pipelineId } = stageInput;
      if (pipelineId === null) {
        throw new Error("transactional_deal_stage_without_pipeline");
      }
      const created = await transactionDataSource.createDealStage({ ...stageInput, pipelineId });
      // Денормализованный crm_pipelines.lifecycle_graph_metadata читает first-class CRM API
      // (transition-guard / final-stage / feasibility). Пересобираем в той же транзакции, иначе новая
      // стадия невидима графу до несвязанной first-class мутации (read-model drift).
      if (transactionDataSource.refreshCrmPipelineLifecycleGraph && stageInput.pipelineId) {
        await transactionDataSource.refreshCrmPipelineLifecycleGraph(actor.tenantId, stageInput.pipelineId);
      }
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "deal_stage.created",
          sourceEntity: { type: "DealStage", id: created.id },
          commandInput: stageInput,
          beforeState: null,
          afterState: created,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return created;
      });
    } catch (error) {
      const conflict = crmUniqueConflict(error);
      if (conflict) return context.json({ error: conflict }, 409);
      throw error;
    }

    return context.json({ dealStage }, 201);
  });

  app.patch("/api/workspace/deal-stages/:stageId", async (context) => {
    const parsedStageId = parseDealStageIdParam(context.req.param("stageId"));
    if (!parsedStageId.ok) {
      return context.json({ error: parsedStageId.error }, 400);
    }

    const stageId = parsedStageId.value;
    const auth = await authorizeRoute(context, deps, {
      permission: canManageDealStages,
      capabilities: ["findDealStageById", "updateDealStage", "appendAuditEvent", "withTransaction"],
      onDenied: ({ actor, decision }) =>
        appendDeniedAudit({
          actor,
          actionType: "deal_stage.update_denied",
          sourceEntity: { type: "DealStage", id: stageId },
          commandInput: { endpoint: "updateDealStage", stageId },
          permissionResult: decision,
          error: decision.reason
        })
    });
    if (!auth.ok) return auth.response;
    const { actor, decision, dataSource } = auth.value;

    const beforeState = await dataSource.findDealStageById(actor.tenantId, stageId);
    if (!beforeState) return context.json({ error: "deal_stage_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    if (!isObjectBody(body.value)) return context.json({ error: "invalid_body" }, 400);
    // Мультиворонки: сохраняем существующую воронку стадии. Явный status из body
    // применяем, а при отсутствии поля сохраняем прежний status вместо parser default.
    const patch = body.value;
    const parsed = parseDealStageBody(
      {
        ...patch,
        pipelineId: beforeState.pipelineId,
        status: patch.status ?? beforeState.status,
        id: stageId
      },
      actor.tenantId
    );
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    let dealStage;
    try {
      dealStage = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.updateDealStage) {
        throw new Error("transactional_deal_stage_update_not_configured");
      }
      const updated = await transactionDataSource.updateDealStage({
        ...parsed.value,
        pipelineId: beforeState.pipelineId
      });
      if (transactionDataSource.refreshCrmPipelineLifecycleGraph && beforeState.pipelineId) {
        await transactionDataSource.refreshCrmPipelineLifecycleGraph(actor.tenantId, beforeState.pipelineId);
      }
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "deal_stage.updated",
          sourceEntity: { type: "DealStage", id: updated.id },
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
      const conflict = crmUniqueConflict(error);
      if (conflict) return context.json({ error: conflict }, 409);
      throw error;
    }

    return context.json({ dealStage });
  });

  // Мультиворонки: атомарное переупорядочивание стадий воронки.
  //
  // Почему отдельная ручка, а не N последовательных PATCH /deal-stages/:id: индекс
  // crm_pipeline_stages_tenant_pipeline_sort_order_uidx — immediate (не DEFERRABLE), поэтому
  // перестановка соседей A(1)<->B(2) НЕ выражается последовательностью независимых запросов:
  // любой порядок из двух шагов даёт промежуточное состояние с дублем sort_order → 23505.
  // Здесь весь новый порядок применяется одной транзакцией в две фазы (сначала во временный
  // свободный диапазон, затем в финальные 1..N), поэтому коллизии не возникает ни на одном шаге.
  app.patch("/api/workspace/pipelines/:pipelineId/stage-order", async (context) => {
    const parsedPipelineId = parsePipelineIdParam(context.req.param("pipelineId"));
    if (!parsedPipelineId.ok) {
      return context.json({ error: parsedPipelineId.error }, 400);
    }

    const pipelineId = parsedPipelineId.value;
    const auth = await authorizeRoute(context, deps, {
      permission: canManageDealStages,
      capabilities: ["findPipelineById", "listDealStages", "updateDealStage", "appendAuditEvent", "withTransaction"],
      onDenied: ({ actor, decision }) =>
        appendDeniedAudit({
          actor,
          actionType: "deal_stage.reorder_denied",
          sourceEntity: { type: "Pipeline", id: pipelineId },
          commandInput: { endpoint: "reorderDealStages", pipelineId },
          permissionResult: decision,
          error: decision.reason
        })
    });
    if (!auth.ok) return auth.response;
    const { actor, decision, dataSource } = auth.value;

    if (!dataSource.findPipelineById) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }
    const pipeline = await dataSource.findPipelineById(actor.tenantId, pipelineId);
    if (!pipeline) return context.json({ error: "pipeline_not_found" }, 404);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseDealStageOrderBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const beforeStages = (await dataSource.listDealStages(actor.tenantId))
      .filter((stage) => stage.pipelineId === pipelineId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    // Требуем ПОЛНЫЙ порядок: частичный список оставил бы дыры/дубли sort_order.
    const requested = parsed.value.stageIds;
    const known = new Set(beforeStages.map((stage) => stage.id));
    if (requested.length !== beforeStages.length || requested.some((id) => !known.has(id))) {
      return context.json({ error: "invalid_stage_order" }, 400);
    }

    let dealStages;
    try {
      dealStages = await runDataSourceTransaction(async (transactionDataSource) => {
        if (!transactionDataSource.updateDealStage) {
          throw new Error("transactional_deal_stage_update_not_configured");
        }
        // Перечитываем стадии ВНУТРИ транзакции. Снимок beforeStages снят до неё и уже
        // мог устареть: параллельный PATCH /deal-stages/:id успевает переименовать стадию
        // или сменить её статус, а updateDealStage перезаписывает строку целиком
        // (pipeline_id, name, sort_order, status). Запись устаревшего снимка молча
        // откатывала бы чужой коммит (lost update) и отдавала 200 без следов в аудите.
        const currentStages = (await transactionDataSource.listDealStages(actor.tenantId))
          .filter((stage) => stage.pipelineId === pipelineId)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
        const byId = new Map(currentStages.map((stage) => [stage.id, stage]));
        // Состав стадий тоже мог измениться (создание/удаление/перенос в другую воронку).
        // Фаза 1 рассчитана на ПОЛНЫЙ порядок, поэтому по устаревшему списку не переставляем.
        if (
          currentStages.length !== requested.length ||
          requested.some((stageId) => !byId.has(stageId))
        ) {
          return "stage_order_conflict" as const;
        }
        // Фаза 1 — во временные слоты выше любого занятого, чтобы освободить 1..N.
        const temporaryBase = currentStages.reduce((max, stage) => Math.max(max, stage.sortOrder), 0) + 1;
        for (const [index, stageId] of requested.entries()) {
          const stage = byId.get(stageId)!;
          await transactionDataSource.updateDealStage({ ...stage, sortOrder: temporaryBase + index });
        }
        // Фаза 2 — финальная плотная нумерация 1..N в запрошенном порядке. Берём строку из
        // свежей карты, а не из beforeStages: остальные колонки должны остаться чужими.
        const reordered = [];
        for (const [index, stageId] of requested.entries()) {
          const stage = byId.get(stageId)!;
          reordered.push(await transactionDataSource.updateDealStage({ ...stage, sortOrder: index + 1 }));
        }
        if (transactionDataSource.refreshCrmPipelineLifecycleGraph) {
          await transactionDataSource.refreshCrmPipelineLifecycleGraph(actor.tenantId, pipelineId);
        }
        await appendManagementAuditEvent(
          auditInput({
            actor,
            actionType: "deal_stage.reordered",
            sourceEntity: { type: "Pipeline", id: pipelineId },
            commandInput: { pipelineId, stageIds: requested },
            beforeState: { stageIds: currentStages.map((stage) => stage.id) },
            afterState: { stageIds: requested },
            permissionResult: decision
          }),
          transactionDataSource
        );
        return reordered;
      });
    } catch (error) {
      const conflict = crmUniqueConflict(error);
      if (conflict) return context.json({ error: conflict }, 409);
      throw error;
    }

    // Набор стадий изменился под нами — клиент обязан перечитать воронку и повторить.
    if (dealStages === "stage_order_conflict") {
      return context.json({ error: "stage_order_conflict" }, 409);
    }

    return context.json({ dealStages });
  });

  // Мультиворонки: список воронок (право чтения стадий).
  app.get("/api/workspace/pipelines", async (context) => {
    const auth = await authorizeRoute(context, deps, {
      permission: canReadDealStages,
      capabilities: ["listPipelines"]
    });
    if (!auth.ok) return auth.response;
    const { actor, dataSource } = auth.value;

    return context.json({ pipelines: await dataSource.listPipelines(actor.tenantId) });
  });

  // Мультиворонки: создание воронки (право управления стадиями).
  app.post("/api/workspace/pipelines", async (context) => {
    const auth = await authorizeRoute(context, deps, {
      permission: canManageDealStages,
      capabilities: ["createPipeline", "appendAuditEvent", "withTransaction"],
      onDenied: ({ actor, decision }) =>
        appendDeniedAudit({
          actor,
          actionType: "pipeline.create_denied",
          sourceEntity: { type: "Pipeline", id: "unknown" },
          commandInput: { endpoint: "createPipeline" },
          permissionResult: decision,
          error: decision.reason
        })
    });
    if (!auth.ok) return auth.response;
    const { actor, decision } = auth.value;

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parsePipelineBody(body.value, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const pipeline = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createPipeline) {
        throw new Error("transactional_pipeline_create_not_configured");
      }
      const created = await transactionDataSource.createPipeline(parsed.value);
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "pipeline.created",
          sourceEntity: { type: "Pipeline", id: created.id },
          commandInput: parsed.value,
          beforeState: null,
          afterState: created,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return created;
    });

    return context.json({ pipeline }, 201);
  });

  // Мультиворонки: full-replace воронки (404 если не найдена).
  app.patch("/api/workspace/pipelines/:pipelineId", async (context) => {
    const parsedPipelineId = parsePipelineIdParam(context.req.param("pipelineId"));
    if (!parsedPipelineId.ok) {
      return context.json({ error: parsedPipelineId.error }, 400);
    }

    const pipelineId = parsedPipelineId.value;
    const auth = await authorizeRoute(context, deps, {
      permission: canManageDealStages,
      capabilities: ["findPipelineById", "updatePipeline", "appendAuditEvent", "withTransaction"],
      onDenied: ({ actor, decision }) =>
        appendDeniedAudit({
          actor,
          actionType: "pipeline.update_denied",
          sourceEntity: { type: "Pipeline", id: pipelineId },
          commandInput: { endpoint: "updatePipeline", pipelineId },
          permissionResult: decision,
          error: decision.reason
        })
    });
    if (!auth.ok) return auth.response;
    const { actor, decision, dataSource } = auth.value;

    const beforeState = await dataSource.findPipelineById(actor.tenantId, pipelineId);
    if (!beforeState) return context.json({ error: "pipeline_not_found" }, 404);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    if (!isObjectBody(body.value)) return context.json({ error: "invalid_body" }, 400);
    // Мультиворонки: isDefault/status опциональны в контракте, а парсер дефолтит их
    // (false / "active"). Подмешиваем before-state ДО спреда тела, чтобы частичное
    // обновление (rename/reorder) не сбрасывало флаг дефолта и не реактивировало
    // архивную воронку; явно присланные поля тела по-прежнему перекрывают before-state.
    const parsed = parsePipelineBody(
      {
        isDefault: beforeState.isDefault,
        status: beforeState.status,
        ...body.value,
        id: pipelineId
      },
      actor.tenantId
    );
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const pipeline = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.updatePipeline) {
        throw new Error("transactional_pipeline_update_not_configured");
      }
      const updated = await transactionDataSource.updatePipeline(parsed.value);
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "pipeline.updated",
          sourceEntity: { type: "Pipeline", id: updated.id },
          commandInput: parsed.value,
          beforeState,
          afterState: updated,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return updated;
    });

    return context.json({ pipeline });
  });

  // Мультиворонки: список правил перехода воронки (404 если воронки нет).
  app.get("/api/workspace/pipelines/:pipelineId/stage-transitions", async (context) => {
    const parsedPipelineId = parsePipelineIdParam(context.req.param("pipelineId"));
    if (!parsedPipelineId.ok) {
      return context.json({ error: parsedPipelineId.error }, 400);
    }

    const auth = await authorizeRoute(context, deps, {
      permission: canReadDealStages,
      capabilities: ["findPipelineById", "listStageTransitions"]
    });
    if (!auth.ok) return auth.response;
    const { actor, dataSource } = auth.value;

    const pipelineId = parsedPipelineId.value;
    const pipeline = await dataSource.findPipelineById(actor.tenantId, pipelineId);
    if (!pipeline) return context.json({ error: "pipeline_not_found" }, 404);

    return context.json({
      stageTransitions: await dataSource.listStageTransitions(actor.tenantId, pipelineId)
    });
  });

  // Мультиворонки: создание правила перехода в воронке.
  app.post("/api/workspace/pipelines/:pipelineId/stage-transitions", async (context) => {
    const parsedPipelineId = parsePipelineIdParam(context.req.param("pipelineId"));
    if (!parsedPipelineId.ok) {
      return context.json({ error: parsedPipelineId.error }, 400);
    }

    const pipelineId = parsedPipelineId.value;
    const auth = await authorizeRoute(context, deps, {
      permission: canManageDealStages,
      capabilities: [
        "findPipelineById",
        "findDealStageById",
        "listStageTransitions",
        "createStageTransition",
        "appendAuditEvent",
        "withTransaction"
      ],
      onDenied: ({ actor, decision }) =>
        appendDeniedAudit({
          actor,
          actionType: "stage_transition.create_denied",
          sourceEntity: { type: "StageTransition", id: "unknown" },
          commandInput: { endpoint: "createStageTransition", pipelineId },
          permissionResult: decision,
          error: decision.reason
        })
    });
    if (!auth.ok) return auth.response;
    const { actor, decision, dataSource } = auth.value;

    const pipeline = await dataSource.findPipelineById(actor.tenantId, pipelineId);
    if (!pipeline) return context.json({ error: "pipeline_not_found" }, 404);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseStageTransitionBody(body.value, actor.tenantId, pipelineId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    // Обе стадии должны существовать и принадлежать этой воронке.
    const fromStage = await dataSource.findDealStageById(
      actor.tenantId,
      parsed.value.fromStageId
    );
    if (!fromStage) return context.json({ error: "deal_stage_not_found" }, 404);
    if (fromStage.pipelineId !== pipelineId) {
      return context.json({ error: "stage_not_in_pipeline" }, 400);
    }
    const toStage = await dataSource.findDealStageById(
      actor.tenantId,
      parsed.value.toStageId
    );
    if (!toStage) return context.json({ error: "deal_stage_not_found" }, 404);
    if (toStage.pipelineId !== pipelineId) {
      return context.json({ error: "stage_not_in_pipeline" }, 400);
    }

    // Дубль пары (from,to) в воронке → 409.
    const existing = await dataSource.listStageTransitions(actor.tenantId, pipelineId);
    const hasDuplicate = existing.some(
      (transition) =>
        transition.fromStageId === parsed.value.fromStageId &&
        transition.toStageId === parsed.value.toStageId
    );
    if (hasDuplicate) {
      return context.json({ error: "stage_transition_conflict" }, 409);
    }

    const stageTransition = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createStageTransition) {
        throw new Error("transactional_stage_transition_create_not_configured");
      }
      const created = await transactionDataSource.createStageTransition(parsed.value);
      if (transactionDataSource.refreshCrmPipelineLifecycleGraph) {
        await transactionDataSource.refreshCrmPipelineLifecycleGraph(actor.tenantId, pipelineId);
      }
      await appendManagementAuditEvent(
        auditInput({
          actor,
          actionType: "stage_transition.created",
          sourceEntity: { type: "StageTransition", id: created.id },
          commandInput: parsed.value,
          beforeState: null,
          afterState: created,
          permissionResult: decision
        }),
        transactionDataSource
      );
      return created;
    });

    return context.json({ stageTransition }, 201);
  });

  // Мультиворонки: удаление правила перехода (404 если правила нет).
  app.delete(
    "/api/workspace/pipelines/:pipelineId/stage-transitions/:transitionId",
    async (context) => {
      const parsedPipelineId = parsePipelineIdParam(context.req.param("pipelineId"));
      if (!parsedPipelineId.ok) {
        return context.json({ error: parsedPipelineId.error }, 400);
      }
      const parsedTransitionId = parseStageTransitionIdParam(
        context.req.param("transitionId")
      );
      if (!parsedTransitionId.ok) {
        return context.json({ error: parsedTransitionId.error }, 400);
      }

      const pipelineId = parsedPipelineId.value;
      const transitionId = parsedTransitionId.value;
      const auth = await authorizeRoute(context, deps, {
        permission: canManageDealStages,
        capabilities: [
          "findStageTransitionById",
          "deleteStageTransition",
          "appendAuditEvent",
          "withTransaction"
        ],
        onDenied: ({ actor, decision }) =>
          appendDeniedAudit({
            actor,
            actionType: "stage_transition.delete_denied",
            sourceEntity: { type: "StageTransition", id: transitionId },
            commandInput: { endpoint: "deleteStageTransition", pipelineId, transitionId },
            permissionResult: decision,
            error: decision.reason
          })
      });
      if (!auth.ok) return auth.response;
      const { actor, decision, dataSource } = auth.value;

      const beforeState = await dataSource.findStageTransitionById(
        actor.tenantId,
        transitionId
      );
      // Правило должно существовать и принадлежать указанной воронке.
      if (!beforeState || beforeState.pipelineId !== pipelineId) {
        return context.json({ error: "stage_transition_not_found" }, 404);
      }

      await runDataSourceTransaction(async (transactionDataSource) => {
        if (!transactionDataSource.deleteStageTransition) {
          throw new Error("transactional_stage_transition_delete_not_configured");
        }
        await transactionDataSource.deleteStageTransition(actor.tenantId, transitionId);
        await appendManagementAuditEvent(
          auditInput({
            actor,
            actionType: "stage_transition.deleted",
            sourceEntity: { type: "StageTransition", id: transitionId },
            commandInput: { pipelineId, transitionId },
            beforeState,
            afterState: null,
            permissionResult: decision
          }),
          transactionDataSource
        );
      });

      // OkResponse-контракт: { status: "ok" } (как logout/saved-views delete).
      return context.json({ status: "ok" });
    }
  );

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
