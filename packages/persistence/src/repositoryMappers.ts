import { isPermission, type Permission } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";

import type {
  AccessProfileRecord,
  CustomFieldDefinitionRecord,
  PositionRecord,
  ProjectTemplateRecord,
  WorkspaceUserRecord
} from "./repositories";
import {
  accessProfiles,
  customFieldDefinitions,
  positions,
  projectTemplates,
  tenantUsers
} from "./schema";

export function toPermission(value: string): Permission {
  if (isPermission(value)) {
    return value;
  }

  throw new Error(`Unknown persisted permission: ${value}`);
}

export function mapAccessProfileRecord(
  row: typeof accessProfiles.$inferSelect
): AccessProfileRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    permissions: row.permissions.map(toPermission)
  };
}

export function mapWorkspaceUserRecord(
  row: typeof tenantUsers.$inferSelect,
  positionName: string | null
): WorkspaceUserRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    accessProfileId: row.accessProfileId,
    positionId: row.positionId,
    positionName,
    email: row.email,
    name: row.name,
    phone: row.phone,
    telegram: row.telegram,
    status: row.status,
    theme: row.theme,
    accentColor: row.accentColor
  };
}

export function mapPositionRecord(row: typeof positions.$inferSelect): PositionRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    description: row.description
  };
}

export function mapCustomFieldDefinitionRecord(
  row: typeof customFieldDefinitions.$inferSelect
): CustomFieldDefinitionRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    systemKey: row.systemKey,
    tenantLabel: row.tenantLabel,
    targetEntity: row.targetEntity,
    fieldType: row.fieldType,
    required: row.required,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function mapProjectTemplateRecord(
  row: typeof projectTemplates.$inferSelect
): ProjectTemplateRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    systemKey: row.systemKey,
    tenantLabel: row.tenantLabel,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function mapTenantUser(row: typeof tenantUsers.$inferSelect): TenantUser {
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    accessProfileId: row.accessProfileId
  };
}
