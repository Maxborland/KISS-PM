import type { Meta, StoryObj } from "@storybook/react";

import { ProjectContacts } from "@/crm/contacts/contacts-surface";

/**
 * CRM — справочник «Контакты» на реальном контракте (GET/POST/PATCH /api/workspace/contacts).
 * Контакт создаётся только к активному клиенту; email нормализуется (lowercase) и валидируется.
 * Список + создание + архив/восстановление. Данные in-memory.
 */
const meta: Meta<typeof ProjectContacts> = {
  title: "CRM/Contacts",
  component: ProjectContacts,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ProjectContacts>;

export const Default: Story = { name: "Контакты" };
