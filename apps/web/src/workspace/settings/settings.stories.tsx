import type { Meta, StoryObj } from "@storybook/react";

import { SettingsSurface } from "@/workspace/settings/settings-surface";

/**
 * Workspace — функциональные «Настройки рабочей области». Заменяет статический
 * views/blocks/settings-block.tsx.
 *
 * Каждая вкладка собрана из реальных контрактов через contract-mock
 * (переключение на боевой = apiOrigin):
 * - Профиль → useAuth (GET /api/auth/me + PATCH /api/profile[/theme]),
 *   переиспользует ProfileContent (авто-вход демо-кредами на монтаже).
 * - Уведомления → useNotificationPreferences (PUT /notification-preferences),
 *   переиспользует NotificationsPrefs.
 * - Интеграции / Оплата → контракта нет → честный EmptyState (не фейк).
 */
const meta: Meta<typeof SettingsSurface> = {
  title: "Workspace/Settings",
  component: SettingsSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof SettingsSurface>;

export const Default: Story = { name: "Настройки · вкладки" };
