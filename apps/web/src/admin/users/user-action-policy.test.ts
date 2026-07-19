import { describe, expect, it } from "vitest";

import { getUserActionPolicy } from "./user-action-policy";

describe("getUserActionPolicy", () => {
  it("запрещает reader все мутации с понятной причиной", () => {
    expect(getUserActionPolicy({ permissions: ["tenant.users.read"], currentUserId: "reader", targetUserId: "owner" })).toEqual({
      canManage: false,
      editDisabledReason: "Недостаточно прав для управления пользователями.",
      statusDisabledReason: "Недостаточно прав для управления пользователями.",
      resetTokenDisabledReason: "Недостаточно прав для управления пользователями."
    });
  });

  it("не предлагает администратору деактивировать самого себя", () => {
    expect(getUserActionPolicy({ permissions: ["tenant.users.manage"], currentUserId: "owner", targetUserId: "owner" }).statusDisabledReason)
      .toBe("Себя нельзя деактивировать здесь. Отправьте запрос из профиля; владельцу workspace сначала нужно передать владение.");
  });

  it("разрешает выдачу токена сброса при tenant.users.manage — включая самому себе", () => {
    expect(getUserActionPolicy({ permissions: ["tenant.users.manage"], currentUserId: "owner", targetUserId: "user-ivan" }).resetTokenDisabledReason)
      .toBeUndefined();
    expect(getUserActionPolicy({ permissions: ["tenant.users.manage"], currentUserId: "owner", targetUserId: "owner" }).resetTokenDisabledReason)
      .toBeUndefined();
  });
});
