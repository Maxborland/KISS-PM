import type { Meta, StoryObj } from "@storybook/react";

import { ProjectProducts } from "@/crm/products/products-surface";

/**
 * CRM — справочник «Продукты» на реальном контракте (GET/POST/PATCH /api/workspace/products).
 * Услуги/товары, цена — положительное целое (₽). Список + создание + архив/восстановление.
 * Данные in-memory.
 */
const meta: Meta<typeof ProjectProducts> = {
  title: "CRM/Products",
  component: ProjectProducts,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ProjectProducts>;

export const Default: Story = { name: "Продукты" };
