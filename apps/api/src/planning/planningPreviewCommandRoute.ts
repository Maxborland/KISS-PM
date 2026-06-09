import type { Hono } from "hono";
import { isBlockingValidationIssue } from "@kiss-pm/domain";

import { readLimitedJsonBody } from "../jsonBody";
import { parsePlanningCommandEnvelope } from "../planningParsers";
import { previewPlanningCommand } from "./planningCommandCore";
import { createPlanningReadModel } from "./planningReadModel";
import { canReadPlanningReadModel, permissionForCommand } from "./planningRouteAuth";
import { auditActionForCommand } from "./planningAuditActions";
import {
  errorResponseBody,
  parseProjectRouteParam,
  requireActivePlanningProject,
  validateCommandDataSourcePreconditions,
  type PlanningRouteDeps
} from "./planningRouteHelpers";

export function registerPlanningPreviewCommandRoute(app: Hono, deps: PlanningRouteDeps) {
  app.post("/api/workspace/projects/:projectId/planning/preview-command", async (context) => {
    const parsedProjectId = parseProjectRouteParam(context);
    if (!parsedProjectId.ok) return context.json({ error: parsedProjectId.error }, 400);

    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!deps.dataSource.getPlanSnapshot) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parsePlanningCommandEnvelope(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const profile = await deps.getActorProfile(actor);
    const readDecision = canReadPlanningReadModel({ actor, profile });
    if (!readDecision.allowed) {
      return context.json({
        error: readDecision.reason,
        permissionPreview: readDecision
      }, 403);
    }

    const permissionPreview = permissionForCommand(parsed.value.command, actor, profile);
    if (!permissionPreview.allowed) {
      return context.json({
        error: permissionPreview.reason,
        permissionPreview
      }, 403);
    }

    const activeProject = await requireActivePlanningProject(
      deps.dataSource,
      actor.tenantId,
      parsedProjectId.value
    );
    if (!activeProject.ok) return context.json({ error: activeProject.error }, activeProject.status);
    const snapshot = await deps.dataSource.getPlanSnapshot(actor.tenantId, parsedProjectId.value);
    if (!snapshot) return context.json({ error: "project_not_found" }, 404);
    if (snapshot.planVersion !== parsed.value.clientPlanVersion) {
      return context.json({ error: "plan_version_conflict", currentPlanVersion: snapshot.planVersion }, 409);
    }

    const preview = previewPlanningCommand(snapshot, parsed.value.command);
    const validationIssues = [
      ...preview.validationIssues,
      ...(await validateCommandDataSourcePreconditions(
        deps.dataSource,
        actor.tenantId,
        parsed.value.command
      ))
    ];
    const hasBlockingValidationIssue = validationIssues.some(isBlockingValidationIssue);
    return context.json({
      before: createPlanningReadModel(snapshot),
      after: createPlanningReadModel(preview.nextSnapshot),
      planDelta: preview.planDelta,
      validationIssues,
      permissionPreview,
      auditPreview: {
        actionType: auditActionForCommand(parsed.value.command),
        sourceWorkflow: "planning",
        planVersionBefore: snapshot.planVersion,
        planVersionAfter: hasBlockingValidationIssue ? snapshot.planVersion : snapshot.planVersion + 1
      }
    });
  });

}
