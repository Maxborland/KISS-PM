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
 * - Справочники → ReferencesTab (CRUD должностей и статусов задач).
 * Вкладки «Интеграции»/«Оплата» скрыты до контракта — не заводим мёртвые
 * контролы на прод-роуте (честность блока 12).
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
