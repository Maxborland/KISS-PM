import { expect, userEvent, waitFor } from "@storybook/test";

function kanbanItemInColumn(col: HTMLElement, itemId: string): Element | null {
  return (
    col.querySelector(`[data-item-id="${itemId}"]`) ?? col.querySelector(`[data-card-id="${itemId}"]`)
  );
}

/** Корень Kanban в story (виджет или экран «Моя работа»). */
export function kanbanPlayRoot(canvasElement: HTMLElement): HTMLElement {
  const scoped =
    canvasElement.querySelector<HTMLElement>('[data-testid="kanban-widget-demo"]') ??
    canvasElement.querySelector<HTMLElement>(".my-work__board") ??
    canvasElement.querySelector<HTMLElement>(".kanban");
  return scoped ?? canvasElement;
}

/** Колонка Kanban/Funnel по префиксу заголовка в `.kanban-col__title`. */
export function kanbanColumnByTitle(root: HTMLElement, titlePrefix: string): HTMLElement {
  const cols = root.querySelectorAll<HTMLElement>(".kanban-col");
  for (const col of cols) {
    const head = col.querySelector(".kanban-col__title");
    const label = head?.textContent?.trim() ?? "";
    if (label.startsWith(titlePrefix)) return col;
  }
  throw new Error(`Kanban column "${titlePrefix}" not found`);
}

/** Sortable slot с listeners @dnd-kit (не внутренняя `.kanban-card`). */
export function kanbanItemSlot(root: HTMLElement, itemId: string): HTMLElement {
  const slot =
    root.querySelector<HTMLElement>(`[data-item-id="${itemId}"]`) ??
    root.querySelector<HTMLElement>(`[data-card-id="${itemId}"]`)?.closest<HTMLElement>(".kanban-item-slot");
  if (!slot) {
    throw new Error(`Kanban item slot "${itemId}" not found`);
  }
  return slot;
}

/**
 * Pointer drag для @dnd-kit PointerSensor (activationConstraint.distance = 4).
 * События на `.kanban-item-slot`; drop в тело колонки.
 * Успех: карточка с `data-item-id` в целевой колонке (не только поиск текста).
 */
export async function playKanbanPointerDrag(
  root: HTMLElement,
  itemId: string,
  targetColumnTitle: string,
  expectedTitleInTarget?: string
): Promise<void> {
  await waitFor(
    () => {
      kanbanItemSlot(root, itemId);
    },
    { timeout: 5000 }
  );

  const slot = kanbanItemSlot(root, itemId);
  const targetCol = kanbanColumnByTitle(root, targetColumnTitle);
  const dropEl = targetCol.querySelector<HTMLElement>(".kanban-col__body") ?? targetCol;

  const from = slot.getBoundingClientRect();
  const to = dropEl.getBoundingClientRect();

  const startX = from.left + from.width / 2;
  const startY = from.top + from.height / 2;
  const endX = to.left + to.width / 2;
  const endY = to.top + Math.min(to.height / 2, 140);

  const pointerSteps: Parameters<typeof userEvent.pointer>[0] = [
    { keys: "[MouseLeft>]", target: slot, coords: { clientX: startX, clientY: startY } },
    { pointerName: "mouse", coords: { clientX: startX + 8, clientY: startY + 8 } }
  ];

  const steps = 12;
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    pointerSteps.push({
      pointerName: "mouse",
      coords: {
        clientX: startX + (endX - startX) * t,
        clientY: startY + (endY - startY) * t
      }
    });
  }

  const releaseTarget = dropEl.ownerDocument.body;

  pointerSteps.push(
    { pointerName: "mouse", target: dropEl, coords: { clientX: endX, clientY: endY } },
    { keys: "[/MouseLeft]", target: releaseTarget, coords: { clientX: endX, clientY: endY } }
  );

  await userEvent.pointer(pointerSteps);

  await waitFor(
    () => {
      const col = kanbanColumnByTitle(root, targetColumnTitle);
      const moved = kanbanItemInColumn(col, itemId);
      expect(moved).toBeTruthy();
      if (expectedTitleInTarget && moved) {
        const titleEl = moved.querySelector(".kanban-card__title");
        expect(titleEl?.textContent?.trim()).toBe(expectedTitleInTarget);
      }
    },
    { timeout: 5000 }
  );
}
