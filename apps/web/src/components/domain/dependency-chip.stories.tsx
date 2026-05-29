import type { Meta, StoryObj } from "@storybook/react";

import { DependencyChip } from "./dependency-chip";

const meta: Meta<typeof DependencyChip> = {
  title: "Composites/DependencyChip",
  component: DependencyChip,
  tags: ["autodocs"],
  parameters: { layout: "centered" }
};

export default meta;
type Story = StoryObj<typeof DependencyChip>;

export const Examples: Story = {
  name: "Форматы",
  render: () => (
    <div className="ds-demo__row">
      <DependencyChip rowNumber={3} lagDays={2} />
      <DependencyChip rowNumber={4} type="SS" lagDays={-1} />
      <DependencyChip rowNumber={7} type="FF" />
    </div>
  )
};
