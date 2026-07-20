import {
  isCrmPipelineAutomationTrigger,
  isCrmPipelineLifecycleState,
  isCrmPipelineStatus
} from "@kiss-pm/domain";
import type {
  PipelineInput,
  StageTransitionInput
} from "@kiss-pm/persistence";
import type {
  ClientInput,
  ContactInput,
  CrmPipelineInput,
  CrmPipelineStageAutomationDefinitionInput,
  CrmPipelineStageInput,
  CrmPipelineTransitionRuleInput,
  DealStageInput,
  ProductInput,
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
  email: 254,
  phone: 80,
  sku: 80,
  unit: 40,
  telegram: 80,
  role: 120,
  actionType: 120,
  permission: 160,
  fieldKey: 120
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
  if (!name || !isSafeSingleLineText(name, maxLengths.name)) {
    return { ok: false, error: "invalid_client_name" };
  }
  if (description !== null && !isSafeMultilineText(description, maxLengths.description)) {
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
  const email = getOptionalString(input, "email")?.toLowerCase() ?? null;
  const phone = getOptionalString(input, "phone") ?? null;
  const telegram = getOptionalString(input, "telegram") ?? null;
  const role = getOptionalString(input, "role") ?? null;
  const status = parseStatus(getOptionalString(input, "status") ?? "active");

  if (!isId(id)) return { ok: false, error: "invalid_contact_id" };
  if (!clientId || !isId(clientId)) return { ok: false, error: "invalid_client_id" };
  if (!name || !isSafeSingleLineText(name, maxLengths.name)) {
    return { ok: false, error: "invalid_contact_name" };
  }
  if (email !== null && (!isSafeSingleLineText(email, maxLengths.email) || !emailPattern.test(email))) {
    return { ok: false, error: "invalid_contact_email" };
  }
  if (phone !== null && !isSafeSingleLineText(phone, maxLengths.phone)) {
    return { ok: false, error: "invalid_contact_phone" };
  }
  if (telegram !== null && !isSafeSingleLineText(telegram, maxLengths.telegram)) {
    return { ok: false, error: "invalid_contact_telegram" };
  }
  if (role !== null && !isSafeSingleLineText(role, maxLengths.role)) {
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

export function parseProductBody(
  body: unknown,
  tenantId: string
): ParseResult<ProductInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const input = body as Record<string, unknown>;
  const id = getOptionalString(input, "id") ?? `product-${crypto.randomUUID()}`;
  const name = getOptionalString(input, "name");
  const sku = getOptionalString(input, "sku") ?? null;
  const type = parseProductType(getOptionalString(input, "type") ?? "service");
  const unit = getOptionalString(input, "unit");
  const price = parsePositiveInteger(input.price);
  const description = getOptionalString(input, "description") ?? null;
  const status = parseStatus(getOptionalString(input, "status") ?? "active");

  if (!isId(id)) return { ok: false, error: "invalid_product_id" };
  if (!name || !isSafeSingleLineText(name, maxLengths.name)) {
    return { ok: false, error: "invalid_product_name" };
  }
  if (sku !== null && !isSafeSingleLineText(sku, maxLengths.sku)) {
    return { ok: false, error: "invalid_product_sku" };
  }
  if (!type) return { ok: false, error: "invalid_product_type" };
  if (!unit || !isSafeSingleLineText(unit, maxLengths.unit)) {
    return { ok: false, error: "invalid_product_unit" };
  }
  if (price === null) return { ok: false, error: "invalid_product_price" };
  if (description !== null && !isSafeMultilineText(description, maxLengths.description)) {
    return { ok: false, error: "invalid_description" };
  }
  if (!status) return { ok: false, error: "invalid_status" };

  return {
    ok: true,
    value: {
      id,
      tenantId,
      name,
      sku,
      type,
      unit,
      price,
      description,
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
  if (!name || !isSafeSingleLineText(name, maxLengths.name)) {
    return { ok: false, error: "invalid_project_type_name" };
  }
  if (description !== null && !isSafeMultilineText(description, maxLengths.description)) {
    return { ok: false, error: "invalid_description" };
  }
  if (!status) return { ok: false, error: "invalid_status" };

  return { ok: true, value: { id, tenantId, name, description, status } };
}


export function parseCrmPipelineBody(
  body: unknown,
  tenantId: string,
  existing?: Pick<CrmPipelineInput, "id" | "lifecycleGraphMetadata">
): ParseResult<CrmPipelineInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const input = body as Record<string, unknown>;
  const id = existing?.id ?? getOptionalString(input, "id") ?? `crm-pipeline-${crypto.randomUUID()}`;
  const name = getOptionalString(input, "name");
  const status = parseCrmPipelineStatusValue(getOptionalString(input, "status") ?? "active");
  // Операционные поля мультиворонок (унификация): description/isDefault/sortOrder.
  const description = getOptionalString(input, "description") ?? null;
  const isDefault = input.isDefault === undefined ? false : parseOptionalBoolean(input.isDefault);
  const sortOrder = input.sortOrder === undefined ? 1 : parsePositiveInteger(input.sortOrder);

  if (!isId(id)) return { ok: false, error: "invalid_crm_pipeline_id" };
  if (!name || !isSafeSingleLineText(name, maxLengths.name)) {
    return { ok: false, error: "invalid_crm_pipeline_name" };
  }
  if (description !== null && !isSafeMultilineText(description, maxLengths.description)) {
    return { ok: false, error: "invalid_description" };
  }
  if (isDefault === null) return { ok: false, error: "invalid_body" };
  if (sortOrder === null) return { ok: false, error: "invalid_crm_pipeline_sort_order" };
  if (!status) return { ok: false, error: "invalid_status" };

  return {
    ok: true,
    value: {
      id,
      tenantId,
      name,
      description,
      isDefault,
      sortOrder,
      status,
      lifecycleGraphMetadata: existing?.lifecycleGraphMetadata ?? {
        pipelineId: id,
        initialStageId: null,
        finalStageIds: [],
        stages: [],
        transitions: []
      }
    }
  };
}

export function parseCrmPipelineStageBody(
  body: unknown,
  tenantId: string,
  pipelineId: string,
  existingId?: string
): ParseResult<CrmPipelineStageInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const input = body as Record<string, unknown>;
  const id = existingId ?? getOptionalString(input, "id") ?? `crm-pipeline-stage-${crypto.randomUUID()}`;
  const name = getOptionalString(input, "name");
  const sortOrder = parsePositiveInteger(input.sortOrder);
  const status = parseCrmPipelineStatusValue(getOptionalString(input, "status") ?? "active");
  const lifecycleState = parseCrmPipelineLifecycleStateValue(
    getOptionalString(input, "lifecycleState") ?? "open"
  );
  const isFinal = parseBoolean(input.isFinal, false);

  if (!isId(id)) return { ok: false, error: "invalid_crm_pipeline_stage_id" };
  if (!isId(pipelineId)) return { ok: false, error: "invalid_crm_pipeline_id" };
  if (!name || !isSafeSingleLineText(name, maxLengths.name)) {
    return { ok: false, error: "invalid_crm_pipeline_stage_name" };
  }
  if (sortOrder === null) return { ok: false, error: "invalid_sort_order" };
  if (!status) return { ok: false, error: "invalid_status" };
  if (!lifecycleState) return { ok: false, error: "invalid_lifecycle_state" };
  if (isFinal === null) return { ok: false, error: "invalid_is_final" };
  if (isFinal && lifecycleState === "open") return { ok: false, error: "invalid_final_lifecycle_state" };
  if (!isFinal && lifecycleState !== "open") {
    return { ok: false, error: "invalid_open_lifecycle_state" };
  }

  return {
    ok: true,
    value: { id, tenantId, pipelineId, name, sortOrder, status, lifecycleState, isFinal }
  };
}

export function parseCrmPipelineTransitionRuleBody(
  body: unknown,
  tenantId: string,
  pipelineId: string,
  existingId?: string
): ParseResult<CrmPipelineTransitionRuleInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const input = body as Record<string, unknown>;
  const id = existingId ?? getOptionalString(input, "id") ?? `crm-pipeline-rule-${crypto.randomUUID()}`;
  const fromStageId = getOptionalString(input, "fromStageId");
  const toStageId = getOptionalString(input, "toStageId");
  const requiredPermission = getOptionalString(input, "requiredPermission") ?? null;
  const requiredFields = parseStringArray(input.requiredFields ?? []);
  const requireReason = parseBoolean(input.requireReason, false);
  const status = parseCrmPipelineStatusValue(getOptionalString(input, "status") ?? "active");
  // Runtime-гварды перехода (унификация мультиворонок).
  const requireFeasibilityOk = parseBoolean(input.requireFeasibilityOk, false);
  const guardNote = getOptionalString(input, "guardNote") ?? null;
  let minProbability: number | null = null;
  if (input.minProbability !== undefined && input.minProbability !== null) {
    const parsedProbability = parseProbability(input.minProbability);
    if (parsedProbability === null) return { ok: false, error: "invalid_min_probability" };
    minProbability = parsedProbability;
  }

  if (!isId(id)) return { ok: false, error: "invalid_crm_pipeline_transition_rule_id" };
  if (!isId(pipelineId)) return { ok: false, error: "invalid_crm_pipeline_id" };
  if (!fromStageId || !isId(fromStageId)) return { ok: false, error: "invalid_from_stage_id" };
  if (!toStageId || !isId(toStageId)) return { ok: false, error: "invalid_to_stage_id" };
  if (fromStageId === toStageId) return { ok: false, error: "invalid_transition_self_loop" };
  if (
    requiredPermission !== null &&
    !isSafeSingleLineText(requiredPermission, maxLengths.permission)
  ) {
    return { ok: false, error: "invalid_required_permission" };
  }
  if (!requiredFields || !requiredFields.every(isFieldKey)) {
    return { ok: false, error: "invalid_required_fields" };
  }
  if (requireReason === null) return { ok: false, error: "invalid_require_reason" };
  if (requireFeasibilityOk === null) return { ok: false, error: "invalid_body" };
  if (guardNote !== null && !isSafeSingleLineText(guardNote, maxLengths.name)) {
    return { ok: false, error: "invalid_guard_note" };
  }
  if (!status) return { ok: false, error: "invalid_status" };

  return {
    ok: true,
    value: {
      id,
      tenantId,
      pipelineId,
      fromStageId,
      toStageId,
      requiredPermission,
      requiredFields,
      requireReason,
      requireFeasibilityOk,
      minProbability,
      guardNote,
      status
    }
  };
}

export function parseCrmPipelineStageAutomationDefinitionBody(
  body: unknown,
  tenantId: string,
  pipelineId: string,
  existingId?: string
): ParseResult<CrmPipelineStageAutomationDefinitionInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const input = body as Record<string, unknown>;
  const id = existingId ?? getOptionalString(input, "id") ?? `crm-pipeline-automation-${crypto.randomUUID()}`;
  const stageId = getOptionalString(input, "stageId");
  const trigger = parseCrmPipelineAutomationTriggerValue(
    getOptionalString(input, "trigger") ?? "stage_entered"
  );
  const actionType = getOptionalString(input, "actionType");
  const actionConfig = parseJsonObject(input.actionConfig ?? {});
  const status = parseCrmPipelineStatusValue(getOptionalString(input, "status") ?? "active");

  if (!isId(id)) return { ok: false, error: "invalid_crm_pipeline_automation_id" };
  if (!isId(pipelineId)) return { ok: false, error: "invalid_crm_pipeline_id" };
  if (!stageId || !isId(stageId)) return { ok: false, error: "invalid_crm_pipeline_stage_id" };
  if (!trigger) return { ok: false, error: "invalid_automation_trigger" };
  if (!actionType || !isSafeSingleLineText(actionType, maxLengths.actionType)) {
    return { ok: false, error: "invalid_action_type" };
  }
  if (!actionConfig) return { ok: false, error: "invalid_action_config" };
  if (!status) return { ok: false, error: "invalid_status" };

  return {
    ok: true,
    value: { id, tenantId, pipelineId, stageId, trigger, actionType, actionConfig, status }
  };
}

// Черновик стадии из тела запроса: pipelineId ещё может быть null (legacy-клиенты
// без воронки) — роут нормализует его в default-воронку перед записью.
export type DealStageDraft = Omit<DealStageInput, "pipelineId"> & { pipelineId: string | null };

export function parseDealStageBody(
  body: unknown,
  tenantId: string
): ParseResult<DealStageDraft> {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const input = body as Record<string, unknown>;
  const id = getOptionalString(input, "id") ?? `deal-stage-${crypto.randomUUID()}`;
  const name = getOptionalString(input, "name");
  const sortOrder = parsePositiveInteger(input.sortOrder);
  const status = parseStatus(getOptionalString(input, "status") ?? "active");
  // Мультиворонки: воронка стадии. Пробрасывается из тела/before-state роутом;
  // отсутствие → null (back-compat для legacy-стадий без воронки).
  const pipelineId = getOptionalString(input, "pipelineId");

  if (!isId(id)) return { ok: false, error: "invalid_deal_stage_id" };
  if (!name || !isSafeSingleLineText(name, maxLengths.name)) {
    return { ok: false, error: "invalid_deal_stage_name" };
  }
  if (sortOrder === null) return { ok: false, error: "invalid_sort_order" };
  if (!status) return { ok: false, error: "invalid_status" };
  if (pipelineId !== null && !isId(pipelineId)) {
    return { ok: false, error: "invalid_pipeline_id" };
  }

  return { ok: true, value: { id, tenantId, pipelineId, name, sortOrder, status } };
}

// Тело атомарного переупорядочивания стадий воронки: ПОЛНЫЙ новый порядок { stageIds: [...] }.
// Полный список (а не пара «переставить местами») — единственная форма, которую сервер может
// применить одной транзакцией, не нарушая immediate-unique (tenant_id, pipeline_id, sort_order).
export function parseDealStageOrderBody(body: unknown): ParseResult<{ stageIds: string[] }> {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const raw = (body as Record<string, unknown>).stageIds;
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "invalid_stage_order" };
  const stageIds: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !isId(item)) return { ok: false, error: "invalid_deal_stage_id" };
    if (stageIds.includes(item)) return { ok: false, error: "invalid_stage_order" };
    stageIds.push(item);
  }
  return { ok: true, value: { stageIds } };
}

export function parseDealStageChangeBody(body: unknown): ParseResult<{ stageId: string }> {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const stageId = getOptionalString(body, "stageId");
  if (!stageId || !isId(stageId)) return { ok: false, error: "invalid_deal_stage_id" };

  return { ok: true, value: { stageId } };
}

// Мультиворонки: тело переноса сделки между воронками { pipelineId, stageId }.
export function parseOpportunityPipelineChangeBody(
  body: unknown
): ParseResult<{ pipelineId: string; stageId: string }> {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const pipelineId = getOptionalString(body, "pipelineId");
  if (!pipelineId || !isId(pipelineId)) {
    return { ok: false, error: "invalid_pipeline_id" };
  }
  const stageId = getOptionalString(body, "stageId");
  if (!stageId || !isId(stageId)) return { ok: false, error: "invalid_deal_stage_id" };

  return { ok: true, value: { pipelineId, stageId } };
}

// Мультиворонки: тело воронки (create/full-replace). status/isDefault опциональны.
export function parsePipelineBody(
  body: unknown,
  tenantId: string
): ParseResult<PipelineInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const input = body as Record<string, unknown>;
  const id = getOptionalString(input, "id") ?? `pipeline-${crypto.randomUUID()}`;
  const name = getOptionalString(input, "name");
  const description = getOptionalString(input, "description") ?? null;
  const sortOrder = parsePositiveInteger(input.sortOrder);
  const isDefault = parseOptionalBoolean(input.isDefault);
  const status = parseStatus(getOptionalString(input, "status") ?? "active");

  if (!isId(id)) return { ok: false, error: "invalid_pipeline_id" };
  if (!name || !isSafeSingleLineText(name, maxLengths.name)) {
    return { ok: false, error: "invalid_pipeline_name" };
  }
  if (description !== null && !isSafeMultilineText(description, maxLengths.description)) {
    return { ok: false, error: "invalid_description" };
  }
  if (sortOrder === null) return { ok: false, error: "invalid_pipeline_sort_order" };
  if (isDefault === null) return { ok: false, error: "invalid_body" };
  if (!status) return { ok: false, error: "invalid_status" };

  return {
    ok: true,
    value: { id, tenantId, name, description, isDefault, sortOrder, status }
  };
}

// Мультиворонки: тело правила перехода между стадиями. pipelineId передаётся отдельно
// (из роут-параметра), здесь валидируются from/to/условия.
export function parseStageTransitionBody(
  body: unknown,
  tenantId: string,
  pipelineId: string
): ParseResult<StageTransitionInput> {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const input = body as Record<string, unknown>;
  const id = getOptionalString(input, "id") ?? `stage-transition-${crypto.randomUUID()}`;
  const fromStageId = getOptionalString(input, "fromStageId");
  const toStageId = getOptionalString(input, "toStageId");
  const requireFeasibilityOk = parseOptionalBoolean(input.requireFeasibilityOk);
  const guardNote = getOptionalString(input, "guardNote") ?? null;

  if (!isId(id)) return { ok: false, error: "invalid_transition_id" };
  if (!fromStageId || !isId(fromStageId)) {
    return { ok: false, error: "invalid_deal_stage_id" };
  }
  if (!toStageId || !isId(toStageId)) {
    return { ok: false, error: "invalid_deal_stage_id" };
  }
  if (fromStageId === toStageId) {
    return { ok: false, error: "invalid_transition_stages" };
  }
  if (requireFeasibilityOk === null) return { ok: false, error: "invalid_body" };

  // minProbability: опционально; если задано — целое 0..100.
  let minProbability: number | null = null;
  if (input.minProbability !== undefined && input.minProbability !== null) {
    const parsed = parseProbability(input.minProbability);
    if (parsed === null) return { ok: false, error: "invalid_min_probability" };
    minProbability = parsed;
  }

  if (guardNote !== null && !isSafeMultilineText(guardNote, maxLengths.description)) {
    return { ok: false, error: "invalid_description" };
  }

  return {
    ok: true,
    value: {
      id,
      tenantId,
      pipelineId,
      fromStageId,
      toStageId,
      requireFeasibilityOk,
      minProbability,
      guardNote
    }
  };
}

export function isId(value: string): boolean {
  return idPattern.test(value);
}


function parseCrmPipelineStatusValue(value: string) {
  return isCrmPipelineStatus(value) ? value : null;
}

function parseCrmPipelineLifecycleStateValue(value: string) {
  return isCrmPipelineLifecycleState(value) ? value : null;
}

function parseCrmPipelineAutomationTriggerValue(value: string) {
  return isCrmPipelineAutomationTrigger(value) ? value : null;
}

function parseBoolean(value: unknown, defaultValue: boolean): boolean | null {
  if (value === undefined) return defaultValue;
  return typeof value === "boolean" ? value : null;
}

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return null;
    const trimmed = item.trim();
    if (!trimmed) return null;
    parsed.push(trimmed);
  }
  return parsed;
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isFieldKey(value: string): boolean {
  return isSafeSingleLineText(value, maxLengths.fieldKey) && /^[a-zA-Z][a-zA-Z0-9_.-]*$/.test(value);
}

function parseStatus(value: string): "active" | "archived" | null {
  return value === "active" || value === "archived" ? value : null;
}

function parseProductType(value: string): "service" | "goods" | null {
  return value === "service" || value === "goods" ? value : null;
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

// Мультиворонки: целое 0..100 для порога вероятности перехода.
function parseProbability(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
    return null;
  }
  return value;
}

// undefined → дефолт false; boolean → как есть; иное (строка/число) → null (ошибка тела).
function parseOptionalBoolean(value: unknown): boolean | null {
  if (value === undefined) return false;
  if (typeof value !== "boolean") return null;
  return value;
}

function isSafeSingleLineText(value: string, maxLength: number): boolean {
  return value.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(value);
}

function isSafeMultilineText(value: string, maxLength: number): boolean {
  return value.length <= maxLength && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}
