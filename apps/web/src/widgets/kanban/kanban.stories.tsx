import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";

import { kanbanPlayRoot, playKanbanPointerDrag } from "@/stories/storybook-kanban-play";
import { KanbanWidgetDemo } from "@/widgets/kanban/kanban-widget-demo";

const meta: Meta<typeof KanbanWidgetDemo> = {
  title: "Widgets/Kanban",
  component: KanbanWidgetDemo,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Канбан для задач и рабочих списков: колонки, карточки, пустые состояния и проверка перетаскивания."
      }
    }
  },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof KanbanWidgetDemo>;

/** Единая витрина generic-виджета. Экраны (Моя работа и др.) используют тот же `<Kanban>` со своим renderCard. */
export const Widget: Story = {
  name: "Обзор",
  render: () => (
    <div className="app-canvas app-content">
      <KanbanWidgetDemo />
    </div>
  )
};

/** Scoped selectors для DnD-карточек (без глобального getByText). */
export const DragTargets: Story = {
  name: "Цели перетаскивания",
  parameters: {
    docs: {
      description: {
        story: "Регрессионная проверка областей drop и scoped selectors для карточек."
      }
    }
  },
  render: () => (
    <div className="app-canvas app-content">
      <KanbanWidgetDemo />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const root = kanbanPlayRoot(canvasElement);
    const canvas = within(root);
    expect(canvas.getByText("MDS-39")).toBeTruthy();
    expect(root.querySelector('[data-col-id="in-progress"]')?.querySelector(".kanban-col__accent")).toBeTruthy();
    await playKanbanPointerDrag(root, "MDS-39", "В работе", "Новая страница продукта");
  }
};
