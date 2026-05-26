import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, waitFor, within } from "@storybook/test";

import { KanbanWidgetDemo } from "@/widgets/kanban/kanban-widget-demo";

function kanbanColumnByTitle(root: HTMLElement, title: string): HTMLElement {
  const cols = root.querySelectorAll<HTMLElement>(".kanban-col");
  for (const col of cols) {
    const head = col.querySelector(".kanban-col__title");
    const label = head?.textContent?.trim() ?? "";
    if (label.startsWith(title)) return col;
  }
  throw new Error(`Kanban column "${title}" not found`);
}

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
    const root = (canvasElement.querySelector('[data-testid="kanban-widget-demo"]') ??
      canvasElement) as HTMLElement;
    const canvas = within(root);
    expect(canvas.getByText("MDS-39")).toBeTruthy();
    const card = root.querySelector<HTMLElement>('[data-card-id="MDS-39"]');
    const column = root.querySelector<HTMLElement>('[data-col-id="in-progress"]');
    expect(card).toBeTruthy();
    expect(column).toBeTruthy();
    expect(column?.querySelector(".kanban-col__accent")).toBeTruthy();

    const target = kanbanColumnByTitle(root, "В работе");
    const cardRect = card!.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    fireEvent.pointerDown(card!, {
      pointerId: 1,
      button: 0,
      clientX: cardRect.left + 8,
      clientY: cardRect.top + 8
    });
    fireEvent.pointerMove(card!, {
      pointerId: 1,
      clientX: cardRect.left + 60,
      clientY: cardRect.top + 60
    });
    fireEvent.pointerMove(target, {
      pointerId: 1,
      clientX: targetRect.left + targetRect.width / 2,
      clientY: targetRect.top + targetRect.height / 2
    });
    fireEvent.pointerUp(target, {
      pointerId: 1,
      clientX: targetRect.left + targetRect.width / 2,
      clientY: targetRect.top + targetRect.height / 2
    });

    await waitFor(() => {
      const inProgressCol = kanbanColumnByTitle(root, "В работе");
      expect(within(inProgressCol).queryByText("Новая страница продукта")).toBeTruthy();
    });
  }
};
