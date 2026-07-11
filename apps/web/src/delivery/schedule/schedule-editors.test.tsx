/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DateEditor, DependencyEditor, LinkLagEditor, TaskModal, type TaskModalProps, type TaskModalValues } from "./schedule-editors";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/delivery/lib/use-resource-directory", () => ({
  useResourceDirectory: (resources: readonly unknown[] = []) => ({ list: resources })
}));

const initial: TaskModalValues = {
  title: "Initial title",
  assigneeId: "",
  startIso: "2026-07-10",
  durDays: 2,
  workH: 12,
  pct: 0
};

let root: Root | null = null;

async function renderModal(props: Partial<TaskModalProps> = {}) {
  const host = document.body.appendChild(document.createElement("div"));
  root = createRoot(host);
  await act(async () => {
    root!.render(
      <TaskModal
        open
        mode="edit"
        initial={initial}
        resources={[]}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn(() => ({ accepted: true }))}
        {...props}
      />
    );
  });
}

function buttonWithText(text: string): HTMLButtonElement {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")]
    .find((candidate) => candidate.textContent === text);
  if (!button) throw new Error(`Button not found: ${text}`);
  return button;
}

async function replaceTitle(value: string) {
  const input = document.querySelector<HTMLInputElement>('[role="dialog"] input:not([type])');
  if (!input) throw new Error("Title input not found");
  await act(async () => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setValue?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return input;
}

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  document.body.replaceChildren();
});

describe("TaskModal", () => {
  it("calculates units from the supplied working minutes per day", async () => {
    await renderModal({ workingMinutesPerDay: 360 });

    expect(document.body.textContent).toContain("Единицы ≈ 100%");
    expect(document.body.textContent).toContain("Длит × 6ч × Ед.");
  });

  it("closes after an explicitly accepted submit", async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn(() => ({ accepted: true }));
    await renderModal({ onOpenChange, onSubmit });

    await act(async () => buttonWithText("Сохранить").click());

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the modal and edited draft after a local rejection", async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn(() => ({ accepted: false }));
    await renderModal({ onOpenChange, onSubmit });
    const input = await replaceTitle("Unsaved permission draft");

    await act(async () => buttonWithText("Сохранить").click());

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: "Unsaved permission draft" }));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(input.value).toBe("Unsaved permission draft");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("keeps the modal and edited draft when the submit promise rejects", async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn(async () => Promise.reject(new Error("permission_denied")));
    await renderModal({ onOpenChange, onSubmit });
    const input = await replaceTitle("Unsaved rejected draft");

    await act(async () => buttonWithText("Сохранить").click());

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(input.value).toBe("Unsaved rejected draft");
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it("keeps legacy void submit callbacks type-compatible without treating them as accepted", async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn(() => undefined);
    await renderModal({ onOpenChange, onSubmit });

    await act(async () => buttonWithText("Сохранить").click());

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("DateEditor", () => {
  it("submits the current input value even before the state rerender", async () => {
    const onPick = vi.fn();
    const host = document.body.appendChild(document.createElement("div"));
    root = createRoot(host);
    await act(async () => {
      root!.render(<DateEditor valueIso="2027-01-13" onPick={onPick}><button>Open date</button></DateEditor>);
    });
    await act(async () => buttonWithText("Open date").click());
    const input = document.querySelector<HTMLInputElement>('input[type="date"]');
    expect(input).not.toBeNull();

    await act(async () => {
      input!.value = "2027-01-20";
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      buttonWithText("Применить").click();
    });

    expect(onPick).toHaveBeenCalledWith("2027-01-20");
  });
});
describe("DependencyEditor", () => {
  it("formats positive and negative lag without a '+-' prefix", async () => {
    const host = document.body.appendChild(document.createElement("div"));
    root = createRoot(host);
    await act(async () => {
      root!.render(
        <DependencyEditor
          preds={[
            { depId: "positive", predId: "one", predLabel: "1", type: "FS", lagDays: 2 },
            { depId: "negative", predId: "two", predLabel: "2", type: "FS", lagDays: -2 }
          ]}
          options={[]}
          onAdd={vi.fn()}
          onRemove={vi.fn()}
        >
          <button>Open dependencies</button>
        </DependencyEditor>
      );
    });
    await act(async () => buttonWithText("Open dependencies").click());

    expect(document.body.textContent).toContain("ОН +2д");
    expect(document.body.textContent).toContain("ОН -2д");
    expect(document.body.textContent).not.toContain("+-2");
  });
});
describe("LinkLagEditor", () => {
  it("does not submit an unchanged type and lag", async () => {
    const onSave = vi.fn();
    const host = document.body.appendChild(document.createElement("div"));
    root = createRoot(host);
    await act(async () => {
      root!.render(
        <LinkLagEditor type="FS" lagDays={2} onSave={onSave} onDelete={vi.fn()}>
          <button>Open link lag</button>
        </LinkLagEditor>
      );
    });
    await act(async () => buttonWithText("Open link lag").click());
    await act(async () => buttonWithText("Сохранить").click());

    expect(onSave).not.toHaveBeenCalled();
  });
  it("submits current DOM values during a rapid edit", async () => {
    const onSave = vi.fn();
    const host = document.body.appendChild(document.createElement("div"));
    root = createRoot(host);
    await act(async () => {
      root!.render(
        <LinkLagEditor type="FS" lagDays={-2} onSave={onSave} onDelete={vi.fn()}>
          <button>Open rapid link lag</button>
        </LinkLagEditor>
      );
    });
    await act(async () => buttonWithText("Open rapid link lag").click());
    const select = document.querySelector<HTMLSelectElement>("select");
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Лаг, дней"]');
    expect(select).not.toBeNull();
    expect(input).not.toBeNull();

    await act(async () => {
      select!.value = "SS";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
      input!.value = "3";
      input!.dispatchEvent(new Event("input", { bubbles: true }));
      buttonWithText("Сохранить").click();
    });

    expect(onSave).toHaveBeenCalledWith("SS", 3);
  });
});