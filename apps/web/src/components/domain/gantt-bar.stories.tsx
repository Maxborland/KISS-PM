import type { Meta, StoryObj } from "@storybook/react";

import { GanttBar } from "./gantt-bar";

const meta: Meta<typeof GanttBar> = {
  title: "Composites/GanttBar",
  component: GanttBar,
  tags: ["autodocs"],
  parameters: { layout: "padded" }
};

export default meta;
type Story = StoryObj<typeof GanttBar>;

export const Variants: Story = {
  name: "Варианты",
  render: () => (
    <div className="catalog-section__body catalog-section__body--narrow">
      <GanttBar label="Проектирование API" progress={65} />
      <GanttBar label="Интеграционные тесты" progress={40} variant="at-risk" />
      <GanttBar label="Релиз" progress={10} variant="overdue" />
    </div>
  )
};
