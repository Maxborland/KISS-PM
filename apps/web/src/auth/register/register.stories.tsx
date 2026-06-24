import type { Meta, StoryObj } from "@storybook/react";

import { RegisterSurface } from "@/auth/register/register-surface";

/**
 * Auth — поверхность «Регистрация» (GREENFIELD-контракт).
 *
 * ЧЕСТНОСТЬ: реальный submit идёт в мок через useAuth().register
 * (createAuthClient + in-memory fetchImpl, НЕ demoAction-заглушка). При ok бэк-мок
 * делает авто-логин (refresh → authenticated), и поверхность показывает
 * «Аккаунт создан, вы вошли как {name}». Боевого API регистрации пока нет —
 * это предложенный контракт (плашка GREENFIELD).
 *
 * Ошибки → FormError: invalid_register_payload / weak_password / email_taken.
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
