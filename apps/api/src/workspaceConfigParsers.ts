import {
  isWorkspaceConfigFieldType,
  isWorkspaceConfigId,
  isWorkspaceConfigStatus,
  isWorkspaceConfigSystemKey,
  isWorkspaceConfigTenantLabel,
  workspaceConfigDescriptionMaxLength
} from "@kiss-pm/domain";
import type { TenantId } from "@kiss-pm/domain";
import type {
  CustomFieldDefinitionInput,
  ProjectTemplateInput
} from "./apiTypes";
import { getOptionalString, getStringField } from "./parseHelpers";

export { getStringField } from "./parseHelpers";

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
  if (!systemKey || !isWorkspaceConfigSystemKey(systemKey)) {
    return { ok: false, error: "invalid_system_key" };
  }
  if (
    !tenantLabel ||
    !isWorkspaceConfigTenantLabel(tenantLabel) ||
    !isSafeSingleLineText(tenantLabel)
  ) {
    return { ok: false, error: "invalid_tenant_label" };
  }
  if (!["project", "opportunity"].includes(targetEntity)) {
    return { ok: false, error: "invalid_target_entity" };
  }
  if (!fieldType || !isWorkspaceConfigFieldType(fieldType)) {
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
  if (!systemKey || !isWorkspaceConfigSystemKey(systemKey)) {
    return { ok: false, error: "invalid_system_key" };
  }
  if (
    !tenantLabel ||
    !isWorkspaceConfigTenantLabel(tenantLabel) ||
    !isSafeSingleLineText(tenantLabel)
  ) {
    return { ok: false, error: "invalid_tenant_label" };
  }
  if (
    description !== undefined &&
    (description.length > workspaceConfigDescriptionMaxLength ||
      !isSafeMultilineText(description))
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

function isSafeSingleLineText(value: string): boolean {
  return !/[\u0000-\u001f\u007f]/.test(value);
}

function isSafeMultilineText(value: string): boolean {
  return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value);
}
