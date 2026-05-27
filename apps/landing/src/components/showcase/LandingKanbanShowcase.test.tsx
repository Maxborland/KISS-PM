import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import LandingKanbanShowcase from "./LandingKanbanShowcase";

describe("LandingKanbanShowcase", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders control-flow kanban columns", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root.render(<LandingKanbanShowcase />);
    });

    const text = container.textContent ?? "";
    expect(text).toContain("SIG-4128");
    expect(text).toContain("Сигнал");
    expect(text).toContain("Действие");
    expect(text).toContain("Аудит");
    expect(container.querySelector(".kanban-card")).toBeTruthy();
  });
});
