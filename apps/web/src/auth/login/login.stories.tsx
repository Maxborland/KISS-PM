import type { Meta, StoryObj } from "@storybook/react";

import { LoginSurface } from "@/auth/login/login-surface";

/**
 * Auth — поверхность «Вход»: форма email+пароль на реальном контракте
 * (createAuthClient + in-memory contract-mock; переключение на боевой API =
 * смена apiOrigin). Реальный submit → POST /api/auth/login, при успехе
 * GET /api/auth/me → залогиненное состояние (приветствие + «Выйти»).
 * Ошибки — invalid_credentials / too_many_login_attempts / user_inactive
 * через FormError(authErr). Каждый монтаж — изолированная сессия (старт
 * anonymous). Данные in-memory («Прототип»).
 *
 * Демо-вход: admin@kiss-pm.local / kiss-pm-admin (active);
 * inactive@kiss-pm.local / kiss-pm-inactive → 403 user_inactive.
 */
const meta: Meta<typeof LoginSurface> = {
  title: "Auth/Login",
  component: LoginSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof LoginSurface>;

// Пустая форма (стартовое anonymous-состояние).
export const Default: Story = { name: "Вход" };

// Предзаполненные демо-креды — нажмите «Войти» для перехода в залогиненное состояние.
export const Prefilled: Story = {
  name: "Вход · демо-креды",
  args: { prefill: true }
};
