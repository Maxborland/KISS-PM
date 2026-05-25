import type { Meta, StoryObj } from "@storybook/react";

import { CapacityBar } from "./capacity-bar";

const meta: Meta<typeof CapacityBar> = {
  title: "Composites/CapacityBar",
  component: CapacityBar,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof CapacityBar>;

export const States: Story = {
  name: "Состояния",
  render: () => (
    <div className="catalog-section__body">
      <CapacityBar label="Иванов И." used={32} capacity={40} />
      <CapacityBar label="Петрова А." used={36} capacity={40} />
      <CapacityBar label="Сидоров К." used={44} capacity={40} />
    </div>
  )
};
