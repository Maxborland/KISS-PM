import type { Meta, StoryObj } from "@storybook/react";

import { MoneyValue } from "./money-value";

const meta: Meta<typeof MoneyValue> = {
  title: "Composites/MoneyValue",
  component: MoneyValue,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof MoneyValue>;

export const Default: Story = {
  name: "Сумма",
  render: () => <MoneyValue amount={1_250_000} />
};

export const Muted: Story = {
  name: "Приглушённая",
  render: () => <MoneyValue amount={480_000} muted />
};
