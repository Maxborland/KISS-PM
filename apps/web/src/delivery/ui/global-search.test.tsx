// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalSearch } from "./global-search";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));

vi.mock("@/shell/use-session-user", () => ({
  useSessionState: () => ({
    loaded: true,
    user: {
      id: "user-admin",
      name: "Администратор",
      permissions: ["tenant.projects.read", "tenant.opportunities.read", "tenant.opportunities.manage"]
    }
  })
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function jsonResponse(results: unknown[]): Response {
  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

async function waitForDebounce() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 330)));
}

async function setCommandInput(value: string) {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Поиск и команды"]');
  expect(input).not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function pressShortcut() {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      cancelable: true
    }));
  });
}

describe("GlobalSearch command palette", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    push.mockReset();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root.render(<GlobalSearch />));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await act(async () => root.unmount());
    document.body.replaceChildren();
  });

  it("opens with Ctrl+K and returns focus to the actual initiator", async () => {
    const initiator = document.createElement("button");
    initiator.textContent = "Инициатор";
    document.body.prepend(initiator);
    initiator.focus();

    await pressShortcut();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(document.activeElement).toBe(document.querySelector('input[aria-label="Поиск и команды"]'));

    await pressShortcut();
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(document.activeElement).toBe(initiator);
  });

  it("requests only palette entity types and exposes an honest empty state", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await pressShortcut();
    await setCommandInput("вектор");
    await waitForDebounce();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost");
    expect(url.searchParams.get("types")).toBe("project,task,opportunity");
    expect(url.searchParams.get("limit")).toBe("15");
    expect(document.body.textContent).toContain("Ничего не найдено по «вектор»");
  });

  it("keeps server matches that do not occur in the visible title", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{
      id: "task:description-match",
      type: "task",
      title: "Подготовить оценку",
      subtitle: "Проект Вектор",
      snippet: "Уникальный термин только в описании",
      route: "/projects/project-vektor",
      entityId: "description-match"
    }]));
    vi.stubGlobal("fetch", fetchMock);

    await pressShortcut();
    await setCommandInput("уникальный термин");
    await waitForDebounce();
    await act(async () => Promise.resolve());

    expect(document.body.textContent).toContain("Подготовить оценку");
    const item = document.querySelector('[cmdk-item][data-value="task:description-match"]');
    expect(item).not.toBeNull();
    expect(item?.closest("[cmdk-group]")?.hasAttribute("hidden")).toBe(false);
    expect(document.body.textContent).not.toContain("Ничего не найдено");
  });

  it("does not let a stale response replace a newer query", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    vi.stubGlobal("fetch", fetchMock);

    await pressShortcut();
    await setCommandInput("alpha");
    await waitForDebounce();
    await setCommandInput("beta");
    await waitForDebounce();

    second.resolve(jsonResponse([{
      id: "project:beta",
      type: "project",
      title: "Beta project",
      subtitle: "Client",
      snippet: "active",
      route: "/projects/beta",
      entityId: "beta"
    }]));
    await act(async () => Promise.resolve());

    first.resolve(jsonResponse([{
      id: "project:alpha",
      type: "project",
      title: "Alpha project",
      subtitle: "Client",
      snippet: "active",
      route: "/projects/alpha",
      entityId: "alpha"
    }]));
    await act(async () => Promise.resolve());

    expect(document.body.textContent).toContain("Beta project");
    expect(document.body.textContent).not.toContain("Alpha project");
  });
});
