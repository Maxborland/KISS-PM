import type { Meta, StoryObj } from "@storybook/react";

import { ProjectClients } from "@/crm/clients/clients-surface";

/**
 * CRM — справочник «Клиенты» на реальном контракте (GET/POST/PATCH /api/workspace/clients,
 * createCrmClient + in-memory mock). Список с производными «Контактов/Сделок/Сумма» (из
 * opportunities), создание и архив/восстановление (PATCH status). Данные in-memory.
 */
const meta: Meta<typeof ProjectClients> = {
  title: "CRM/Clients",
  component: ProjectClients,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ProjectClients>;

export const Default: Story = { name: "Клиенты" };
