import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";

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

/** Scoped selectors для DnD-карточек (без глобального getByText). */
export const DragTargets: Story = {
  name: "DnD targets",
  render: () => (
    <div className="app-canvas app-content">
      <KanbanWidgetDemo />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const root = canvasElement.querySelector('[data-testid="kanban-widget-demo"]') ?? canvasElement;
    const canvas = within(root as HTMLElement);
    expect(canvas.getByText("MDS-39")).toBeTruthy();
    const card = root.querySelector<HTMLElement>('[data-card-id="MDS-39"]');
    const column = root.querySelector<HTMLElement>('[data-col-id="in-progress"]');
    expect(card).toBeTruthy();
    expect(column).toBeTruthy();
    expect(column?.querySelector(".kanban-col__accent")).toBeTruthy();
  }
};
