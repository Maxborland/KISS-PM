import { isBlockingValidationIssue } from "@kiss-pm/domain";
import type { Hono } from "hono";

import { readLimitedJsonBody } from "../jsonBody";
import { parsePlanningCommandBatchEnvelope } from "../planningParsers";
import { previewPlanningCommands } from "./planningCommandCore";
import { createPlanningReadModel } from "./planningReadModel";
import {
  canReadPlanningReadModel,
  includeResourceExceptionsFor
} from "./planningRouteAuth";
import { permissionForCommand } from "./planningCommandPermissions";
import {
  parseProjectRouteParam,
  type PlanningRouteDeps
} from "./planningRouteHelpers";
import { normalizeTaskCreateStatus } from "./taskCreateNormalization";

export function registerPlanningBatchPreviewRoute(
  app: Hono,
  deps: PlanningRouteDeps
) {
  app.post(
    "/api/workspace/projects/:projectId/planning/preview-command-batch",
    async (context) => {
      const parsedProjectId = parseProjectRouteParam(context);
      if (!parsedProjectId.ok) {
        return context.json({ error: parsedProjectId.error }, 400);
      }

      const actor = await deps.getSessionActorFromHeaders(
        context.req.header("cookie") ?? null
      );
      if (!actor) return context.json({ error: "session_required" }, 401);
      if (!deps.dataSource.getPlanSnapshot) {
        return context.json({ error: "persistence_not_configured" }, 501);
      }

      const body = await readLimitedJsonBody(context);
      if (!body.ok) return context.json({ error: body.error }, body.status);
      const parsed = parsePlanningCommandBatchEnvelope(body.value);
      if (!parsed.ok) return context.json({ error: parsed.error }, 400);

      const profile = await deps.getActorProfile(actor);
      const readDecision = canReadPlanningReadModel({ actor, profile });
      if (!readDecision.allowed) {
        return context.json(
          {
            error: readDecision.reason,
            permissionPreview: readDecision
          },
          403
        );
      }

      const permissionPreviews = parsed.value.commands.map((command) =>
        permissionForCommand(command, actor, profile)
      );
      const denied = permissionPreviews.find((decision) => !decision.allowed);
      if (denied) {
        return context.json(
          {
            error: denied.reason,
            permissionPreview: denied,
            permissionPreviews
          },
          403
        );
      }

      const snapshot = await deps.dataSource.getPlanSnapshot(
        actor.tenantId,
        parsedProjectId.value
      );
      if (!snapshot) return context.json({ error: "project_not_found" }, 404);
      if (snapshot.planVersion !== parsed.value.clientPlanVersion) {
        return context.json(
          {
            error: "plan_version_conflict",
            currentPlanVersion: snapshot.planVersion
          },
          409
        );
      }

      const commands = await Promise.all(
        parsed.value.commands.map((command) =>
          normalizeTaskCreateStatus(deps.dataSource, actor.tenantId, command)
        )
      );
      const preview = await previewPlanningCommands(
        snapshot,
        commands,
        deps.dataSource,
        actor.tenantId
      );
      const blocking = preview.validationIssues.some(isBlockingValidationIssue);
      const readModelOptions = {
        includeResourceExceptions: includeResourceExceptionsFor({ actor, profile })
      };

      return context.json({
        before: createPlanningReadModel(snapshot, readModelOptions),
        after: createPlanningReadModel(preview.nextSnapshot, readModelOptions),
        planDelta: preview.planDelta,
        validationIssues: preview.validationIssues,
        permissionPreviews,
        auditPreview: {
          actionType: "planning.command_batch.applied",
          sourceWorkflow: "planning",
          planVersionBefore: snapshot.planVersion,
          planVersionAfter: blocking
            ? snapshot.planVersion
            : snapshot.planVersion + 1
        }
      });
    }
  );
}
