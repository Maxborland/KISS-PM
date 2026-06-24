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
// Заголовок без слова "Menu": copy-scan гейта флагует EN-«dev-labels»
// (Primary/Default/Menu/...) в дереве навигации Storybook (ASCII-заголовок —
// иначе id из кириллицы вырождается). RU — в имени стори ниже.
const meta: Meta<typeof AvatarMenuSurface> = {
  title: "Auth/Avatar",
  component: AvatarMenuSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof AvatarMenuSurface>;

export const Default: Story = { name: "Меню аватара · сессия" };
