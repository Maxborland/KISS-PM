import type { TenantId } from "@kiss-pm/domain";
import type {
  CustomFieldDefinitionInput,
  ProjectTemplateInput
} from "./apiTypes";
import { getOptionalString, getStringField } from "./parseHelpers";

export { getStringField } from "./parseHelpers";

const workspaceConfigIdMaxLength = 96;
const workspaceConfigSystemKeyMaxLength = 80;
const workspaceConfigLabelMaxLength = 120;
const workspaceConfigDescriptionMaxLength = 1000;

type CustomFieldDefinitionParseResult =
  | {
      ok: true;
      value: CustomFieldDefinitionInput;
    }
  | {
      ok: false;
      error: string;
    };

export function parseCustomFieldDefinitionBody(
  body: unknown,
  tenantId: TenantId,
  fieldId?: string
): CustomFieldDefinitionParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body" };
  }

  const input = body as Record<string, unknown>;
  const id = fieldId ?? getOptionalString(input, "id") ?? `field-${crypto.randomUUID()}`;
  const systemKey = getOptionalString(input, "systemKey");
  const tenantLabel = getOptionalString(input, "tenantLabel");
  const targetEntity = getOptionalString(input, "targetEntity") ?? "project";
  const fieldType = getOptionalString(input, "fieldType");
  const status = getOptionalString(input, "status") ?? "draft";
  const requiredInput = input.required;

  if (!isWorkspaceConfigId(id)) {
    return { ok: false, error: "invalid_config_id" };
  }
  if (!systemKey || !isSystemKey(systemKey)) {
    return { ok: false, error: "invalid_system_key" };
  }
  if (!tenantLabel || tenantLabel.length > workspaceConfigLabelMaxLength) {
    return { ok: false, error: "invalid_tenant_label" };
  }
  if (targetEntity !== "project") {
    return { ok: false, error: "invalid_target_entity" };
  }
  if (!fieldType || !isCustomFieldType(fieldType)) {
    return { ok: false, error: "invalid_field_type" };
  }
  if (!isWorkspaceConfigStatus(status)) {
    return { ok: false, error: "invalid_config_status" };
  }
  if (requiredInput !== undefined && typeof requiredInput !== "boolean") {
    return { ok: false, error: "invalid_required_flag" };
  }

  return {
    ok: true,
    value: {
      id,
      tenantId,
      systemKey,
      tenantLabel,
      targetEntity,
      fieldType,
      required: requiredInput === true,
      status
    }
  };
}

type ProjectTemplateParseResult =
  | {
      ok: true;
      value: ProjectTemplateInput;
    }
  | {
      ok: false;
      error: string;
    };

export function parseProjectTemplateBody(
  body: unknown,
  tenantId: TenantId,
  templateId?: string
): ProjectTemplateParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_body" };
  }

  const input = body as Record<string, unknown>;
  const id =
    templateId ?? getOptionalString(input, "id") ?? `template-${crypto.randomUUID()}`;
  const systemKey = getOptionalString(input, "systemKey");
  const tenantLabel = getOptionalString(input, "tenantLabel");
  const status = getOptionalString(input, "status") ?? "draft";
  const description = getStringField(input, "description");

  if (!isWorkspaceConfigId(id)) {
    return { ok: false, error: "invalid_config_id" };
  }
  if (!systemKey || !isSystemKey(systemKey)) {
    return { ok: false, error: "invalid_system_key" };
  }
  if (!tenantLabel || tenantLabel.length > workspaceConfigLabelMaxLength) {
    return { ok: false, error: "invalid_tenant_label" };
  }
  if (
    description !== undefined &&
    description.length > workspaceConfigDescriptionMaxLength
  ) {
    return { ok: false, error: "invalid_description" };
  }
  if (!isWorkspaceConfigStatus(status)) {
    return { ok: false, error: "invalid_config_status" };
  }

  return {
    ok: true,
    value: {
      id,
      tenantId,
      systemKey,
      tenantLabel,
      description: description === undefined || description === "" ? null : description,
      status
    }
  };
}

function isSystemKey(value: string): boolean {
  return (
    value.length <= workspaceConfigSystemKeyMaxLength &&
    /^[a-z][a-z0-9_]*$/.test(value)
  );
}

function isWorkspaceConfigId(value: string): boolean {
  return (
    value.length <= workspaceConfigIdMaxLength &&
    /^[a-z][a-z0-9_-]*$/.test(value)
  );
}

function isCustomFieldType(
  value: string
): value is "text" | "number" | "date" | "select" {
  return value === "text" || value === "number" || value === "date" || value === "select";
}

function isWorkspaceConfigStatus(value: string): value is "draft" | "active" {
  return value === "draft" || value === "active";
}
