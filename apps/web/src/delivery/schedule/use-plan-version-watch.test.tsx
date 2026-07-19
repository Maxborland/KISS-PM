/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanRealtimeEvent } from "@kiss-pm/planning-client";

import { PlanUpdatedBanner, usePlanVersionWatch, type PlanEventsSubscriber } from "./use-plan-version-watch";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Fake-источник план-событий вместо EventSource: копит подписки, emit доставляет всем активным. */
function createFakePlanEvents() {
  const callbacks = new Set<(event: PlanRealtimeEvent) => void>();
  const unsubscribed: string[] = [];
  const subscribe: PlanEventsSubscriber = vi.fn((_origin, projectId, callback) => {
    callbacks.add(callback);
    return {
      unsubscribe() {
        callbacks.delete(callback);
        unsubscribed.push(projectId);
      }
    };
  });
  return {
    subscribe,
    unsubscribed,
    get active() { return callbacks.size; },
    emit(event: PlanRealtimeEvent) {
      for (const callback of [...callbacks]) callback(event);
    }
  };
}

function Probe({
  projectId,
  clientPlanVersion,
  enabled,
  subscribe,
  onReload
}: {
  projectId: string;
  clientPlanVersion: number | null;
  enabled: boolean;
  subscribe: PlanEventsSubscriber;
  onReload?: () => void;
}) {
  const { remotePlanVersion } = usePlanVersionWatch({ projectId, enabled, clientPlanVersion, subscribe });
  return remotePlanVersion != null
    ? <PlanUpdatedBanner version={remotePlanVersion} onReload={onReload ?? (() => {})} />
    : <span data-testid="no-banner" />;
}

describe("usePlanVersionWatch", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  const banner = () => container.querySelector('[data-testid="plan-updated-banner"]');

  it("показывает баннер, когда событие несёт planVersion больше клиентской", () => {
    const source = createFakePlanEvents();
    act(() => root.render(<Probe projectId="p-1" clientPlanVersion={3} enabled subscribe={source.subscribe} />));
    expect(banner()).toBeNull();

    act(() => source.emit({ type: "planVersionChanged", projectId: "p-1", planVersion: 5 }));

    expect(banner()).not.toBeNull();
    expect(banner()!.textContent).toContain("План обновлён другим пользователем (v5)");
    expect(banner()!.textContent).toContain("Обновить");
  });

  it("не показывает баннер на собственное обновление: после apply клиентская версия уже актуальна", () => {
    const source = createFakePlanEvents();
    // собственный apply уже поднял клиентскую версию до 5 — эхо-событие о том же коммите
    act(() => root.render(<Probe projectId="p-1" clientPlanVersion={5} enabled subscribe={source.subscribe} />));

    act(() => source.emit({ type: "planVersionChanged", projectId: "p-1", planVersion: 5 }));
    act(() => source.emit({ type: "planVersionChanged", projectId: "p-1", planVersion: 4 }));

    expect(banner()).toBeNull();
  });

  it("снимает баннер, когда клиентская версия догоняет удалённую (reload или свой apply)", () => {
    const source = createFakePlanEvents();
    act(() => root.render(<Probe projectId="p-1" clientPlanVersion={3} enabled subscribe={source.subscribe} />));
    act(() => source.emit({ type: "planVersionChanged", projectId: "p-1", planVersion: 5 }));
    expect(banner()).not.toBeNull();

    act(() => root.render(<Probe projectId="p-1" clientPlanVersion={5} enabled subscribe={source.subscribe} />));

    expect(banner()).toBeNull();
  });

  it("игнорирует события чужого проекта и planSnapshotInvalidated без версии", () => {
    const source = createFakePlanEvents();
    act(() => root.render(<Probe projectId="p-1" clientPlanVersion={3} enabled subscribe={source.subscribe} />));

    act(() => source.emit({ type: "planVersionChanged", projectId: "p-2", planVersion: 99 }));
    act(() => source.emit({ type: "planSnapshotInvalidated", projectId: "p-1", reason: "recalc" }));

    expect(banner()).toBeNull();
  });

  it("держит наибольшую пришедшую версию при серии чужих коммитов", () => {
    const source = createFakePlanEvents();
    act(() => root.render(<Probe projectId="p-1" clientPlanVersion={3} enabled subscribe={source.subscribe} />));

    act(() => source.emit({ type: "planVersionChanged", projectId: "p-1", planVersion: 6 }));
    act(() => source.emit({ type: "planVersionChanged", projectId: "p-1", planVersion: 5 }));

    expect(banner()!.textContent).toContain("(v6)");
  });

  it("не открывает подписку в mock-режиме (enabled=false) и отписывается при размонтировании", () => {
    const disabled = createFakePlanEvents();
    act(() => root.render(<Probe projectId="p-1" clientPlanVersion={3} enabled={false} subscribe={disabled.subscribe} />));
    expect(disabled.subscribe).not.toHaveBeenCalled();

    const source = createFakePlanEvents();
    act(() => root.render(<Probe projectId="p-1" clientPlanVersion={3} enabled subscribe={source.subscribe} />));
    expect(source.active).toBe(1);
    act(() => root.unmount());
    expect(source.active).toBe(0);
    expect(source.unsubscribed).toEqual(["p-1"]);
    // afterEach unmount на уже размонтированном root безопасен, но пересоздадим для чистоты
    root = createRoot(container);
  });

  it("при смене projectId переподписывается и снимает баннер прежнего проекта", () => {
    const source = createFakePlanEvents();
    act(() => root.render(<Probe projectId="p-1" clientPlanVersion={3} enabled subscribe={source.subscribe} />));
    act(() => source.emit({ type: "planVersionChanged", projectId: "p-1", planVersion: 5 }));
    expect(banner()).not.toBeNull();

    act(() => root.render(<Probe projectId="p-2" clientPlanVersion={3} enabled subscribe={source.subscribe} />));

    expect(banner()).toBeNull();
    expect(source.unsubscribed).toEqual(["p-1"]);
    expect(source.subscribe).toHaveBeenLastCalledWith("", "p-2", expect.any(Function));

    act(() => source.emit({ type: "planVersionChanged", projectId: "p-2", planVersion: 4 }));
    expect(banner()!.textContent).toContain("(v4)");
  });

  it("кнопка «Обновить» вызывает переданный reload (без автоперезагрузки до клика)", () => {
    const source = createFakePlanEvents();
    const onReload = vi.fn();
    act(() => root.render(<Probe projectId="p-1" clientPlanVersion={3} enabled subscribe={source.subscribe} onReload={onReload} />));
    act(() => source.emit({ type: "planVersionChanged", projectId: "p-1", planVersion: 5 }));
    expect(onReload).not.toHaveBeenCalled();

    const button = [...container.querySelectorAll("button")].find((el) => el.textContent?.includes("Обновить"));
    expect(button).toBeTruthy();
    act(() => button!.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
