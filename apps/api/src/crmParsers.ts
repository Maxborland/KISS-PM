import type {
  ClientInput,
  ContactInput,
  DealStageInput,
  ProjectTypeInput
} from "./apiTypes";
import { getOptionalString } from "./parseHelpers";

type ParseResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: string;
    };

const idPattern = /^[a-z][a-z0-9-]{2,80}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const maxPostgresInteger = 2_147_483_647;
const maxLengths = {
  name: 160,
  description: 1_000,
  email: 160,
  phone: 80,
  telegram: 80,
  role: 120
} as const;

export function parseClientBody(
  body: unknown,
  tenantId: string
): ParseResult<ClientInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const input = body as Record<string, unknown>;
  const id = getOptionalString(input, "id") ?? `client-${crypto.randomUUID()}`;
  const name = getOptionalString(input, "name");
  const description = getOptionalString(input, "description") ?? null;
  const status = parseStatus(getOptionalString(input, "status") ?? "active");

  if (!isId(id)) return { ok: false, error: "invalid_client_id" };
  if (!name || name.length > maxLengths.name) {
    return { ok: false, error: "invalid_client_name" };
  }
  if (description !== null && description.length > maxLengths.description) {
    return { ok: false, error: "invalid_description" };
  }
  if (!status) return { ok: false, error: "invalid_status" };

  return {
    ok: true,
    value: {
      id,
      tenantId,
      name,
      description,
      status
    }
  };
}

export function parseContactBody(
  body: unknown,
  tenantId: string
): ParseResult<ContactInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const input = body as Record<string, unknown>;
  const id = getOptionalString(input, "id") ?? `contact-${crypto.randomUUID()}`;
  const clientId = getOptionalString(input, "clientId");
  const name = getOptionalString(input, "name");
  const email = getOptionalString(input, "email") ?? null;
  const phone = getOptionalString(input, "phone") ?? null;
  const telegram = getOptionalString(input, "telegram") ?? null;
  const role = getOptionalString(input, "role") ?? null;
  const status = parseStatus(getOptionalString(input, "status") ?? "active");

  if (!isId(id)) return { ok: false, error: "invalid_contact_id" };
  if (!clientId || !isId(clientId)) return { ok: false, error: "invalid_client_id" };
  if (!name || name.length > maxLengths.name) {
    return { ok: false, error: "invalid_contact_name" };
  }
  if (email !== null && (email.length > maxLengths.email || !emailPattern.test(email))) {
    return { ok: false, error: "invalid_contact_email" };
  }
  if (phone !== null && phone.length > maxLengths.phone) {
    return { ok: false, error: "invalid_contact_phone" };
  }
  if (telegram !== null && telegram.length > maxLengths.telegram) {
    return { ok: false, error: "invalid_contact_telegram" };
  }
  if (role !== null && role.length > maxLengths.role) {
    return { ok: false, error: "invalid_contact_role" };
  }
  if (!status) return { ok: false, error: "invalid_status" };

  return {
    ok: true,
    value: {
      id,
      tenantId,
      clientId,
      name,
      email,
      phone,
      telegram,
      role,
      status
    }
  };
}

export function parseProjectTypeBody(
  body: unknown,
  tenantId: string
): ParseResult<ProjectTypeInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const input = body as Record<string, unknown>;
  const id = getOptionalString(input, "id") ?? `project-type-${crypto.randomUUID()}`;
  const name = getOptionalString(input, "name");
  const description = getOptionalString(input, "description") ?? null;
  const status = parseStatus(getOptionalString(input, "status") ?? "active");

  if (!isId(id)) return { ok: false, error: "invalid_project_type_id" };
  if (!name || name.length > maxLengths.name) {
    return { ok: false, error: "invalid_project_type_name" };
  }
  if (description !== null && description.length > maxLengths.description) {
    return { ok: false, error: "invalid_description" };
  }
  if (!status) return { ok: false, error: "invalid_status" };

  return { ok: true, value: { id, tenantId, name, description, status } };
}

export function parseDealStageBody(
  body: unknown,
  tenantId: string
): ParseResult<DealStageInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const input = body as Record<string, unknown>;
  const id = getOptionalString(input, "id") ?? `deal-stage-${crypto.randomUUID()}`;
  const name = getOptionalString(input, "name");
  const sortOrder = parsePositiveInteger(input.sortOrder);
  const status = parseStatus(getOptionalString(input, "status") ?? "active");

  if (!isId(id)) return { ok: false, error: "invalid_deal_stage_id" };
  if (!name || name.length > maxLengths.name) {
    return { ok: false, error: "invalid_deal_stage_name" };
  }
  if (sortOrder === null) return { ok: false, error: "invalid_sort_order" };
  if (!status) return { ok: false, error: "invalid_status" };

  return { ok: true, value: { id, tenantId, name, sortOrder, status } };
}

export function parseDealStageChangeBody(body: unknown): ParseResult<{ stageId: string }> {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const stageId = getOptionalString(body, "stageId");
  if (!stageId || !isId(stageId)) return { ok: false, error: "invalid_deal_stage_id" };

  return { ok: true, value: { stageId } };
}

export function isId(value: string): boolean {
  return idPattern.test(value);
}

function parseStatus(value: string): "active" | "archived" | null {
  return value === "active" || value === "archived" ? value : null;
}

function parsePositiveInteger(value: unknown): number | null {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value <= 0 ||
    value > maxPostgresInteger
  ) {
    return null;
  }
  return value;
}
