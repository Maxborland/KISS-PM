import type { Meta, StoryObj } from "@storybook/react";

import { AdminSecuritySurface } from "@/admin/security/security-surface";

/**
 * Администрирование — «Безопасность» на реальном контракте (GET/PUT
 * /api/tenant/current/security-policy, createAdminClient + in-memory mock).
 * Карточка политик: тайм-аут сессии (1…8760) и whitelist email-доменов;
 * 2FA/SSO не реализованы — вместо контролов честный роадмап-текст (Н5),
 * поля контракта reserved. Сохранение нормализует список (trim/lowercase/dedup)
 * и честно демонстрирует коды валидации (security_policy_session_timeout_invalid).
 * Данные in-memory.
 */
const meta: Meta<typeof AdminSecuritySurface> = {
  title: "Admin/Security",
  component: AdminSecuritySurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof AdminSecuritySurface>;

export const Default: Story = { name: "Безопасность" };
