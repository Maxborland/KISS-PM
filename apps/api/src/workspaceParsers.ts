import { isPermission, type AccessProfile } from "@kiss-pm/access-control";
import type { TenantId } from "@kiss-pm/domain";
import type { AccessProfileRecord, PositionRecord, WorkspaceUserRecord } from "./apiTypes";
import {
  getOptionalString,
  getStringField,
  isAccentColor,
  isWorkspaceTheme
} from "./parseHelpers";
import {
  parseAccessRoleIdParam,
  parsePositionIdParam,
  parseUserIdParam
} from "./routeParamParsers";

const maxWorkspaceUserEmailLength = 254;
const maxWorkspaceNameLength = 160;
const maxWorkspaceContactLength = 80;
const maxWorkspaceDescriptionLength = 1_000;
const maxWorkspacePasswordLength = 1_024;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  const parsedId = parseAccessRoleIdParam(id);
  if (!parsedId.ok) {
    return { ok: false, error: "invalid_access_profile_id" };
  }

  const parsedName = parseSingleLineText(name, maxWorkspaceNameLength);
  if (parsedName === null) {
    return { ok: false, error: "invalid_access_profile_name" };
  }

  if (!Array.isArray(permissions) || !permissions.every(isPermissionValue)) {
    return { ok: false, error: "invalid_permissions" };
  }

  return {
    ok: true,
    value: {
      id: parsedId.value,
      name: parsedName,
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
  const positionId = getOptionalString(input, "positionId");
  const parsedId = parseUserIdParam(id);
  if (!parsedId.ok) return { ok: false, error: parsedId.error };
  const parsedAccessProfileId = parseAccessRoleIdParam(accessProfileId);
  if (!parsedAccessProfileId.ok) return { ok: false, error: "invalid_access_role" };
  const parsedPositionId = parseOptionalPositionId(positionId);
  if (!parsedPositionId.ok) return { ok: false, error: parsedPositionId.error };

  const parsedEmail = parseEmail(email);
  if (parsedEmail === null) return { ok: false, error: "invalid_user_email" };
  const parsedName = parseSingleLineText(name, maxWorkspaceNameLength);
  if (parsedName === null) return { ok: false, error: "invalid_user_name" };

  const password = parseOptionalPassword(input.password);
  if (password === false) return { ok: false, error: "invalid_user_password" };
  const status = getOptionalString(input, "status") ?? "active";
  if (!isUserStatus(status)) return { ok: false, error: "invalid_user_status" };
  const theme = getOptionalString(input, "theme") ?? "light";
  const accentColor = getOptionalString(input, "accentColor") ?? "#0f766e";
  if (!isWorkspaceTheme(theme)) return { ok: false, error: "invalid_theme" };
  if (!isAccentColor(accentColor)) return { ok: false, error: "invalid_accent_color" };
  const phone = parseNullableSingleLineText(input.phone, maxWorkspaceContactLength);
  if (phone === false) return { ok: false, error: "invalid_user_phone" };
  const telegram = parseNullableSingleLineText(input.telegram, maxWorkspaceContactLength);
  if (telegram === false) return { ok: false, error: "invalid_user_telegram" };

  return {
    ok: true,
    ...(password ? { password } : {}),
    value: {
      id: parsedId.value,
      tenantId,
      email: parsedEmail,
      name: parsedName,
      accessProfileId: parsedAccessProfileId.value,
      positionId: parsedPositionId.value,
      phone,
      telegram,
      status,
      theme,
      accentColor: accentColor.toLowerCase()
    }
  };
}

// Тело приглашения сотрудника (POST /api/workspace/invitations): те же поля,
// что и у создания пользователя, НО пароль не принимается, а статус жёстко
// проставляется "inactive" (приглашён, ещё не активировал доступ). Пароль
// сотрудник задаёт сам на /api/auth/invitation/accept.
export function parseWorkspaceInvitationBody(
  body: unknown,
  tenantId: TenantId
): WorkspaceUserParseResult {
  const parsed = parseWorkspaceUserBody(body, tenantId);
  if (!parsed.ok) return parsed;
  return { ok: true, value: { ...parsed.value, status: "inactive" } };
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
  const parsedUserId = parseUserIdParam(userId);
  if (!parsedUserId.ok) return { ok: false, error: parsedUserId.error };
  const parsedAccessProfileId = parseAccessRoleIdParam(accessProfileId);
  if (!parsedAccessProfileId.ok) return { ok: false, error: "invalid_access_role" };
  const parsedPositionId =
    positionInput === undefined
      ? parseOptionalPositionId(current.positionId)
      : parseOptionalPositionId(positionInput || null);
  if (!parsedPositionId.ok) return { ok: false, error: parsedPositionId.error };
  const status = statusInput === undefined ? current.status : statusInput || current.status;
  const theme = themeInput === undefined || themeInput === "" ? current.theme : themeInput;
  const accentColor =
    accentInput === undefined || accentInput === "" ? current.accentColor : accentInput;

  const parsedEmail = parseEmail(email);
  if (parsedEmail === null) return { ok: false, error: "invalid_user_email" };
  const parsedName = parseSingleLineText(name, maxWorkspaceNameLength);
  if (parsedName === null) return { ok: false, error: "invalid_user_name" };
  if (!isUserStatus(status)) return { ok: false, error: "invalid_user_status" };
  if (!isWorkspaceTheme(theme)) return { ok: false, error: "invalid_theme" };
  if (!isAccentColor(accentColor)) return { ok: false, error: "invalid_accent_color" };
  const phone =
    phoneInput === undefined
      ? current.phone
      : parseNullableSingleLineText(phoneInput, maxWorkspaceContactLength);
  if (phone === false) return { ok: false, error: "invalid_user_phone" };
  const telegram =
    telegramInput === undefined
      ? current.telegram
      : parseNullableSingleLineText(telegramInput, maxWorkspaceContactLength);
  if (telegram === false) return { ok: false, error: "invalid_user_telegram" };

  return {
    ok: true,
    value: {
      id: parsedUserId.value,
      tenantId,
      email: parsedEmail,
      name: parsedName,
      accessProfileId: parsedAccessProfileId.value,
      positionId: parsedPositionId.value,
      phone,
      telegram,
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
  const parsedId = parsePositionIdParam(id);
  if (!parsedId.ok) return { ok: false, error: parsedId.error };

  const parsedName = parseSingleLineText(name, maxWorkspaceNameLength);
  if (parsedName === null) return { ok: false, error: "invalid_position_name" };
  const description = parseNullableMultilineText(
    input.description,
    maxWorkspaceDescriptionLength
  );
  if (description === false) return { ok: false, error: "invalid_position_description" };

  return {
    ok: true,
    value: {
      id: parsedId.value,
      tenantId,
      name: parsedName,
      description
    }
  };
}

function parseOptionalPositionId(value: string | null): { ok: true; value: string | null } | { ok: false; error: string } {
  if (!value) return { ok: true, value: null };
  const parsed = parsePositionIdParam(value);
  if (!parsed.ok) return parsed;
  return { ok: true, value: parsed.value };
}

function isPermissionValue(value: unknown): value is AccessProfile["permissions"][number] {
  return typeof value === "string" && isPermission(value);
}

function isUserStatus(value: string): value is "active" | "inactive" {
  return value === "active" || value === "inactive";
}

function parseEmail(value: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length < 3 ||
    normalized.length > maxWorkspaceUserEmailLength ||
    !emailPattern.test(normalized) ||
    hasUnsafeSingleLineControl(normalized)
  ) {
    return null;
  }
  return normalized;
}

function parseSingleLineText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > maxLength ||
    hasUnsafeSingleLineControl(normalized)
  ) {
    return null;
  }
  return normalized;
}

function parseNullableSingleLineText(
  value: unknown,
  maxLength: number
): string | null | false {
  if (value === null || value === undefined) return null;
  const parsed = parseSingleLineText(value, maxLength);
  if (parsed === null) {
    return typeof value === "string" && value.trim().length === 0 ? null : false;
  }
  return parsed;
}

function parseNullableMultilineText(
  value: unknown,
  maxLength: number
): string | null | false {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  if (normalized.length === 0) return null;
  if (normalized.length > maxLength || hasUnsafeMultilineControl(normalized)) {
    return false;
  }
  return normalized;
}

function parseOptionalPassword(value: unknown): string | undefined | false {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string") return false;
  if (
    value.length === 0 ||
    value.length > maxWorkspacePasswordLength ||
    hasUnsafePasswordControl(value)
  ) {
    return false;
  }
  return value;
}

function hasUnsafeSingleLineControl(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

function hasUnsafeMultilineControl(value: string): boolean {
  return /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}

function hasUnsafePasswordControl(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}
