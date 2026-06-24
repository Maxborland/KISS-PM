import type { Meta, StoryObj } from "@storybook/react";

import { AdminUsersSurface } from "@/admin/users/users-surface";

/**
 * Администрирование — «Пользователи» на реальном контракте (GET/POST/PATCH /api/workspace/users,
 * createAdminClient + in-memory mock). Таблица пользователей (роль/позиция/статус), создание,
 * правка (имя/роль/позиция) и деактивация. Честно демонстрирует коды: user_email_taken,
 * invalid_access_role, self_access_change_forbidden (нельзя деактивировать/сменить роль себе).
 * Данные in-memory.
 */
const meta: Meta<typeof AdminUsersSurface> = {
  title: "Admin/Users",
  component: AdminUsersSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof AdminUsersSurface>;

export const Default: Story = { name: "Пользователи" };
