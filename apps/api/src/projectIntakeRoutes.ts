import {
  canManageOpportunities,
  canManageProjects,
  canManageProjectActivation,
  canReadOpportunities,
  canReadProjects,
  canReadResourceFeasibility,
  type AccessProfile
} from "@kiss-pm/access-control";
import {
  assessOpportunityFeasibility,
  type OpportunityFeasibilityAssessment
} from "@kiss-pm/domain";
import type { TenantUser } from "@kiss-pm/domain";
import type { Hono } from "hono";
import type {
  ApiTenantDataSource,
  ManagementAuditEventInput,
  OpportunityRecord,
  ProjectRecord
} from "./apiTypes";
import {
  parseOpportunityBody,
  parseProjectActivationBody
} from "./projectIntakeParsers";

type ProjectIntakeRouteDeps = {
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

export function registerProjectIntakeRoutes(
  app: Hono,
  deps: ProjectIntakeRouteDeps
) {
  const {
    appendManagementAuditEvent,
    dataSource,
    getActorProfile,
    getSessionActorFromHeaders,
    runDataSourceTransaction
  } = deps;

  app.get("/api/workspace/opportunities", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listOpportunities) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadOpportunities({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({
      opportunities: await dataSource.listOpportunities(actor.tenantId)
    });
  });

  app.post("/api/workspace/opportunities", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.createOpportunity ||
      !dataSource.listOpportunities ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManageOpportunities({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "opportunity.create_denied",
        sourceEntity: { type: "Opportunity", id: "unknown" },
        commandInput: { endpoint: "createOpportunity" },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }

    const body = await context.req.json().catch(() => null);
    const parsed = parseOpportunityBody(body, actor.tenantId);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const existing = await dataSource.listOpportunities(actor.tenantId);
    if (existing.some((opportunity) => opportunity.id === parsed.value.id)) {
      return context.json({ error: "opportunity_id_taken" }, 409);
    }

    const opportunity = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.createOpportunity) {
        throw new Error("transactional_opportunity_create_not_configured");
      }

      const createdOpportunity =
        await transactionDataSource.createOpportunity(parsed.value);
      await appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "opportunity.created",
          sourceWorkflow: "crm_intake",
          sourceEntity: {
            type: "Opportunity",
            id: createdOpportunity.id
          },
          commandInput: parsed.value,
          beforeState: null,
          afterState: createdOpportunity,
          permissionResult: decision
        },
        transactionDataSource
      );

      return createdOpportunity;
    });

    return context.json({ opportunity }, 201);
  });

  app.post("/api/workspace/opportunities/:opportunityId/feasibility", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.findOpportunityById ||
      !dataSource.updateOpportunityFeasibility ||
      !dataSource.listPositions ||
      !dataSource.listWorkspaceUsers ||
      !dataSource.listProjects ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await getActorProfile(actor);
    const feasibilityDecision = canReadResourceFeasibility({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!feasibilityDecision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "opportunity.feasibility_denied",
        sourceEntity: {
          type: "Opportunity",
          id: context.req.param("opportunityId")
        },
        commandInput: { opportunityId: context.req.param("opportunityId") },
        permissionResult: feasibilityDecision,
        error: feasibilityDecision.reason
      });
      return context.json({ error: feasibilityDecision.reason }, 403);
    }
    const manageDecision = canManageOpportunities({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!manageDecision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "opportunity.feasibility_denied",
        sourceEntity: {
          type: "Opportunity",
          id: context.req.param("opportunityId")
        },
        commandInput: { opportunityId: context.req.param("opportunityId") },
        permissionResult: manageDecision,
        error: manageDecision.reason
      });
      return context.json({ error: manageDecision.reason }, 403);
    }

    const opportunity =
      await dataSource.findOpportunityById(actor.tenantId, context.req.param("opportunityId"));
    if (!opportunity) return context.json({ error: "opportunity_not_found" }, 404);
    if (isFinalOpportunityStatus(opportunity.status)) {
      return context.json({ error: "opportunity_not_feasible" }, 409);
    }

    const assessment = await buildFeasibilityAssessment(dataSource, actor.tenantId, opportunity);
    const nextStatus = assessment.status === "ok" || assessment.status === "warning"
      ? "ready_to_activate"
      : "feasibility";

    const updatedOpportunity = await runDataSourceTransaction(
      async (transactionDataSource) => {
        if (!transactionDataSource.updateOpportunityFeasibility) {
          throw new Error("transactional_opportunity_feasibility_not_configured");
        }

        const updated = await transactionDataSource.updateOpportunityFeasibility({
          tenantId: actor.tenantId,
          opportunityId: opportunity.id,
          status: nextStatus,
          feasibilityStatus: assessment.status,
          feasibilityResult: assessment as unknown as Record<string, unknown>
        });
        await appendManagementAuditEvent(
          {
            tenantId: actor.tenantId,
            actorUserId: actor.id,
            actionType: "opportunity.feasibility_checked",
            sourceWorkflow: "crm_intake",
            sourceEntity: {
              type: "Opportunity",
              id: opportunity.id
            },
            commandInput: { opportunityId: opportunity.id },
            beforeState: opportunity,
            afterState: updated,
            permissionResult: manageDecision
          },
          transactionDataSource
        );

        return updated;
      }
    );

    return context.json({
      opportunity: updatedOpportunity,
      assessment
    });
  });

  app.post("/api/workspace/opportunities/:opportunityId/activate", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.findOpportunityById ||
      !dataSource.activateProjectFromOpportunity ||
      !dataSource.lockTenantResourcePlanning ||
      !dataSource.listPositions ||
      !dataSource.listWorkspaceUsers ||
      !dataSource.listProjects ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const profile = await getActorProfile(actor);
    const decision = canManageProjectActivation({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "project.activation_denied",
        sourceEntity: {
          type: "Opportunity",
          id: context.req.param("opportunityId")
        },
        commandInput: { opportunityId: context.req.param("opportunityId") },
        permissionResult: decision,
        error: decision.reason
      });
      return context.json({ error: decision.reason }, 403);
    }
    const projectDecision = canManageProjects({
      actor,
      profile,
      targetTenantId: actor.tenantId
    });
    if (!projectDecision.allowed) {
      await appendDeniedAudit({
        actor,
        actionType: "project.activation_denied",
        sourceEntity: {
          type: "Opportunity",
          id: context.req.param("opportunityId")
        },
        commandInput: { opportunityId: context.req.param("opportunityId") },
        permissionResult: projectDecision,
        error: projectDecision.reason
      });
      return context.json({ error: projectDecision.reason }, 403);
    }

    const body = await context.req.json().catch(() => ({}));
    const parsed = parseProjectActivationBody(body);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const opportunity =
      await dataSource.findOpportunityById(actor.tenantId, context.req.param("opportunityId"));
    if (!opportunity) return context.json({ error: "opportunity_not_found" }, 404);

    const activation = await runDataSourceTransaction(async (transactionDataSource) => {
      if (
        !transactionDataSource.activateProjectFromOpportunity ||
        !transactionDataSource.findOpportunityById ||
        !transactionDataSource.lockTenantResourcePlanning
      ) {
        throw new Error("transactional_project_activation_not_configured");
      }

      await transactionDataSource.lockTenantResourcePlanning(actor.tenantId);

      const currentOpportunity = await transactionDataSource.findOpportunityById(
        actor.tenantId,
        opportunity.id
      );
      if (!currentOpportunity) {
        return { ok: false as const, error: "opportunity_not_found", status: 404 as const };
      }
      if (isFinalOpportunityStatus(currentOpportunity.status)) {
        return {
          ok: false as const,
          error: "opportunity_not_activatable",
          status: 409 as const
        };
      }
      if (!currentOpportunity.feasibilityStatus) {
        return { ok: false as const, error: "feasibility_required", status: 400 as const };
      }

      const currentAssessment = await buildFeasibilityAssessment(
        transactionDataSource,
        actor.tenantId,
        currentOpportunity
      );
      if (currentAssessment.status === "blocked") {
        return {
          ok: false as const,
          error: "opportunity_not_activatable",
          status: 409 as const
        };
      }
      if (currentAssessment.status === "conflict" && !parsed.value.acceptedRiskReason) {
        return {
          ok: false as const,
          error: "risk_acceptance_required",
          status: 409 as const
        };
      }

      const activatedProject =
        await transactionDataSource.activateProjectFromOpportunity({
          id: parsed.value.id,
          tenantId: actor.tenantId,
          sourceOpportunityId: currentOpportunity.id,
          title: currentOpportunity.title,
          clientName: currentOpportunity.clientName,
          status: "active",
          plannedStart: currentOpportunity.plannedStart,
          plannedFinish: currentOpportunity.plannedFinish,
          contractValue: currentOpportunity.contractValue,
          plannedHours: currentOpportunity.plannedHours,
          templateId: currentOpportunity.templateId,
          demand: currentOpportunity.demand
        });
      await appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "project.activated",
          sourceWorkflow: "crm_intake",
          sourceEntity: {
            type: "Project",
            id: activatedProject.id
          },
          commandInput: {
            opportunityId: currentOpportunity.id,
            projectId: activatedProject.id,
            acceptedRiskReason: parsed.value.acceptedRiskReason,
            currentFeasibilityStatus: currentAssessment.status
          },
          beforeState: currentOpportunity,
          afterState: activatedProject,
          permissionResult: decision
        },
        transactionDataSource
      );

      return { ok: true as const, project: activatedProject };
    }).catch((error: unknown) => {
      if (isSingleUseActivationError(error)) {
        return {
          ok: false as const,
          error: "opportunity_not_activatable",
          status: 409 as const
        };
      }

      throw error;
    });
    if (!activation.ok) {
      return context.json({ error: activation.error }, activation.status);
    }

    return context.json({ project: activation.project }, 201);
  });

  app.get("/api/workspace/projects", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.listProjects) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canReadProjects({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    return context.json({
      projects: (await dataSource.listProjects(actor.tenantId)).filter(
        (project) => project.status === "active"
      )
    });
  });

  async function appendDeniedAudit(input: {
    actor: TenantUser;
    actionType: string;
    sourceEntity: {
      type: string;
      id: string;
    };
    commandInput: Record<string, unknown>;
    permissionResult: Record<string, unknown>;
    error: string;
  }) {
    await appendManagementAuditEvent({
      tenantId: input.actor.tenantId,
      actorUserId: input.actor.id,
      actionType: input.actionType,
      sourceWorkflow: "crm_intake",
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

function isFinalOpportunityStatus(status: string): boolean {
  return status === "converted" || status === "rejected";
}

function isSingleUseActivationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  return (
    error.message === "source_opportunity_already_activated" ||
    error.message.includes("projects_tenant_source_opportunity_uidx")
  );
}

async function buildFeasibilityAssessment(
  dataSource: ApiTenantDataSource,
  tenantId: string,
  opportunity: OpportunityRecord
): Promise<OpportunityFeasibilityAssessment> {
  const positions = await dataSource.listPositions?.(tenantId) ?? [];
  const users = await dataSource.listWorkspaceUsers?.(tenantId) ?? [];
  const projects = await dataSource.listProjects?.(tenantId) ?? [];

  return assessOpportunityFeasibility({
    opportunity,
    demand: opportunity.demand,
    positions: positions.map((position) => ({
      id: position.id,
      name: position.name,
      activeUsers: users.filter(
        (user) => user.positionId === position.id && user.status === "active"
      ).length
    })),
    activeProjectReservations: projects
      .filter((project) => project.status === "active")
      .flatMap((project: ProjectRecord) =>
        project.demand.map((line) => ({
          projectId: project.id,
          positionId: line.positionId,
          requiredHours: line.requiredHours,
          plannedStart: project.plannedStart,
          plannedFinish: project.plannedFinish
        }))
      )
  });
}
