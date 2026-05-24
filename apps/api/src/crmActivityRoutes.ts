import {
  canManageClients,
  canManageContacts,
  canManageOpportunities,
  canManageProducts,
  canReadAuditEvents,
  canReadClients,
  canReadContacts,
  canReadOpportunities,
  canReadProducts,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type {
  CrmActivityEntityType,
  CrmActivityRecord
} from "@kiss-pm/persistence";
import type { Context, Hono } from "hono";
import { randomUUID } from "node:crypto";

import type {
  ApiTenantDataSource,
  AuditEventListItem,
  ManagementAuditEventInput
} from "./apiTypes";
import { readLimitedJsonBody } from "./jsonBody";
import {
  parseCreateCrmCommentBody,
  parseCreateCrmFileBody,
  parseCreateCrmTaskBody,
  parseCrmActivityEntityType,
  parseUpdateCrmTaskBody
} from "./crmActivityParsers";
import { serializeAttachment } from "./attachmentSerialization";
import { isFinalOpportunityStatus } from "./projectIntakeService/opportunityStatus";

type CrmActivityRouteDeps = {
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

type RedactedCrmSystemEvent = {
  id: string;
  actorUserId: string;
  actionType: string;
  sourceWorkflow: string | null;
  createdAt: string;
  executionStatus: unknown;
};

type CrmEntityContext = {
  entityId: string;
  entityType: CrmActivityEntityType;
  isLocked: boolean;
  sourceEntityType: "Opportunity" | "Client" | "Contact" | "Product";
};

export function registerCrmActivityRoutes(app: Hono, deps: CrmActivityRouteDeps) {
  app.get("/api/workspace/crm/:entityType/:entityId/activity", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.listCrmActivities) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const entityType = parseEntityTypeParam(context.req.param("entityType"));
    if (!entityType.ok) return context.json({ error: entityType.error }, 400);

    const profile = await deps.getActorProfile(actor);
    const readDecision = readDecisionForEntity({
      actor,
      entityType: entityType.value,
      profile
    });
    if (!readDecision.allowed) return context.json({ error: readDecision.reason }, 403);

    const entity = await resolveCrmEntity({
      actor,
      dataSource: deps.dataSource,
      entityId: context.req.param("entityId"),
      entityType: entityType.value
    });
    if (!entity) return context.json({ error: "crm_entity_not_found" }, 404);

    const activities = await deps.dataSource.listCrmActivities(
      actor.tenantId,
      entity.entityType,
      entity.entityId
    );
    const auditEvents = (await deps.dataSource.listAuditEventsByTenantId?.(actor.tenantId)) ?? [];
    const scopedAuditEvents = filterAuditEventsForCrmEntity(auditEvents, entity);
    const visibleSystemEvents = scopedAuditEvents.filter(
      (event) => event.executionResult.status === "succeeded"
    );
    const auditDecision = canReadAuditEvents({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });

    const attachmentItems = (await deps.dataSource.listAttachmentActivityItems?.({
      tenantId: actor.tenantId,
      entityType: entity.entityType,
      entityId: entity.entityId
    })) ?? [];

    return context.json({
      activities: activities.map(serializeCrmActivity),
      attachmentItems: attachmentItems.map(serializeAttachment),
      systemEvents: visibleSystemEvents.map(redactCrmSystemEvent),
      canReadRawAudit: auditDecision.allowed,
      auditEvents: auditDecision.allowed
        ? scopedAuditEvents.map(serializeAuditEvent)
        : null
    });
  });

  app.post("/api/workspace/crm/:entityType/:entityId/comments", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.createCrmActivity || !deps.dataSource.withTransaction) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const routeContext = await resolveMutationContext(context.req.param("entityType"), {
      actor,
      deps,
      entityId: context.req.param("entityId")
    });
    if ("response" in routeContext) return routeContext.response(context);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCreateCrmCommentBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const activity = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createCrmActivity) {
        throw new Error("transactional_crm_activity_create_not_configured");
      }
      const created = await transactionDataSource.createCrmActivity({
        id: `crm-activity-${randomUUID()}`,
        tenantId: actor.tenantId,
        entityType: routeContext.entity.entityType,
        entityId: routeContext.entity.entityId,
        type: "comment",
        title: null,
        body: parsed.value.body,
        status: null,
        dueDate: null,
        assigneeUserId: null,
        authorUserId: actor.id,
        fileUrl: null,
        fileSizeBytes: null,
        mimeType: null
      });
      if (!created) return undefined;
      await appendActivityAudit({
        actor,
        afterState: created,
        auditDataSource: transactionDataSource,
        beforeState: null,
        commandInput: {
          body: parsed.value.body,
          entityId: routeContext.entity.entityId,
          entityType: routeContext.entity.entityType
        },
        deps,
        entity: routeContext.entity,
        permissionResult: routeContext.decision,
        type: "comment.created"
      });
      return created;
    });

    if (!activity) return context.json({ error: "crm_activity_locked" }, 409);
    return context.json({ activity: serializeCrmActivity(activity) }, 201);
  });

  app.post("/api/workspace/crm/:entityType/:entityId/tasks", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.createCrmActivity || !deps.dataSource.withTransaction) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const routeContext = await resolveMutationContext(context.req.param("entityType"), {
      actor,
      deps,
      entityId: context.req.param("entityId")
    });
    if ("response" in routeContext) return routeContext.response(context);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCreateCrmTaskBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    if (parsed.value.assigneeUserId) {
      const assigneeIsValid = await isActiveTenantUser(
        deps.dataSource,
        actor.tenantId,
        parsed.value.assigneeUserId
      );
      if (!assigneeIsValid) return context.json({ error: "task_assignee_invalid" }, 400);
    }

    const activity = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createCrmActivity) {
        throw new Error("transactional_crm_activity_create_not_configured");
      }
      const created = await transactionDataSource.createCrmActivity({
        id: `crm-activity-${randomUUID()}`,
        tenantId: actor.tenantId,
        entityType: routeContext.entity.entityType,
        entityId: routeContext.entity.entityId,
        type: "task",
        title: parsed.value.title,
        body: parsed.value.body,
        status: "todo",
        dueDate: parsed.value.dueDate,
        assigneeUserId: parsed.value.assigneeUserId,
        authorUserId: actor.id,
        fileUrl: null,
        fileSizeBytes: null,
        mimeType: null
      });
      if (!created) return undefined;
      await appendActivityAudit({
        actor,
        afterState: created,
        auditDataSource: transactionDataSource,
        beforeState: null,
        commandInput: {
          assigneeUserId: parsed.value.assigneeUserId,
          dueDate: parsed.value.dueDate?.toISOString() ?? null,
          entityId: routeContext.entity.entityId,
          entityType: routeContext.entity.entityType,
          title: parsed.value.title
        },
        deps,
        entity: routeContext.entity,
        permissionResult: routeContext.decision,
        type: "task.created"
      });
      return created;
    });

    if (!activity) return context.json({ error: "crm_activity_locked" }, 409);
    return context.json({ activity: serializeCrmActivity(activity) }, 201);
  });

  app.post("/api/workspace/crm/:entityType/:entityId/files", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.createCrmActivity || !deps.dataSource.withTransaction) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const routeContext = await resolveMutationContext(context.req.param("entityType"), {
      actor,
      deps,
      entityId: context.req.param("entityId")
    });
    if ("response" in routeContext) return routeContext.response(context);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCreateCrmFileBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const activity = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createCrmActivity) {
        throw new Error("transactional_crm_activity_create_not_configured");
      }
      const created = await transactionDataSource.createCrmActivity({
        id: `crm-activity-${randomUUID()}`,
        tenantId: actor.tenantId,
        entityType: routeContext.entity.entityType,
        entityId: routeContext.entity.entityId,
        type: "file",
        title: parsed.value.title,
        body: parsed.value.body,
        status: null,
        dueDate: null,
        assigneeUserId: null,
        authorUserId: actor.id,
        fileUrl: parsed.value.fileUrl,
        fileSizeBytes: parsed.value.fileSizeBytes,
        mimeType: parsed.value.mimeType
      });
      if (!created) return undefined;
      await appendActivityAudit({
        actor,
        afterState: created,
        auditDataSource: transactionDataSource,
        beforeState: null,
        commandInput: {
          entityId: routeContext.entity.entityId,
          entityType: routeContext.entity.entityType,
          fileUrl: parsed.value.fileUrl,
          title: parsed.value.title
        },
        deps,
        entity: routeContext.entity,
        permissionResult: routeContext.decision,
        type: "file.created"
      });
      return created;
    });

    if (!activity) return context.json({ error: "crm_activity_locked" }, 409);
    return context.json({ activity: serializeCrmActivity(activity) }, 201);
  });

  app.patch("/api/workspace/crm/:entityType/:entityId/tasks/:activityId", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.transitionCrmActivityStatus || !deps.dataSource.withTransaction) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const routeContext = await resolveMutationContext(context.req.param("entityType"), {
      actor,
      deps,
      entityId: context.req.param("entityId")
    });
    if ("response" in routeContext) return routeContext.response(context);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseUpdateCrmTaskBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const activityId = context.req.param("activityId");
    const transition = await deps.runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.transitionCrmActivityStatus) {
        throw new Error("transactional_crm_activity_update_not_configured");
      }
      const transitionResult = await transactionDataSource.transitionCrmActivityStatus({
        tenantId: actor.tenantId,
        entityType: routeContext.entity.entityType,
        entityId: routeContext.entity.entityId,
        activityId,
        status: parsed.value.status
      });
      if ("locked" in transitionResult) return transitionResult;
      if (!transitionResult.found || !transitionResult.changed) return transitionResult;

      await appendActivityAudit({
        actor,
        afterState: transitionResult.activity,
        auditDataSource: transactionDataSource,
        beforeState: transitionResult.beforeState,
        commandInput: {
          activityId,
          entityId: routeContext.entity.entityId,
          entityType: routeContext.entity.entityType,
          status: parsed.value.status
        },
        deps,
        entity: routeContext.entity,
        permissionResult: routeContext.decision,
        type: parsed.value.status === "done" ? "task.completed" : "task.reopened"
      });

      return transitionResult;
    });

    if ("locked" in transition) {
      return context.json({ error: "crm_activity_locked" }, 409);
    }
    if (!transition.found) return context.json({ error: "crm_task_not_found" }, 404);
    return context.json({ activity: serializeCrmActivity(transition.activity) });
  });
}

function parseEntityTypeParam(value: string) {
  return parseCrmActivityEntityType(value);
}

async function resolveMutationContext(
  entityTypeParam: string,
  input: {
    actor: TenantUser;
    deps: CrmActivityRouteDeps;
    entityId: string;
  }
): Promise<
  | {
      decision: PolicyDecision;
      entity: CrmEntityContext;
    }
  | {
      response: (context: Context) => Response | Promise<Response>;
    }
> {
  const parsedEntityType = parseEntityTypeParam(entityTypeParam);
  if (!parsedEntityType.ok) {
    return {
      response: (context) => context.json({ error: parsedEntityType.error }, 400)
    };
  }

  const profile = await input.deps.getActorProfile(input.actor);
  const decision = manageDecisionForEntity({
    actor: input.actor,
    entityType: parsedEntityType.value,
    profile
  });
  if (!decision.allowed) {
    await appendDeniedAudit({
      actor: input.actor,
      deps: input.deps,
      entityId: input.entityId,
      entityType: parsedEntityType.value,
      error: decision.reason,
      permissionResult: decision
    });
    return {
      response: (context) => context.json({ error: decision.reason }, 403)
    };
  }

  const entity = await resolveCrmEntity({
    actor: input.actor,
    dataSource: input.deps.dataSource,
    entityId: input.entityId,
    entityType: parsedEntityType.value
  });
  if (!entity) {
    return {
      response: (context) => context.json({ error: "crm_entity_not_found" }, 404)
    };
  }
  if (entity.isLocked) {
    return {
      response: (context) => context.json({ error: "crm_activity_locked" }, 409)
    };
  }

  return { decision, entity };
}

async function resolveCrmEntity(input: {
  actor: TenantUser;
  dataSource: ApiTenantDataSource;
  entityId: string;
  entityType: CrmActivityEntityType;
}): Promise<CrmEntityContext | undefined> {
  if (input.entityType === "opportunity") {
    const opportunity = await input.dataSource.findOpportunityById?.(
      input.actor.tenantId,
      input.entityId
    );
    return opportunity
      ? {
          entityId: opportunity.id,
          entityType: "opportunity",
          isLocked: isFinalOpportunityStatus(opportunity.status),
          sourceEntityType: "Opportunity"
        }
      : undefined;
  }
  if (input.entityType === "client") {
    const client = await input.dataSource.findClientById?.(
      input.actor.tenantId,
      input.entityId
    );
    return client
      ? {
          entityId: client.id,
          entityType: "client",
          isLocked: false,
          sourceEntityType: "Client"
        }
      : undefined;
  }
  if (input.entityType === "contact") {
    const contact = await input.dataSource.findContactById?.(
      input.actor.tenantId,
      input.entityId
    );
    return contact
      ? {
          entityId: contact.id,
          entityType: "contact",
          isLocked: false,
          sourceEntityType: "Contact"
        }
      : undefined;
  }

  const product = await input.dataSource.findProductById?.(
    input.actor.tenantId,
    input.entityId
  );
  return product
    ? {
        entityId: product.id,
        entityType: "product",
        isLocked: false,
        sourceEntityType: "Product"
      }
    : undefined;
}

function readDecisionForEntity(input: {
  actor: TenantUser;
  entityType: CrmActivityEntityType;
  profile: AccessProfile;
}): PolicyDecision {
  const policyInput = {
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  };
  if (input.entityType === "opportunity") return canReadOpportunities(policyInput);
  if (input.entityType === "client") return canReadClients(policyInput);
  if (input.entityType === "contact") return canReadContacts(policyInput);
  return canReadProducts(policyInput);
}

function manageDecisionForEntity(input: {
  actor: TenantUser;
  entityType: CrmActivityEntityType;
  profile: AccessProfile;
}): PolicyDecision {
  const policyInput = {
    actor: input.actor,
    profile: input.profile,
    targetTenantId: input.actor.tenantId
  };
  if (input.entityType === "opportunity") return canManageOpportunities(policyInput);
  if (input.entityType === "client") return canManageClients(policyInput);
  if (input.entityType === "contact") return canManageContacts(policyInput);
  return canManageProducts(policyInput);
}

async function isActiveTenantUser(
  dataSource: ApiTenantDataSource,
  tenantId: string,
  userId: string
): Promise<boolean> {
  if (!dataSource.listWorkspaceUsers) return false;
  const user = (await dataSource.listWorkspaceUsers(tenantId)).find(
    (candidate) => candidate.id === userId
  );
  return Boolean(user && user.status !== "inactive");
}

async function appendDeniedAudit(input: {
  actor: TenantUser;
  deps: CrmActivityRouteDeps;
  entityId: string;
  entityType: CrmActivityEntityType;
  error: string;
  permissionResult: PolicyDecision;
}) {
  await input.deps.appendManagementAuditEvent({
    tenantId: input.actor.tenantId,
    actorUserId: input.actor.id,
    actionType: "crm_activity.mutation_denied",
    sourceWorkflow: "crm_activity",
    sourceEntity: { type: getSourceEntityType(input.entityType), id: input.entityId },
    commandInput: {
      entityId: input.entityId,
      entityType: input.entityType
    },
    beforeState: null,
    afterState: null,
    permissionResult: input.permissionResult,
    executionResult: {
      status: "denied",
      error: input.error
    }
  });
}

async function appendActivityAudit(input: {
  actor: TenantUser;
  afterState: Record<string, unknown> | null;
  auditDataSource: ApiTenantDataSource;
  beforeState: Record<string, unknown> | null;
  commandInput: Record<string, unknown>;
  deps: CrmActivityRouteDeps;
  entity: CrmEntityContext;
  permissionResult: PolicyDecision;
  type: string;
}) {
  await input.deps.appendManagementAuditEvent(
    {
      tenantId: input.actor.tenantId,
      actorUserId: input.actor.id,
      actionType: `crm_activity.${input.entity.entityType}.${input.type}`,
      sourceWorkflow: "crm_activity",
      sourceEntity: {
        type: input.entity.sourceEntityType,
        id: input.entity.entityId
      },
      commandInput: input.commandInput,
      beforeState: input.beforeState,
      afterState: input.afterState,
      permissionResult: input.permissionResult
    },
    input.auditDataSource
  );
}

function filterAuditEventsForCrmEntity(
  auditEvents: AuditEventListItem[],
  entity: CrmEntityContext
) {
  return auditEvents.filter(
    (event) =>
      event.sourceEntity?.type === entity.sourceEntityType &&
      event.sourceEntity.id === entity.entityId
  );
}

function getSourceEntityType(entityType: CrmActivityEntityType) {
  if (entityType === "opportunity") return "Opportunity";
  if (entityType === "client") return "Client";
  if (entityType === "contact") return "Contact";
  return "Product";
}

function serializeCrmActivity(activity: CrmActivityRecord) {
  return {
    ...activity,
    createdAt: activity.createdAt.toISOString(),
    dueDate: activity.dueDate?.toISOString() ?? null,
    updatedAt: activity.updatedAt.toISOString()
  };
}

function serializeAuditEvent(event: AuditEventListItem) {
  return {
    ...event,
    createdAt: event.createdAt.toISOString()
  };
}

function redactCrmSystemEvent(event: AuditEventListItem): RedactedCrmSystemEvent {
  return {
    id: event.id,
    actorUserId: event.actorUserId,
    actionType: event.actionType,
    sourceWorkflow: event.sourceWorkflow,
    createdAt: event.createdAt.toISOString(),
    executionStatus: event.executionResult.status ?? null
  };
}
