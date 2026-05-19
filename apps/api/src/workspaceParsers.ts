import { isPermission, type AccessProfile } from "@kiss-pm/access-control";
import type { TenantId } from "@kiss-pm/domain";
import type { AccessProfileRecord, PositionRecord, WorkspaceUserRecord } from "./apiTypes";
import {
  getOptionalString,
  getStringField,
  isAccentColor,
  isWorkspaceTheme
} from "./parseHelpers";

type AccessProfileParseResult =
  | {
      ok: true;
      value: Omit<AccessProfileRecord, "tenantId">;
    }
  | {
      ok: false;
      error: string;
    };

export function parseAccessProfileCreateBody(body: unknown): AccessProfileParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body" };
  }

  const candidate = body as Record<string, unknown>;
  const id = candidate.id;
  const name = candidate.name;
  const permissions = candidate.permissions;

  if (typeof id !== "string" || id.trim().length === 0) {
    return { ok: false, error: "invalid_access_profile_id" };
  }

  if (typeof name !== "string" || name.trim().length === 0) {
    return { ok: false, error: "invalid_access_profile_name" };
  }

  if (!Array.isArray(permissions) || !permissions.every(isPermissionValue)) {
    return { ok: false, error: "invalid_permissions" };
  }

  return {
    ok: true,
    value: {
      id,
      name,
      permissions
    }
  };
}

type WorkspaceUserParseResult =
  | {
      ok: true;
      value: Omit<WorkspaceUserRecord, "positionName">;
      password?: string;
    }
  | {
      ok: false;
      error: string;
    };

export function parseWorkspaceUserBody(
  body: unknown,
  tenantId: TenantId,
  userId?: string
): WorkspaceUserParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body" };
  }

  const input = body as Record<string, unknown>;
  const id = userId ?? getOptionalString(input, "id") ?? `user-${crypto.randomUUID()}`;
  const email = getOptionalString(input, "email");
  const name = getOptionalString(input, "name");
  const accessProfileId = getOptionalString(input, "accessProfileId");

  if (!email) return { ok: false, error: "invalid_user_email" };
  if (!name) return { ok: false, error: "invalid_user_name" };
  if (!accessProfileId) return { ok: false, error: "invalid_access_role" };

  const password = getOptionalString(input, "password") ?? undefined;
  const status = getOptionalString(input, "status") ?? "active";
  if (!isUserStatus(status)) return { ok: false, error: "invalid_user_status" };
  const theme = getOptionalString(input, "theme") ?? "light";
  const accentColor = getOptionalString(input, "accentColor") ?? "#0f766e";
  if (!isWorkspaceTheme(theme)) return { ok: false, error: "invalid_theme" };
  if (!isAccentColor(accentColor)) return { ok: false, error: "invalid_accent_color" };

  return {
    ok: true,
    ...(password ? { password } : {}),
    value: {
      id,
      tenantId,
      email: email.toLowerCase(),
      name,
      accessProfileId,
      positionId: getOptionalString(input, "positionId"),
      phone: getOptionalString(input, "phone"),
      telegram: getOptionalString(input, "telegram"),
      status,
      theme,
      accentColor: accentColor.toLowerCase()
    }
  };
}

export function parseWorkspaceUserPatchBody(
  body: unknown,
  tenantId: TenantId,
  userId: string,
  current: WorkspaceUserRecord
): WorkspaceUserParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body" };
  }

  const input = body as Record<string, unknown>;
  const emailInput = getStringField(input, "email");
  const nameInput = getStringField(input, "name");
  const accessProfileInput = getStringField(input, "accessProfileId");
  const positionInput = getStringField(input, "positionId");
  const phoneInput = getStringField(input, "phone");
  const telegramInput = getStringField(input, "telegram");
  const statusInput = getStringField(input, "status");
  const themeInput = getStringField(input, "theme");
  const accentInput = getStringField(input, "accentColor");

  const email = emailInput === undefined ? current.email : emailInput.toLowerCase();
  const name = nameInput === undefined ? current.name : nameInput;
  const accessProfileId =
    accessProfileInput === undefined ? current.accessProfileId : accessProfileInput;
  const status = statusInput === undefined ? current.status : statusInput || current.status;
  const theme = themeInput === undefined || themeInput === "" ? current.theme : themeInput;
  const accentColor =
    accentInput === undefined || accentInput === "" ? current.accentColor : accentInput;

  if (!email) return { ok: false, error: "invalid_user_email" };
  if (!name) return { ok: false, error: "invalid_user_name" };
  if (!accessProfileId) return { ok: false, error: "invalid_access_role" };
  if (!isUserStatus(status)) return { ok: false, error: "invalid_user_status" };
  if (!isWorkspaceTheme(theme)) return { ok: false, error: "invalid_theme" };
  if (!isAccentColor(accentColor)) return { ok: false, error: "invalid_accent_color" };

  return {
    ok: true,
    value: {
      id: userId,
      tenantId,
      email,
      name,
      accessProfileId,
      positionId:
        positionInput === undefined ? current.positionId : positionInput || null,
      phone: phoneInput === undefined ? current.phone : phoneInput || null,
      telegram: telegramInput === undefined ? current.telegram : telegramInput || null,
      status,
      theme,
      accentColor: accentColor.toLowerCase()
    }
  };
}

type PositionParseResult =
  | {
      ok: true;
      value: PositionRecord;
    }
  | {
      ok: false;
      error: string;
    };

export function parsePositionBody(
  body: unknown,
  tenantId: TenantId,
  positionId?: string
): PositionParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body" };
  }

  const input = body as Record<string, unknown>;
  const id = positionId ?? getOptionalString(input, "id") ?? `position-${crypto.randomUUID()}`;
  const name = getOptionalString(input, "name");

  if (!name) return { ok: false, error: "invalid_position_name" };

  return {
    ok: true,
    value: {
      id,
      tenantId,
      name,
      description: getOptionalString(input, "description")
    }
  };
}

function isPermissionValue(value: unknown): value is AccessProfile["permissions"][number] {
  return typeof value === "string" && isPermission(value);
}

function isUserStatus(value: string): value is "active" | "inactive" {
  return value === "active" || value === "inactive";
}
