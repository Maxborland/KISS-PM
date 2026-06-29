import type { Meta, StoryObj } from "@storybook/react";

import { DealCard } from "@/crm/deals/deal-card-surface";

/**
 * CRM — «Карточка сделки» на реальном контракте (createCrmClient + in-memory mock;
 * переключение на боевой API = смена apiOrigin). Правка полей — PATCH /opportunities/:id
 * (full-replace: статус/воронка/feasibility — server-managed); проверка осуществимости —
 * POST /:id/feasibility (доменная оценка ресурсов); активация — POST /:id/activate (создаёт
 * проект, сделка → won_closed; требует пройденной feasibility); лента — /crm/opportunity/:id/activity
 * (комментарии, задачи с переключением статуса, файлы). Селектор сверху переключает сделки —
 * видны разные состояния (осуществимость ok/warning/conflict, завершённая/закрытая). Данные in-memory.
 */
const meta: Meta<typeof DealCard> = {
  title: "CRM/Deal Card",
  component: DealCard,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof DealCard>;

export const Default: Story = { name: "Карточка сделки" };
