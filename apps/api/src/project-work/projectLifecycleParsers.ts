import type { TenantId } from "@kiss-pm/domain";

import { getOptionalString } from "../parseHelpers";

/* ============================================================
   Парсеры жизненного цикла проекта (Блок 5):
   - POST /api/workspace/projects        — ручное создание внутреннего проекта.
   - PATCH /api/workspace/projects/:id    — редактирование параметров проекта.
   Валидация зеркалит projectIntakeParsers (idPattern, безопасный текст, даты UTC,
   горизонт планирования ≤ 730 дней).
   ============================================================ */

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const idPattern = /^[a-z][a-z0-9-]{2,80}$/;
const maxPostgresInteger = 2_147_483_647;
const maxPlanningHorizonDays = 730;
const maxLengths = {
  title: 160,
  clientName: 120
} as const;

export type CreateManualProjectFields = {
  id: string;
  title: string;
  clientName: string;
  projectTypeId: string | null;
  templateId: string | null;
  calendarId: string | null;
  plannedStart: Date;
  plannedFinish: Date;
  contractValue: number;
  plannedHours: number;
};

export type UpdateProjectFields = {
  title?: string;
  projectTypeId?: string | null;
  templateId?: string | null;
  calendarId?: string | null;
};

export function parseCreateProjectBody(
  body: unknown,
  _tenantId: TenantId
): ParseResult<CreateManualProjectFields> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body" };
  }
  const input = body as Record<string, unknown>;

  const id = getOptionalString(input, "id") ?? `project-${crypto.randomUUID()}`;
  const title = getOptionalString(input, "title");
  const clientName = getOptionalString(input, "clientName") ?? "Внутренний проект";
  const projectTypeId = getOptionalString(input, "projectTypeId") ?? null;
  const templateId = getOptionalString(input, "templateId") ?? null;
  const calendarId = getOptionalString(input, "calendarId") ?? null;
  const plannedStart = parseDate(input.plannedStart);
  const plannedFinish = parseDate(input.plannedFinish);
  const contractValue = parseNonNegativeInteger(input.contractValue) ?? 0;
  const plannedHours = parseNonNegativeInteger(input.plannedHours) ?? 0;

  if (!idPattern.test(id)) return { ok: false, error: "invalid_project_id" };
  if (!title || !isSafeSingleLineText(title, maxLengths.title)) {
    return { ok: false, error: "invalid_project_title" };
  }
  if (!isSafeSingleLineText(clientName, maxLengths.clientName)) {
    return { ok: false, error: "invalid_client_name" };
  }
  if (projectTypeId !== null && !idPattern.test(projectTypeId)) {
    return { ok: false, error: "invalid_project_type_id" };
  }
  if (templateId !== null && !idPattern.test(templateId)) {
    return { ok: false, error: "invalid_template_id" };
  }
  if (calendarId !== null && !idPattern.test(calendarId)) {
    return { ok: false, error: "invalid_calendar_id" };
  }
  if (
    !plannedStart ||
    !plannedFinish ||
    plannedFinish.getTime() < plannedStart.getTime() ||
    getDateDiffDays(plannedStart, plannedFinish) > maxPlanningHorizonDays
  ) {
    return { ok: false, error: "invalid_planned_dates" };
  }
  if (input.contractValue !== undefined && parseNonNegativeInteger(input.contractValue) === null) {
    return { ok: false, error: "invalid_contract_value" };
  }
  if (input.plannedHours !== undefined && parseNonNegativeInteger(input.plannedHours) === null) {
    return { ok: false, error: "invalid_planned_hours" };
  }

  return {
    ok: true,
    value: {
      id,
      title,
      clientName,
      projectTypeId,
      templateId,
      calendarId,
      plannedStart,
      plannedFinish,
      contractValue,
      plannedHours
    }
  };
}

export function parseUpdateProjectBody(
  body: unknown
): ParseResult<UpdateProjectFields> {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body" };
  }
  const input = body as Record<string, unknown>;
  const fields: UpdateProjectFields = {};

  if (has(input, "title")) {
    const title = getOptionalString(input, "title");
    if (!title || !isSafeSingleLineText(title, maxLengths.title)) {
      return { ok: false, error: "invalid_project_title" };
    }
    fields.title = title;
  }
  if (has(input, "projectTypeId")) {
    const value = normalizeNullableId(input.projectTypeId);
    if (value === "invalid") return { ok: false, error: "invalid_project_type_id" };
    fields.projectTypeId = value;
  }
  if (has(input, "templateId")) {
    const value = normalizeNullableId(input.templateId);
    if (value === "invalid") return { ok: false, error: "invalid_template_id" };
    fields.templateId = value;
  }
  if (has(input, "calendarId")) {
    const value = normalizeNullableId(input.calendarId);
    if (value === "invalid") return { ok: false, error: "invalid_calendar_id" };
    fields.calendarId = value;
  }

  if (Object.keys(fields).length === 0) {
    return { ok: false, error: "empty_project_update" };
  }

  return { ok: true, value: fields };
}

function has(input: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

// Нормализация nullable-id поля PATCH: null → null (снятие), строка по idPattern → строка,
// иначе — маркер "invalid".
function normalizeNullableId(value: unknown): string | null | "invalid" {
  if (value === null) return null;
  if (typeof value !== "string") return "invalid";
  return idPattern.test(value) ? value : "invalid";
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseNonNegativeInteger(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > maxPostgresInteger
  ) {
    return null;
  }
  return value;
}

function getDateDiffDays(start: Date, finish: Date): number {
  return Math.floor((finish.getTime() - start.getTime()) / 86_400_000);
}

function isSafeSingleLineText(value: string, maxLength: number): boolean {
  return value.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(value);
}
