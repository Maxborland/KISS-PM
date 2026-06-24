import type { Meta, StoryObj } from "@storybook/react";

import { AvatarMenuSurface } from "@/auth/avatar-menu/avatar-menu-surface";

/**
 * Auth — функциональное «Меню аватара» из верхней панели. Заменяет статический
 * views/blocks/avatar-menu-block.tsx.
 *
 * Работает через настоящий createAuthClient + in-memory mock (переключение на
 * боевой API = смена apiOrigin). Мок стартует анонимно → авто-вход демо-кредами
 * (admin@kiss-pm.local). Реальные данные сессии (GET /api/auth/me), переключение
 * темы (PATCH /api/profile/theme) и «Выйти» (POST /api/auth/logout). Переходы
 * Профиль/Настройки/Уведомления — навигация рабочего приложения (demoAction).
 */
const meta: Meta<typeof AvatarMenuSurface> = {
  title: "Auth/Avatar Menu",
  component: AvatarMenuSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof AvatarMenuSurface>;

export const Default: Story = { name: "Меню аватара · сессия" };
