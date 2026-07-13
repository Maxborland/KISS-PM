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
import { withActor } from "./withActor";
import type { ApiApp, ApiRouteDeps } from "./routeTypes";

export function registerProfileRoutes(app: ApiApp, deps: ApiRouteDeps) {
  const {
    appendManagementAuditEvent,
    dataSource,
    getActorProfile,
    getSessionActorFromHeaders,
    runDataSourceTransaction
  } = deps;

  app.patch("/api/profile", async (context) => {
    const actor = await getSessionActorFromHeaders(
      context.req.header("cookie") ?? null
    );
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (
      !dataSource.updateWorkspaceUser ||
      !dataSource.listWorkspaceUsers ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
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
    const nameInput = parseProfileTextField(body.value, "name", 120);
    const phoneInput = parseProfileTextField(body.value, "phone", 64);
    const telegramInput = parseProfileTextField(body.value, "telegram", 64);
    if (!nameInput.ok || !phoneInput.ok || !telegramInput.ok) {
      return context.json({ error: "invalid_profile_payload" }, 400);
    }

    const user = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.updateWorkspaceUser) {
        throw new Error("transactional_profile_update_not_configured");
      }

      const updatedUser = await transactionDataSource.updateWorkspaceUser({
        ...current,
        name:
          nameInput.value === undefined || nameInput.value.length === 0
            ? current.name
            : nameInput.value,
        phone: phoneInput.value === undefined ? current.phone : phoneInput.value || null,
        telegram:
          telegramInput.value === undefined ? current.telegram : telegramInput.value || null
      });
      await appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "profile.updated",
          sourceWorkflow: "single_workspace_profile",
          sourceEntity: {
            type: "TenantUser",
            id: actor.id
          },
          commandInput: {
            name: nameInput.value,
            phone: phoneInput.value,
            telegram: telegramInput.value
          },
          beforeState: current,
          afterState: updatedUser,
          permissionResult: decision
        },
        transactionDataSource
      );

      return updatedUser;
    });

    return context.json({ user });
  });

  // withActor: актор резолвится в combinator, 401 короткозамыкается там. Профиль/501 — как раньше (лениво,
  // fail-closed на persistence ДО профиля сохраняется).
  app.patch("/api/profile/theme", withActor(deps, async (context, actor) => {
    if (
      !dataSource.updateWorkspaceUser ||
      !dataSource.listWorkspaceUsers ||
      !dataSource.withTransaction ||
      !dataSource.appendAuditEvent
    ) {
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

    const user = await runDataSourceTransaction(async (transactionDataSource) => {
      if (!transactionDataSource.updateWorkspaceUser) {
        throw new Error("transactional_profile_theme_update_not_configured");
      }

      const updatedUser = await transactionDataSource.updateWorkspaceUser({
        ...current,
        theme,
        accentColor: accentColor.toLowerCase()
      });
      await appendManagementAuditEvent(
        {
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
          afterState: updatedUser,
          permissionResult: decision
        },
        transactionDataSource
      );

      return updatedUser;
    });

    return context.json({ user });
  }));

  app.post("/api/profile/deactivation-request", withActor(deps, async (context, actor) => {
    if (!dataSource.withTransaction || !dataSource.appendAuditEvent) {
      return context.json({ error: "persistence_not_configured" }, 501);
    }

    const requestedAt = new Date().toISOString();
    await runDataSourceTransaction(async (transactionDataSource) => {
      await appendManagementAuditEvent(
        {
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: "profile.deactivation_requested",
          sourceWorkflow: "profile_offboarding_request",
          sourceEntity: {
            type: "TenantUser",
            id: actor.id
          },
          commandInput: {
            requestedAt
          },
          beforeState: {
            requestStatus: "none"
          },
          afterState: {
            requestStatus: "recorded"
          },
          permissionResult: {
            allowed: true,
            scope: "self"
          }
        },
        transactionDataSource
      );
    });

    return context.json({ status: "recorded", requestedAt }, 202);
  }));

}
type ProfileTextFieldParseResult =
  | { ok: true; value: string | undefined }
  | { ok: false };

function parseProfileTextField(
  input: unknown,
  key: string,
  maxLength: number
): ProfileTextFieldParseResult {
  if (!input || typeof input !== "object" || !(key in input)) {
    return { ok: true, value: undefined };
  }

  const value = (input as Record<string, unknown>)[key];
  // SHELL-10: null трактуем как «очистить поле» (клиент шлёт null при стирании
  // телефона/telegram) — эквивалент пустой строки, а не invalid_profile_payload.
  if (value === null) return { ok: true, value: "" };
  if (typeof value !== "string") return { ok: false };
  if (/[\u0000-\u001f\u007f]/.test(value)) return { ok: false };

  const trimmed = value.trim();
  if (trimmed.length > maxLength) return { ok: false };

  return { ok: true, value: trimmed };
}
