export type UserActionPolicy = {
  canManage: boolean;
  editDisabledReason?: string;
  statusDisabledReason?: string;
  // Выдача токена сброса пароля — то же право tenant.users.manage; self-ограничений нет.
  resetTokenDisabledReason?: string;
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
      statusDisabledReason: permissionReason,
      resetTokenDisabledReason: permissionReason
    };
  }
  return {
    canManage,
    ...(input.currentUserId === input.targetUserId
      ? { statusDisabledReason: "Себя нельзя деактивировать здесь. Отправьте запрос из профиля; владельцу workspace сначала нужно передать владение." }
      : {})
  };
}
