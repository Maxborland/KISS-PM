import type { Hono } from "hono";

import { readLimitedJsonBody } from "../jsonBody";
import { parseProjectTaskStageWriteBody } from "../projectWorkParsers";
import { parseProjectTaskStageIdParam } from "../routeParamParsers";
import type { ProjectWorkRouteDeps } from "../projectWorkRoutes";
import { createProjectTaskStageWorkspace } from "./projectTaskStageWorkspace";

export function registerProjectTaskStageRoutes(app: Hono, deps: ProjectWorkRouteDeps) {
  const { getSessionActorFromHeaders, getActorProfile } = deps;
  const projectTaskStageWorkspace = createProjectTaskStageWorkspace(deps);

  app.get("/api/workspace/project-task-stages", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await getActorProfile(actor);
    const result = await projectTaskStageWorkspace.listProjectTaskStages({ actor, profile });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ projectTaskStages: result.projectTaskStages });
  });

  app.post("/api/workspace/project-task-stages", async (context) => {
    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseProjectTaskStageWriteBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const profile = await getActorProfile(actor);
    const result = await projectTaskStageWorkspace.createProjectTaskStage({
      actor,
      profile,
      value: parsed.value
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ projectTaskStage: result.projectTaskStage }, 201);
  });

  app.patch("/api/workspace/project-task-stages/:stageId", async (context) => {
    const stageId = parseProjectTaskStageIdParam(context.req.param("stageId"));
    if (!stageId.ok) return context.json({ error: stageId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const parsed = parseProjectTaskStageWriteBody(body.value);
    if (!parsed.ok) return context.json({ error: parsed.error }, 400);

    const profile = await getActorProfile(actor);
    const result = await projectTaskStageWorkspace.updateProjectTaskStage({
      actor,
      profile,
      stageId: stageId.value,
      value: parsed.value
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ projectTaskStage: result.projectTaskStage });
  });

  app.delete("/api/workspace/project-task-stages/:stageId", async (context) => {
    const stageId = parseProjectTaskStageIdParam(context.req.param("stageId"));
    if (!stageId.ok) return context.json({ error: stageId.error }, 400);

    const actor = await getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);

    const profile = await getActorProfile(actor);
    const result = await projectTaskStageWorkspace.archiveProjectTaskStage({
      actor,
      profile,
      stageId: stageId.value
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);

    return context.json({ projectTaskStage: result.projectTaskStage });
  });
}
