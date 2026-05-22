import {
  canManageWorkspaceTheme,
  canUpdateProfile
} from "@kiss-pm/access-control";
import {
  getStringField,
  isAccentColor,
  isWorkspaceTheme
} from "./parseHelpers";
import { readLimitedJsonBody } from "./jsonBody";
import type { ApiApp, ApiRouteDeps } from "./routeTypes";

export function registerProfileRoutes(app: ApiApp, deps: ApiRouteDeps) {
  const {
    appendManagementAuditEvent,
    dataSource,
    getActorProfile,
    getSessionActorFromHeaders
  } = deps;

  app.patch("/api/profile", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.updateWorkspaceUser || !dataSource.listWorkspaceUsers) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canUpdateProfile({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const current = (await dataSource.listWorkspaceUsers(actor.tenantId)).find(
      (user) => user.id === actor.id
    );
    if (!current) return context.json({ error: "user_not_found" }, 404);

    const body = await readLimitedJsonBody(context, {});
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const nameInput = getStringField(body.value, "name");
    const phoneInput = getStringField(body.value, "phone");
    const telegramInput = getStringField(body.value, "telegram");
    const user = await dataSource.updateWorkspaceUser({
      ...current,
      name: nameInput === undefined || nameInput.length === 0 ? current.name : nameInput,
      phone: phoneInput === undefined ? current.phone : phoneInput || null,
      telegram: telegramInput === undefined ? current.telegram : telegramInput || null
    });
    await appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "profile.updated",
      sourceWorkflow: "single_workspace_profile",
      sourceEntity: {
        type: "TenantUser",
        id: actor.id
      },
      commandInput: {
        name: nameInput,
        phone: phoneInput,
        telegram: telegramInput
      },
      beforeState: current,
      afterState: user,
      permissionResult: decision
    });

    return context.json({ user });
  });

  app.patch("/api/profile/theme", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!dataSource.updateWorkspaceUser || !dataSource.listWorkspaceUsers) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const decision = canManageWorkspaceTheme({
      actor,
      profile: await getActorProfile(actor),
      targetTenantId: actor.tenantId
    });
    if (!decision.allowed) return context.json({ error: decision.reason }, 403);

    const current = (await dataSource.listWorkspaceUsers(actor.tenantId)).find(
      (user) => user.id === actor.id
    );
    if (!current) return context.json({ error: "user_not_found" }, 404);
    const body = await readLimitedJsonBody(context, {});
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const themeInput = getStringField(body.value, "theme");
    const accentInput = getStringField(body.value, "accentColor");
    const theme = themeInput === undefined || themeInput === "" ? current.theme : themeInput;
    const accentColor =
      accentInput === undefined || accentInput === "" ? current.accentColor : accentInput;

    if (!isWorkspaceTheme(theme)) return context.json({ error: "invalid_theme" }, 400);
    if (!isAccentColor(accentColor)) {
      return context.json({ error: "invalid_accent_color" }, 400);
    }

    const user = await dataSource.updateWorkspaceUser({
      ...current,
      theme,
      accentColor: accentColor.toLowerCase()
    });
    await appendManagementAuditEvent({
      tenantId: actor.tenantId,
      actorUserId: actor.id,
      actionType: "profile.theme.updated",
      sourceWorkflow: "single_workspace_theme",
      sourceEntity: {
        type: "TenantUser",
        id: actor.id
      },
      commandInput: {
        theme,
        accentColor: accentColor.toLowerCase()
      },
      beforeState: current,
      afterState: user,
      permissionResult: decision
    });

    return context.json({ user });
  });
}
