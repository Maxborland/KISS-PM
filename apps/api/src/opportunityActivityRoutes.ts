import {
  canManageOpportunities,
  canReadAuditEvents,
  canReadOpportunities,
  type AccessProfile,
  type PolicyDecision
} from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";
import type { OpportunityActivityRecord } from "@kiss-pm/persistence";
import type { Hono } from "hono";
import { randomUUID } from "node:crypto";

import type {
  ApiTenantDataSource,
  AuditEventListItem,
  ManagementAuditEventInput,
  OpportunityRecord
} from "./apiTypes";
import { readLimitedJsonBody } from "./jsonBody";
import {
  parseCreateOpportunityCommentBody,
  parseCreateOpportunityTaskBody,
  parseUpdateOpportunityTaskBody
} from "./opportunityActivityParsers";
import { isFinalOpportunityStatus } from "./projectIntakeService/opportunityStatus";

type OpportunityActivityRouteDeps = {
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

type RedactedOpportunitySystemEvent = {
  id: string;
  actorUserId: string;
  actionType: string;
  sourceWorkflow: string | null;
  createdAt: string;
  executionStatus: unknown;
};

export function registerOpportunityActivityRoutes(
  app: Hono,
  deps: OpportunityActivityRouteDeps
) {
  const {
    dataSource,
    getActorProfile,
    getSessionActorFromHeaders
  } = deps;

  app.get("/api/workspace/opportunities/:opportunityId/activity", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.findOpportunityById || !dataSource.listOpportunityActivities) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await getActorProfile(actor);
    const readDecision = canReadOpportunities({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!readDecision.allowed) return context.json({ error: readDecision.reason }, 403);

    const opportunityId = context.req.param("opportunityId");
    const opportunity = await dataSource.findOpportunityById(
      actor.tenantId,
      opportunityId
    );
    if (!opportunity) return context.json({ error: "opportunity_not_found" }, 404);

    const activities = await dataSource.listOpportunityActivities(
      actor.tenantId,
      opportunity.id
    );
    const auditEvents = (await dataSource.listAuditEventsByTenantId?.(actor.tenantId)) ?? [];
    const scopedAuditEvents = filterAuditEventsForOpportunity(auditEvents, opportunity.id);
    const visibleSystemEvents = scopedAuditEvents.filter(
      (event) => event.executionResult.status === "succeeded"
    );
    const auditDecision = canReadAuditEvents({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });

    return context.json({
      activities: activities.map(serializeOpportunityActivity),
      systemEvents: visibleSystemEvents.map(redactOpportunitySystemEvent),
      canReadRawAudit: auditDecision.allowed,
      auditEvents: auditDecision.allowed
        ? scopedAuditEvents.map(serializeAuditEvent)
        : null
    });
  });

  app.post("/api/workspace/opportunities/:opportunityId/comments", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.findOpportunityById ||
      !dataSource.createOpportunityActivity ||
      !dataSource.appendAuditEvent ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const opportunityId = context.req.param("opportunityId");
    const profile = await getActorProfile(actor);
    const decision = canManageOpportunities({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendDeniedAudit({
        deps,
        actor,
        actionType: "opportunity.comment.create_denied",
        opportunityId,
        commandInput: { endpoint: "createOpportunityComment", opportunityId },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const opportunity = await findTenantOpportunity(dataSource, actor, opportunityId);
    if (!opportunity) return context.json({ error: "opportunity_not_found" }, 404);
    if (isFinalOpportunityStatus(opportunity.status)) {
      return context.json({ error: "opportunity_activity_locked" }, 409);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCreateOpportunityCommentBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const activity = await deps.runDataSourceTransaction(
      async (transactionDataSource) => {
        if (!transactionDataSource.createOpportunityActivity) {
          throw new Error("transactional_opportunity_activity_create_not_configured");
        }
        const created = await transactionDataSource.createOpportunityActivity({
          id: `opportunity-activity-${randomUUID()}`,
          tenantId: actor.tenantId,
          opportunityId: opportunity.id,
          type: "comment",
          title: null,
          body: parsed.value.body,
          status: null,
          dueDate: null,
          assigneeUserId: null,
          authorUserId: actor.id
        });
        await appendActivityAudit({
          deps,
          auditDataSource: transactionDataSource,
          actor,
          actionType: "opportunity.comment.created",
          opportunity,
          commandInput: {
            opportunityId: opportunity.id,
            body: parsed.value.body
          },
          beforeState: null,
          afterState: created,
          permissionResult: decision
        });
        return created;
      }
    );

    return context.json({ activity: serializeOpportunityActivity(activity) }, 201);
  });

  app.post("/api/workspace/opportunities/:opportunityId/tasks", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.findOpportunityById ||
      !dataSource.createOpportunityActivity ||
      !dataSource.appendAuditEvent ||
      !dataSource.withTransaction
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const opportunityId = context.req.param("opportunityId");
    const profile = await getActorProfile(actor);
    const decision = canManageOpportunities({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendDeniedAudit({
        deps,
        actor,
        actionType: "opportunity.task.create_denied",
        opportunityId,
        commandInput: { endpoint: "createOpportunityTask", opportunityId },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const opportunity = await findTenantOpportunity(dataSource, actor, opportunityId);
    if (!opportunity) return context.json({ error: "opportunity_not_found" }, 404);
    if (isFinalOpportunityStatus(opportunity.status)) {
      return context.json({ error: "opportunity_activity_locked" }, 409);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseCreateOpportunityTaskBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    if (parsed.value.assigneeUserId) {
      const assigneeIsValid = await isActiveTenantUser(
        dataSource,
        actor.tenantId,
        parsed.value.assigneeUserId
      );
      if (!assigneeIsValid) return context.json({ error: "task_assignee_invalid" }, 400);
    }

    const activity = await deps.runDataSourceTransaction(
      async (transactionDataSource) => {
        if (!transactionDataSource.createOpportunityActivity) {
          throw new Error("transactional_opportunity_activity_create_not_configured");
        }
        const created = await transactionDataSource.createOpportunityActivity({
          id: `opportunity-activity-${randomUUID()}`,
          tenantId: actor.tenantId,
          opportunityId: opportunity.id,
          type: "task",
          title: parsed.value.title,
          body: parsed.value.body,
          status: "todo",
          dueDate: parsed.value.dueDate,
          assigneeUserId: parsed.value.assigneeUserId,
          authorUserId: actor.id
        });
        await appendActivityAudit({
          deps,
          auditDataSource: transactionDataSource,
          actor,
          actionType: "opportunity.task.created",
          opportunity,
          commandInput: {
            opportunityId: opportunity.id,
            title: parsed.value.title,
            dueDate: parsed.value.dueDate?.toISOString() ?? null,
            assigneeUserId: parsed.value.assigneeUserId
          },
          beforeState: null,
          afterState: created,
          permissionResult: decision
        });
        return created;
      }
    );

    return context.json({ activity: serializeOpportunityActivity(activity) }, 201);
  });

  app.patch(
    "/api/workspace/opportunities/:opportunityId/tasks/:activityId",
    async (context) => {
      const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
      if (!actor) return context.json({ error: "session_required" }, 401);
      if (
        !dataSource.findOpportunityById ||
        !dataSource.transitionOpportunityActivityStatus ||
        !dataSource.appendAuditEvent ||
        !dataSource.withTransaction
      ) {
        return context.json({ error: "persistence_not_configured" }, 501);
      }

      const opportunityId = context.req.param("opportunityId");
      const activityId = context.req.param("activityId");
      const profile = await getActorProfile(actor);
      const decision = canManageOpportunities({
        actor,
        profile,
        targetTenantId: actor.tenantId
      });
      if (!decision.allowed) {
        await appendDeniedAudit({
          deps,
          actor,
          actionType: "opportunity.task.update_denied",
          opportunityId,
          commandInput: {
            endpoint: "updateOpportunityTask",
            opportunityId,
            activityId
          },
          permissionResult: decision,
          error: decision.reason
        });
        return context.json({ error: decision.reason }, 403);
      }

      const opportunity = await findTenantOpportunity(dataSource, actor, opportunityId);
      if (!opportunity) return context.json({ error: "opportunity_not_found" }, 404);
      if (isFinalOpportunityStatus(opportunity.status)) {
        return context.json({ error: "opportunity_activity_locked" }, 409);
      }

      const body = await readLimitedJsonBody(context);
      if (!body.ok) return context.json({ error: body.error }, body.status);
      const parsed = parseUpdateOpportunityTaskBody(body.value);
      if (!parsed.ok) return context.json({ error: parsed.error }, 400);

      const transition = await deps.runDataSourceTransaction(
        async (transactionDataSource) => {
          if (!transactionDataSource.transitionOpportunityActivityStatus) {
            throw new Error("transactional_opportunity_activity_update_not_configured");
          }
          const transitionResult =
            await transactionDataSource.transitionOpportunityActivityStatus({
              tenantId: actor.tenantId,
              opportunityId: opportunity.id,
              activityId,
              status: parsed.value.status
            });
          if (!transitionResult.found) return transitionResult;
          if (!transitionResult.changed) return transitionResult;

          const updated = transitionResult.activity;
          const beforeState = transitionResult.beforeState;
          await appendActivityAudit({
            deps,
            auditDataSource: transactionDataSource,
            actor,
            actionType:
              parsed.value.status === "done"
                ? "opportunity.task.completed"
                : "opportunity.task.reopened",
            opportunity,
            commandInput: {
              opportunityId: opportunity.id,
              activityId,
              status: parsed.value.status
            },
            beforeState,
            afterState: updated,
            permissionResult: decision
          });

          return {
            found: true as const,
            activity: updated,
            changed: true
          };
        }
      );

      if (!transition.found) {
        return context.json({ error: "opportunity_task_not_found" }, 404);
      }

      return context.json({ activity: serializeOpportunityActivity(transition.activity) });
    }
  );
}

async function findTenantOpportunity(
  dataSource: ApiTenantDataSource,
  actor: TenantUser,
  opportunityId: string
): Promise<OpportunityRecord | undefined> {
  return dataSource.findOpportunityById?.(actor.tenantId, opportunityId);
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
  deps: OpportunityActivityRouteDeps;
  actor: TenantUser;
  actionType: string;
  opportunityId: string;
  commandInput: Record<string, unknown>;
  permissionResult: PolicyDecision;
  error: string;
}) {
  await input.deps.appendManagementAuditEvent({
    tenantId: input.actor.tenantId,
    actorUserId: input.actor.id,
    actionType: input.actionType,
    sourceWorkflow: "crm_intake",
    sourceEntity: { type: "Opportunity", id: input.opportunityId },
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

async function appendActivityAudit(input: {
  deps: OpportunityActivityRouteDeps;
  auditDataSource: ApiTenantDataSource;
  actor: TenantUser;
  actionType: string;
  opportunity: OpportunityRecord;
  commandInput: Record<string, unknown>;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  permissionResult: PolicyDecision;
}) {
  await input.deps.appendManagementAuditEvent(
    {
      tenantId: input.actor.tenantId,
      actorUserId: input.actor.id,
      actionType: input.actionType,
      sourceWorkflow: "crm_intake",
      sourceEntity: {
        type: "Opportunity",
        id: input.opportunity.id
      },
      commandInput: input.commandInput,
      beforeState: input.beforeState,
      afterState: input.afterState,
      permissionResult: input.permissionResult
    },
    input.auditDataSource
  );
}

function filterAuditEventsForOpportunity(
  auditEvents: AuditEventListItem[],
  opportunityId: string
) {
  return auditEvents.filter(
    (event) =>
      event.sourceEntity?.type === "Opportunity" &&
      event.sourceEntity.id === opportunityId
  );
}

function serializeOpportunityActivity(activity: OpportunityActivityRecord) {
  return {
    ...activity,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
    dueDate: activity.dueDate?.toISOString() ?? null
  };
}

function serializeAuditEvent(event: AuditEventListItem) {
  return {
    ...event,
    createdAt: event.createdAt.toISOString()
  };
}

function redactOpportunitySystemEvent(
  event: AuditEventListItem
): RedactedOpportunitySystemEvent {
  return {
    id: event.id,
    actorUserId: event.actorUserId,
    actionType: event.actionType,
    sourceWorkflow: event.sourceWorkflow,
    createdAt: event.createdAt.toISOString(),
    executionStatus: event.executionResult.status ?? null
  };
}
