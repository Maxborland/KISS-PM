import type { Meta, StoryObj } from "@storybook/react";

import { AdminAuditSurface } from "@/admin/audit/audit-surface";

/**
 * Администрирование — «Аудит» на реальном контракте (GET /api/tenant/current/audit-events,
 * createAdminClient + in-memory mock). Таблица последних управленческих/системных событий:
 * человекочитаемый action-тип (+ сырой код), затронутая сущность, результат
 * (Успешно/Ошибка/Отклонено правами) и время. Данные in-memory.
 */
const meta: Meta<typeof AdminAuditSurface> = {
  title: "Admin/Audit",
  component: AdminAuditSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof AdminAuditSurface>;

export const Default: Story = { name: "Аудит" };
