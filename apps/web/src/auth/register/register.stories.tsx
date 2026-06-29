import type { Meta, StoryObj } from "@storybook/react";

import { RegisterSurface } from "@/auth/register/register-surface";

/**
 * Auth — поверхность «Регистрация» (БОЕВОЙ контракт POST /api/auth/register,
 * самрегистрация нового тенанта).
 *
 * ЧЕСТНОСТЬ: реальный submit идёт в мок через useAuth().register
 * (createAuthClient + in-memory fetchImpl, НЕ demoAction-заглушка). Мок зеркалит
 * боевой контракт (apps/api/src/authRegistrationRoutes.ts): создаётся свежий
 * тенант + роль-владелец + пользователь. При ok бэк делает авто-логин
 * (refresh → authenticated), и поверхность показывает
 * «Аккаунт создан, вы вошли как {name}».
 *
 * Ошибки → FormError: invalid_registration_payload / weak_password / email_taken.
 * Для демо email_taken: введите admin@kiss-pm.local (email уже занят в моке).
 * Каждый монтаж — изолированная сессия, старт anonymous. Данные in-memory.
 */
const meta: Meta<typeof RegisterSurface> = {
  title: "Auth/Register",
  component: RegisterSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof RegisterSurface>;

export const Default: Story = { name: "Регистрация" };
