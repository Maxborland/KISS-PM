import type { Meta, StoryObj } from "@storybook/react";

import { ProjectDeals } from "@/crm/deals/deals-surface";

/**
 * CRM — поверхность «Сделки»: воронка продаж на реальном контракте
 * (createCrmClient + in-memory mock; переключение на боевой API = смена apiOrigin).
 * Канбан с drag-and-drop по стадиям (PATCH /opportunities/:id/stage), список со
 * сменой стадии, прогноз (взвешенная сумма). Создание — POST /opportunities с
 * валидацией контакта (активный, у выбранного клиента). CRM — плоский REST без
 * planVersion. Данные in-memory («Прототип»).
 */
const meta: Meta<typeof ProjectDeals> = {
  title: "CRM/Deals",
  component: ProjectDeals,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ProjectDeals>;

export const Default: Story = { name: "Сделки · воронка" };
