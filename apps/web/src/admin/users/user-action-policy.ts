export type UserActionPolicy = {
  canManage: boolean;
  editDisabledReason?: string;
  statusDisabledReason?: string;
};

const permissionReason = "Недостаточно прав для управления пользователями.";

export function getUserActionPolicy(input: {
  permissions: string[];
  currentUserId: string | null;
  targetUserId: string;
}): UserActionPolicy {
  const canManage = input.permissions.includes("tenant.users.manage");
  if (!canManage) {
    return {
      canManage,
      editDisabledReason: permissionReason,
      statusDisabledReason: permissionReason
    };
  }
  return {
    canManage,
    ...(input.currentUserId === input.targetUserId
      ? { statusDisabledReason: "Себя нельзя деактивировать здесь. Отправьте запрос из профиля; владельцу workspace сначала нужно передать владение." }
      : {})
  };
}
