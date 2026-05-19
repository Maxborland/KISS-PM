export const workspaceConfigIdMaxLength = 96;
export const workspaceConfigSystemKeyMaxLength = 80;
export const workspaceConfigLabelMaxLength = 120;
export const workspaceConfigDescriptionMaxLength = 1000;

export const workspaceConfigFieldTypes = ["text", "number", "date", "select"] as const;
export type WorkspaceConfigFieldType = (typeof workspaceConfigFieldTypes)[number];

export const workspaceConfigStatuses = ["draft", "active"] as const;
export type WorkspaceConfigStatus = (typeof workspaceConfigStatuses)[number];

export function isWorkspaceConfigId(value: string): boolean {
  return (
    value.length <= workspaceConfigIdMaxLength &&
    /^[a-z][a-z0-9_-]*$/.test(value)
  );
}

export function isWorkspaceConfigSystemKey(value: string): boolean {
  return (
    value.length <= workspaceConfigSystemKeyMaxLength &&
    /^[a-z][a-z0-9_]*$/.test(value)
  );
}

export function isWorkspaceConfigSystemKeyInput(value: string): boolean {
  return (
    value.length <= workspaceConfigSystemKeyMaxLength &&
    isWorkspaceConfigSystemKey(value.trim())
  );
}

export function isWorkspaceConfigTenantLabel(value: string): boolean {
  return (
    value === value.trim() &&
    value.length > 0 &&
    value.length <= workspaceConfigLabelMaxLength
  );
}

export function isWorkspaceConfigTenantLabelInput(value: string): boolean {
  return isWorkspaceConfigTenantLabel(value.trim());
}

export function isWorkspaceConfigFieldType(
  value: string
): value is WorkspaceConfigFieldType {
  return workspaceConfigFieldTypes.includes(value as WorkspaceConfigFieldType);
}

export function isWorkspaceConfigStatus(value: string): value is WorkspaceConfigStatus {
  return workspaceConfigStatuses.includes(value as WorkspaceConfigStatus);
}
