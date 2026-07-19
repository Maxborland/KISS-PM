/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectSchedule } from "./schedule-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const READ_MODEL = {
  project: { plannedStart: "2026-07-06" },
  authored: { tasks: [], assignments: [] },
  calculatedPlan: { tasks: [] },
  planVersion: 3
};

const harness = vi.hoisted(() => ({
  setReadModel: vi.fn(),
  reload: vi.fn(),
  apply: vi.fn(),
  applyBatch: vi.fn(),
  confirm: vi.fn()
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

vi.mock("@/delivery/ui/workspace-shell", () => ({
  WorkspaceShell: ({ children }: { children: React.ReactNode }) => <><a href="/projects">Проекты</a>{children}</>
}));

vi.mock("@/views/lib/prototype-gate", () => ({ prototypeNotesEnabled: false }));

// SSE-подписка плана: в юнитах не открываем EventSource (happy-dom полез бы в сеть) — noop-подписка
vi.mock("@kiss-pm/planning-client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  subscribeToPlanEvents: () => ({ unsubscribe() {} })
}));

vi.mock("@/shell/use-session-user", () => ({
  useSessionUser: () => ({ id: "user", name: "Test User", permissions: ["tenant.project_plan.read", "tenant.project_plan.manage"] })
}));

vi.mock("@/delivery/lib/planning-runtime", () => ({
  usePlanningRuntime: () => ({ live: true, fetchImpl: null })
}));

vi.mock("@/delivery/lib/use-planning", () => ({
  usePlanning: () => ({
    readModel: READ_MODEL,
    setReadModel: harness.setReadModel,
    status: "ready",
    error: null,
    reload: harness.reload,
    apply: harness.apply,
    applyBatch: harness.applyBatch
  })
}));

vi.mock("@/delivery/lib/project-chrome", () => ({
  PROJECT_FALLBACK: {},
  deriveProjectMeta: () => ({
    name: "Project",
    code: "PRJ",
    status: "В работе",
    planVersion: "3",
    deadline: "10.07.2026",
    finish: "12.07.2026"
  }),
  planningErr: (value: string) => value,
  useProjectBase: () => ({ name: "Project", code: "PRJ" })
}));

vi.mock("@/delivery/lib/use-resource-directory", () => ({
  useResourceDirectory: () => ({ name: (id: string) => id, list: [] })
}));

vi.mock("@/delivery/lib/use-pointer-drag", () => ({
  usePointerDrag: () => ({ state: null, begin: vi.fn() })
}));

vi.mock("@/delivery/schedule/schedule-rows", () => ({
  mapRows: () => ({ rows: [], deadlineDay: null, projectFinishDay: 5 })
}));

vi.mock("@/delivery/lib/date-origin", () => ({
  currentPlanDate: () => "2026-07-06",
  deriveScheduleTimeline: () => ({ originDay: 0, totalDays: 7, todayOffsetDays: 0 }),
  formatWeekLabel: () => "6-12 Jul"
}));

let root: Root | null = null;

async function renderSchedule() {
  const container = document.body.appendChild(document.createElement("div"));
  root = createRoot(container);
  await act(async () => root!.render(<ProjectSchedule projectId="project-alpha" />));
}

function button(label: string) {
  const match = [...document.querySelectorAll<HTMLButtonElement>("button")]
    .find((candidate) => candidate.textContent?.trim() === label);
  if (!match) throw new Error(`Button not found: ${label}`);
  return match;
}

function tab(label: string) {
  const match = [...document.querySelectorAll<HTMLAnchorElement>("nav a")]
    .find((candidate) => candidate.textContent?.trim() === label);
  if (!match) throw new Error(`Tab not found: ${label}`);
  return match;
}

async function stageTask() {
  await act(async () => button("Пакет").click());
  const input = document.querySelector<HTMLInputElement>('input[placeholder^="Новая задача"]');
  if (!input) throw new Error("Quick-create input not found");

  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "Staged task");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));

  expect(document.body.textContent).toContain("накоплено: 1");
}

function clickAnchor(anchor: HTMLAnchorElement, init: MouseEventInit = {}) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
  return { allowed: anchor.dispatchEvent(event), event };
}

function clickTab(label: string, init: MouseEventInit = {}) {
  return clickAnchor(tab(label), init);
}

beforeEach(() => {
  harness.setReadModel.mockReset();
  harness.reload.mockReset();
  harness.apply.mockReset();
  harness.applyBatch.mockReset();
  harness.confirm.mockReset();
  vi.stubGlobal("confirm", harness.confirm);
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Schedule staged navigation guard", () => {
  it("keeps clean delivery-tab navigation as an unprompted native link", async () => {
    await renderSchedule();

    const overview = tab("Обзор");
    const result = clickTab("Обзор");

    expect(overview.getAttribute("href")).toBe("/projects/project-alpha/overview");
    expect(result.allowed).toBe(true);
    expect(result.event.defaultPrevented).toBe(false);
    expect(harness.confirm).not.toHaveBeenCalled();
  });

  it("cancels navigation and preserves the staged batch", async () => {
    await renderSchedule();
    await stageTask();
    harness.confirm.mockReturnValue(false);

    const result = clickTab("Ресурсы");

    expect(result.allowed).toBe(false);
    expect(result.event.defaultPrevented).toBe(true);
    expect(tab("Ресурсы").getAttribute("href")).toBe("/projects/project-alpha/resources");
    expect(document.body.textContent).toContain("накоплено: 1");
    expect(harness.setReadModel).toHaveBeenCalledTimes(1);
  });

  it("consumes the sentinel before resuming an exact link after confirmation", async () => {
    await renderSchedule();
    await stageTask();
    harness.confirm.mockReturnValue(true);
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    const settings = tab("Настройки");
    const resumedClick = vi.fn((event: MouseEvent) => event.preventDefault());
    settings.addEventListener("click", resumedClick);

    let result!: ReturnType<typeof clickTab>;
    await act(async () => { result = clickTab("Настройки"); });

    expect(result.allowed).toBe(false);
    expect(result.event.defaultPrevented).toBe(true);
    expect(settings.getAttribute("href")).toBe("/projects/project-alpha/settings");
    expect(back).toHaveBeenCalledTimes(1);
    expect(resumedClick).not.toHaveBeenCalled();

    await act(async () => window.dispatchEvent(new PopStateEvent("popstate")));

    expect(resumedClick).toHaveBeenCalledTimes(1);
    expect(harness.confirm).toHaveBeenCalledTimes(1);
    expect(harness.setReadModel).toHaveBeenLastCalledWith(READ_MODEL);
    expect(document.body.textContent).not.toContain("накоплено: 1");
    expect(harness.apply).not.toHaveBeenCalled();
    expect(harness.applyBatch).not.toHaveBeenCalled();
    expect(harness.reload).not.toHaveBeenCalled();
  });

  it("consumes the sentinel after applying a staged batch", async () => {
    harness.applyBatch.mockResolvedValue({ ok: true, planVersion: 4, changed: [] });
    await renderSchedule();
    await stageTask();
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);

    await act(async () => {
      button("Применить пакетом").click();
      await Promise.resolve();
    });

    expect(back).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("накоплено: 1");
    expect(harness.applyBatch).toHaveBeenCalledTimes(1);
  });

  it("consumes the sentinel after discarding a staged batch", async () => {
    await renderSchedule();
    await stageTask();
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);

    await act(async () => button("Сбросить").click());

    expect(back).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("накоплено: 1");
    expect(harness.setReadModel).toHaveBeenLastCalledWith(READ_MODEL);
    expect(harness.applyBatch).not.toHaveBeenCalled();
  });

  it("guards the internal Baseline CTA and workspace sidebar with the same staged prompt", async () => {
    await renderSchedule();
    await stageTask();
    harness.confirm.mockReturnValue(false);

    const baselineLinks = [...document.querySelectorAll<HTMLAnchorElement>('a[href="/projects/project-alpha/baseline"]')];
    expect(baselineLinks.length).toBeGreaterThan(1);
    expect(clickAnchor(baselineLinks.at(-1)!).allowed).toBe(false);
    expect(clickAnchor(document.querySelector<HTMLAnchorElement>('a[href="/projects"]')!).allowed).toBe(false);
    expect(document.body.textContent).toContain("накоплено: 1");
    expect(harness.confirm).toHaveBeenCalledTimes(2);
  });

  it("keeps modified and middle-click link semantics native", async () => {
    await renderSchedule();
    await stageTask();

    expect(clickTab("Настройки", { ctrlKey: true }).allowed).toBe(true);
    expect(clickTab("Настройки", { button: 1 }).allowed).toBe(true);
    expect(harness.confirm).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("накоплено: 1");
  });

  it("restores browser history on cancel and continues traversal on confirm", async () => {
    await renderSchedule();
    await stageTask();
    const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);

    harness.confirm.mockReturnValue(false);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(go).toHaveBeenCalledWith(1);
    expect(back).not.toHaveBeenCalled();

    window.dispatchEvent(new PopStateEvent("popstate"));
    harness.confirm.mockReturnValue(true);
    await act(async () => {
      window.dispatchEvent(new PopStateEvent("popstate"));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    expect(back).toHaveBeenCalledTimes(1);
    expect(harness.setReadModel).toHaveBeenLastCalledWith(READ_MODEL);
  });

  it("protects reload and close only while a batch is staged", async () => {
    await renderSchedule();

    const cleanEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);

    await stageTask();
    const stagedEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(stagedEvent);
    expect(stagedEvent.defaultPrevented).toBe(true);
  });
});
