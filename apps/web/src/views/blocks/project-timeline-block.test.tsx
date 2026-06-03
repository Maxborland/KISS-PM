// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Project, Task } from "@/lib/api-types";
import {
  ProjectTimelineBlock,
  resolveTimelineTaskHref
} from "@/views/blocks/project-timeline-block";
import { ScreenRouteProvider } from "@/views/layout/screen-route-context";
import { getScreenRoute } from "@/views/screens/screen-route";
import type { GanttData, GanttProps } from "@/widgets/gantt";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let lastGanttProps: GanttProps | null = null;

vi.mock("@/widgets/gantt", async () => {
  const actual = await vi.importActual<typeof import("@/widgets/gantt")>("@/widgets/gantt");
  return {
    ...actual,
    Gantt: (props: GanttProps) => {
      lastGanttProps = props;
      return createElement(
        "button",
        {
          "data-testid": "mock-gantt",
          onClick: () => props.onBarClick?.("task-runtime")
        },
        props.data.rows.map((row) => row.name).join(", ")
      );
    }
  };
});

describe("ProjectTimelineBlock", () => {
  let host: HTMLElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    host?.remove();
    host = null;
    root = null;
    lastGanttProps = null;
  });

  it("resolves runtime task rows to project detail task links and ignores summary rows", () => {
    const data = makeGanttData();

    expect(resolveTimelineTaskHref(makeProject(), data, "task-runtime")).toBe(
      "/projects/project-runtime?taskId=task-runtime"
    );
    expect(resolveTimelineTaskHref(makeProject(), data, "project-runtime")).toBeNull();
    expect(resolveTimelineTaskHref(makeProject(), data, "task-missing")).toBeNull();
  });

  it("opens project detail task context from task bar clicks without opening summary rows", async () => {
    const opened: string[] = [];
    await renderTimeline((href) => opened.push(href));

    await act(async () => {
      host?.querySelector<HTMLButtonElement>("[data-testid='mock-gantt']")?.click();
    });

    expect(opened).toEqual(["/projects/project-runtime?taskId=task-runtime"]);

    await act(async () => {
      lastGanttProps?.onBarClick?.("project-runtime");
      lastGanttProps?.onBarDoubleClick?.("task-runtime");
    });

    expect(opened).toEqual([
      "/projects/project-runtime?taskId=task-runtime",
      "/projects/project-runtime?taskId=task-runtime"
    ]);
  });

  it("lets runtime users switch timeline zoom without replacing live task data", async () => {
    await renderTimeline(() => undefined);

    expect(lastGanttProps?.zoom).toBe("day");
    expect(host?.textContent).toContain("Runtime timeline task");

    await act(async () => {
      host?.querySelector<HTMLInputElement>("input[value='week']")?.click();
    });

    expect(lastGanttProps?.zoom).toBe("week");
    expect(host?.textContent).toContain("Runtime timeline task");

    await act(async () => {
      host?.querySelector<HTMLInputElement>("input[value='month']")?.click();
    });

    expect(lastGanttProps?.zoom).toBe("month");
    expect(host?.textContent).toContain("Runtime timeline task");
  });

  it("submits a runtime task due-date update from the timeline", async () => {
    const updates: Array<{ dueDate: string; taskId: string }> = [];
    await renderTimeline(() => undefined, {
      onUpdateTaskDueDate: async (task, dueDate) => {
        updates.push({ dueDate, taskId: task.id });
      }
    });

    const input = host?.querySelector<HTMLInputElement>("input[aria-label='Новый финиш задачи']");
    expect(input?.value).toBe("2026-06-02");

    await act(async () => {
      if (!input) throw new Error("Date input not found");
      setInputValue(input, "2026-06-05");
      input.dispatchEvent(new Event("change", { bubbles: true }));
      host?.querySelector<HTMLFormElement>("form[aria-label='Изменение срока задачи в план-графике']")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(updates).toEqual([{ dueDate: "2026-06-05", taskId: "task-runtime" }]);
  });

  it("keeps timeline date changes honest when update is unavailable or invalid", async () => {
    await renderTimeline(() => undefined);

    expect(host?.querySelector<HTMLButtonElement>("button[type='submit']")?.disabled).toBe(true);
    expect(host?.textContent).toContain(
      "Изменение сроков доступно пользователям с правом редактирования задач."
    );

    await renderTimeline(() => undefined, {
      onUpdateTaskDueDate: async () => undefined
    });

    const input = host?.querySelector<HTMLInputElement>("input[aria-label='Новый финиш задачи']");
    await act(async () => {
      if (!input) throw new Error("Date input not found");
      setInputValue(input, "2026-06-01");
      input.dispatchEvent(new Event("change", { bubbles: true }));
      host?.querySelector<HTMLFormElement>("form[aria-label='Изменение срока задачи в план-графике']")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(host?.textContent).toContain("Финиш не может быть раньше старта задачи.");
  });

  async function renderTimeline(
    onOpenTask: (href: string) => void,
    options: {
      onUpdateTaskDueDate?: ((task: Task, dueDate: string) => Promise<unknown> | void) | undefined;
    } = {}
  ) {
    if (root) {
      act(() => root?.unmount());
    }
    host?.remove();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    await act(async () => {
      root?.render(
        <ScreenRouteProvider meta={getScreenRoute("12-project-gantt")}>
          <ProjectTimelineBlock
            project={makeProject()}
            data={makeGanttData()}
            onOpenTask={onOpenTask}
            onUpdateTaskDueDate={options.onUpdateTaskDueDate}
            tasks={makeTasks()}
          />
        </ScreenRouteProvider>
      );
    });
  }
});

function makeProject(): Project {
  return {
    id: "project-runtime",
    tenantId: "tenant-runtime",
    sourceType: "manual",
    sourceOpportunityId: null,
    clientId: "client-runtime",
    projectTypeId: null,
    title: "Runtime project",
    clientName: "Runtime client",
    status: "active",
    plannedStart: "2026-06-01T00:00:00.000Z",
    plannedFinish: "2026-06-30T00:00:00.000Z",
    contractValue: 1_000_000,
    plannedHours: 120,
    templateId: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    activatedAt: "2026-06-01T00:00:00.000Z",
    demand: []
  };
}

function makeTasks(): Task[] {
  return [
    {
      actualWork: 0,
      archivedAt: null,
      createdAt: "2026-06-01T00:00:00.000Z",
      description: null,
      durationWorkingDays: 1,
      id: "task-runtime",
      ownerUserId: "usr-1",
      participants: [{ role: "executor", userId: "usr-1" }],
      plannedFinish: "2026-06-02T00:00:00.000Z",
      plannedStart: "2026-06-02T00:00:00.000Z",
      plannedWork: 8,
      priority: "normal",
      progress: 0,
      projectId: "project-runtime",
      requesterUserId: "usr-1",
      requiresAcceptance: false,
      source: "manual",
      stageId: null,
      status: "in_progress",
      statusCategory: "in_progress",
      statusId: "status-progress",
      statusName: "В работе",
      tenantId: "tenant-runtime",
      title: "Runtime timeline task",
      updatedAt: "2026-06-01T00:00:00.000Z"
    }
  ];
}

function makeGanttData(): GanttData {
  return {
    days: [
      { day: 1, isoDate: "2026-06-01", weekdayShort: "пн" },
      { day: 2, isoDate: "2026-06-02", weekdayShort: "вт" }
    ],
    rows: [
      {
        id: "project-runtime",
        kind: "summary",
        level: 0,
        name: "Runtime project",
        projectId: "project-runtime",
        startDay: 0,
        durationDays: 2
      },
      {
        id: "task-runtime",
        kind: "task",
        level: 1,
        name: "Runtime timeline task",
        projectId: "project-runtime",
        startDay: 0,
        durationDays: 1
      }
    ]
  };
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
}
