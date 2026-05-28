import type { Meta, StoryObj } from "@storybook/react";

import { GanttBarDemo } from "./gantt-bar-demo";

const meta: Meta<typeof GanttBarDemo> = {
  title: "Composites/GanttBarDemo",
  component: GanttBarDemo,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Статическая полоса для каталога Composites. Интерактивная полоса диаграммы — в `Widgets/Gantt` (`GanttChartBar`)."
      }
    }
  }
};

export default meta;
type Story = StoryObj<typeof GanttBarDemo>;

export const Variants: Story = {
  name: "Состояния",
  render: () => (
    <div className="catalog-section__body catalog-section__body--narrow">
      <GanttBarDemo label="Проектирование API" progress={65} />
      <GanttBarDemo label="Интеграционные тесты" progress={40} variant="at-risk" />
      <GanttBarDemo label="Релиз" progress={10} variant="overdue" />
    </div>
  )
};
