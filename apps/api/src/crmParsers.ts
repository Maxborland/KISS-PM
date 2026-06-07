import { isPermission } from "@kiss-pm/access-control";
import {
  isCrmPipelineAutomationTrigger,
  isCrmPipelineLifecycleState,
  isCrmPipelineStatus
} from "@kiss-pm/domain";
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

export type CrmOpportunityPipelineTransitionRequest = {
  targetStageId: string;
  reason: string | null;
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

  if (!isId(id)) return { ok: false, error: "invalid_crm_pipeline_id" };
  if (!name || !isSafeSingleLineText(name, maxLengths.name)) {
    return { ok: false, error: "invalid_crm_pipeline_name" };
  }
  if (!status) return { ok: false, error: "invalid_status" };

  return {
    ok: true,
    value: {
      id,
      tenantId,
      name,
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
  existingId?: string,
  existing?: Pick<CrmPipelineTransitionRuleInput, "requiredPermission">
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

  if (!isId(id)) return { ok: false, error: "invalid_crm_pipeline_transition_rule_id" };
  if (!isId(pipelineId)) return { ok: false, error: "invalid_crm_pipeline_id" };
  if (!fromStageId || !isId(fromStageId)) return { ok: false, error: "invalid_from_stage_id" };
  if (!toStageId || !isId(toStageId)) return { ok: false, error: "invalid_to_stage_id" };
  if (fromStageId === toStageId) return { ok: false, error: "invalid_transition_self_loop" };
  if (
    requiredPermission !== null &&
    (!isSafeSingleLineText(requiredPermission, maxLengths.permission) ||
      !isAllowedTransitionRulePermission(requiredPermission, existing?.requiredPermission))
  ) {
    return { ok: false, error: "invalid_required_permission" };
  }
  if (!requiredFields || !requiredFields.every(isFieldKey)) {
    return { ok: false, error: "invalid_required_fields" };
  }
  if (requireReason === null) return { ok: false, error: "invalid_require_reason" };
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
      status
    }
  };
}

const legacyTenantPermissionPattern = /^tenant(?:\.[a-z][a-z0-9_]{0,40}){2,6}$/;

function isAllowedTransitionRulePermission(
  value: string,
  existingPermission?: string | null
): boolean {
  if (isPermission(value)) return true;
  return value === existingPermission && legacyTenantPermissionPattern.test(value);
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

export function parseCrmOpportunityPipelineTransitionBody(
  body: unknown
): ParseResult<CrmOpportunityPipelineTransitionRequest> {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const input = body as Record<string, unknown>;
  const targetStageId = getOptionalString(input, "targetStageId");
  const reason = getOptionalString(input, "reason") ?? null;

  if (!targetStageId || !isId(targetStageId)) {
    return { ok: false, error: "invalid_crm_pipeline_stage_id" };
  }
  if (reason !== null && !isSafeMultilineText(reason, maxLengths.description)) {
    return { ok: false, error: "invalid_transition_reason" };
  }

  return { ok: true, value: { targetStageId, reason } };
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
  if (!name || !isSafeSingleLineText(name, maxLengths.name)) {
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

function isSafeSingleLineText(value: string, maxLength: number): boolean {
  return value.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(value);
}

function isSafeMultilineText(value: string, maxLength: number): boolean {
  return value.length <= maxLength && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}
