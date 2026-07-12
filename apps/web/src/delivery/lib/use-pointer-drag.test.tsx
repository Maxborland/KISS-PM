/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { usePointerDrag } from "./use-pointer-drag";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type S = { startX: number; delta: number };

function pointerEvent(type: string, init: { pointerId: number; clientX?: number; clientY?: number }): Event {
  // happy-dom не имеет PointerEvent-конструктора со всеми полями — собираем вручную.
  const event = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    pointerId: number;
    clientX: number;
    clientY: number;
  };
  event.pointerId = init.pointerId;
  event.clientX = init.clientX ?? 0;
  event.clientY = init.clientY ?? 0;
  return event;
}

function setup() {
  const onMove = vi.fn((e: PointerEvent, cur: S, set: (next: S) => void) => {
    set({ ...cur, delta: e.clientX - cur.startX });
  });
  const onUp = vi.fn();
  const onCancel = vi.fn();
  let api: ReturnType<typeof usePointerDrag<S>> | null = null;

  function Harness() {
    api = usePointerDrag<S>({ onMove, onUp, onCancel });
    return <div data-state={api.state ? "active" : "idle"} />;
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return {
    onMove,
    onUp,
    onCancel,
    getApi: () => api!,
    async render() {
      await act(async () => { root.render(<Harness />); });
      return root;
    },
    root
  };
}

async function fire(event: Event): Promise<void> {
  await act(async () => { window.dispatchEvent(event); });
}

describe("usePointerDrag lifecycle", () => {
  let root: Root | null = null;
  afterEach(async () => {
    if (root) await act(async () => { root!.unmount(); });
    root = null;
    document.body.replaceChildren();
  });

  it("activates only after the movement threshold; a plain click is not a gesture", async () => {
    const h = setup();
    root = await h.render();
    await act(async () => { h.getApi().begin({ pointerId: 1, clientX: 100, clientY: 10 }, { startX: 100, delta: 0 }); });

    // Микросдвиг ниже порога + отпускание = клик: ни onMove, ни onUp.
    await fire(pointerEvent("pointermove", { pointerId: 1, clientX: 101, clientY: 10 }));
    expect(h.getApi().state).toBeNull();
    await fire(pointerEvent("pointerup", { pointerId: 1, clientX: 101, clientY: 10 }));
    expect(h.onMove).not.toHaveBeenCalled();
    expect(h.onUp).not.toHaveBeenCalled();
    expect(h.onCancel).not.toHaveBeenCalled();
  });

  it("runs move/up for a real gesture and filters foreign pointerIds", async () => {
    const h = setup();
    root = await h.render();
    await act(async () => { h.getApi().begin({ pointerId: 1, clientX: 100, clientY: 10 }, { startX: 100, delta: 0 }); });

    await fire(pointerEvent("pointermove", { pointerId: 1, clientX: 110, clientY: 10 }));
    expect(h.getApi().state).toEqual({ startX: 100, delta: 10 });
    // Чужой указатель (второй палец) игнорируется целиком.
    await fire(pointerEvent("pointermove", { pointerId: 2, clientX: 500, clientY: 10 }));
    await fire(pointerEvent("pointerup", { pointerId: 2, clientX: 500, clientY: 10 }));
    expect(h.getApi().state).toEqual({ startX: 100, delta: 10 });

    await fire(pointerEvent("pointerup", { pointerId: 1, clientX: 110, clientY: 10 }));
    expect(h.onUp).toHaveBeenCalledTimes(1);
    expect(h.onUp.mock.calls[0]![1]).toEqual({ startX: 100, delta: 10 });
    expect(h.getApi().state).toBeNull();
  });

  it("pointercancel and Escape cancel without onUp (no mutation path)", async () => {
    const h = setup();
    root = await h.render();

    // pointercancel (обрыв touch/OS-жестом)
    await act(async () => { h.getApi().begin({ pointerId: 1, clientX: 0, clientY: 0 }, { startX: 0, delta: 0 }); });
    await fire(pointerEvent("pointermove", { pointerId: 1, clientX: 20, clientY: 0 }));
    await fire(pointerEvent("pointercancel", { pointerId: 1 }));
    expect(h.onUp).not.toHaveBeenCalled();
    expect(h.onCancel).toHaveBeenCalledTimes(1);
    expect(h.getApi().state).toBeNull();

    // Escape
    await act(async () => { h.getApi().begin({ pointerId: 3, clientX: 0, clientY: 0 }, { startX: 0, delta: 0 }); });
    await fire(pointerEvent("pointermove", { pointerId: 3, clientX: 30, clientY: 0 }));
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); });
    expect(h.onUp).not.toHaveBeenCalled();
    expect(h.onCancel).toHaveBeenCalledTimes(2);
    // После отмены поздний pointerup того же указателя — no-op.
    await fire(pointerEvent("pointerup", { pointerId: 3, clientX: 30, clientY: 0 }));
    expect(h.onUp).not.toHaveBeenCalled();
  });
});
