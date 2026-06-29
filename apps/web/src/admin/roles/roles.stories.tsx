import type { Meta, StoryObj } from "@storybook/react";

import { AdminRolesSurface } from "@/admin/roles/roles-surface";

/**
 * Администрирование — «Роли» на реальном контракте (GET/PATCH/DELETE /api/workspace/access-roles,
 * POST /api/tenant/current/access-profiles, createAdminClient + in-memory mock). Таблица ролей
 * (число прав / назначено пользователей), создание с чек-листом прав (сгруппированы по префиксу),
 * правка прав (full-replace) и удаление. Честно демонстрирует код access_role_assigned
 * (назначенную роль удалить нельзя). Данные in-memory.
 */
const meta: Meta<typeof AdminRolesSurface> = {
  title: "Admin/Roles",
  component: AdminRolesSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof AdminRolesSurface>;

export const Default: Story = { name: "Роли" };
