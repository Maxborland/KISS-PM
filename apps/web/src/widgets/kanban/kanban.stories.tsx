import type { Meta, StoryObj } from "@storybook/react";

import { KanbanWidgetDemo } from "@/widgets/kanban/kanban-widget-demo";

const meta: Meta<typeof KanbanWidgetDemo> = {
  title: "Widgets/Kanban",
  component: KanbanWidgetDemo,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof KanbanWidgetDemo>;

/** Единая витрина generic-виджета. Экраны (Моя работа и др.) используют тот же `<Kanban>` со своим renderCard. */
export const Widget: Story = {
  name: "Виджет",
  render: () => (
    <div className="app-canvas app-content">
      <KanbanWidgetDemo />
    </div>
  )
};
