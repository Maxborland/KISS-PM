import type { Meta, StoryObj } from "@storybook/react";

import { ProfileSurface } from "@/auth/profile/profile-surface";

/**
 * Auth — поверхность «Личный кабинет / Профиль» (authenticated): внутренний
 * экран рабочего пространства (WorkspaceShell), НЕ unauth-карточка.
 *
 * Работает через настоящий createAuthClient + in-memory mock (переключение на
 * боевой API = смена apiOrigin). Мок стартует анонимно, поэтому на монтаже
 * выполняется авто-вход демо-кредами (admin@kiss-pm.local) — честная плашка
 * «Демо». Затем GET /api/auth/me отдаёт профиль, правка идёт в PATCH
 * /api/profile (только изменённые поля). «Выйти» → POST /api/auth/logout →
 * forbidden-состояние. Данные in-memory («Прототип»).
 */
const meta: Meta<typeof ProfileSurface> = {
  title: "Auth/Profile",
  component: ProfileSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ProfileSurface>;

export const Default: Story = { name: "Личный кабинет · профиль" };
