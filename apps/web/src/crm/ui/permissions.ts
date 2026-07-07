export type CrmWriteCapability = {
  allowed: boolean;
  disabledReason: string | null;
};

export function getCrmWriteCapability({
  live,
  permissions,
  permission
}: {
  live: boolean;
  permissions: readonly string[];
  permission: string;
}): CrmWriteCapability {
  if (!live || permissions.includes(permission)) return { allowed: true, disabledReason: null };
  return { allowed: false, disabledReason: "Недостаточно прав для создания или изменения" };
}
