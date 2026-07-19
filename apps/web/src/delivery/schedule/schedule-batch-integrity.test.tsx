/**
 * @vitest-environment happy-dom
 */

import { act, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ProjectSchedule,
  buildScheduleDependencyCommand,
  buildScheduleMoveCommand,
  buildScheduleRangeCommands,
  buildScheduleWorkCommand,
  engineConsistentWorkMinutes,
  optimisticPatch,
  resolveScheduleTiming,
  resolveTaskWorkModel,
  scheduleUnitsPercent,
  taskUnitsPermille
} from "./schedule-surface";
import type { Row } from "./schedule-rows";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let permissions: string[] = [];

const harness = vi.hoisted(() => ({
  readModel: null as any,
  rows: [] as any[],
  setReadModel: vi.fn(),
  reload: vi.fn(),
  apply: vi.fn(),
  applyBatch: vi.fn(),
  compensate: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn()
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

vi.mock("sonner", () => ({
  toast: { error: harness.toastError, success: harness.toastSuccess }
}));

vi.mock("@kiss-pm/planning-client", () => ({
  buildCompensatingCommandBatch: harness.compensate,
  // SSE-подписка плана: в юнитах не открываем EventSource (сеть) — noop-подписка
  subscribeToPlanEvents: () => ({ unsubscribe() {} })
}));

vi.mock("@/delivery/ui/delivery-frame", () => ({
  DeliveryFrame: ({ children }: { children: ReactNode }) => <main>{children}</main>
}));

vi.mock("@/views/lib/prototype-gate", () => ({ prototypeNotesEnabled: false }));

vi.mock("@/shell/use-session-user", () => ({
  useSessionUser: () => ({ id: "user", name: "Test User", permissions })
}));

vi.mock("@/delivery/lib/planning-runtime", () => ({
  usePlanningRuntime: () => ({ live: true, fetchImpl: null })
}));

vi.mock("@/delivery/lib/use-resource-directory", () => {
  const list = [{
    id: "resource-1",
    name: "Resource One",
    positionId: "",
    positionName: "",
    teamId: "",
    teamName: "",
    capacityMinPerDay: 480
  }];
  const byId = new Map(list.map((resource) => [resource.id, resource]));
  return {
    useResourceDirectory: () => ({
      list,
      byId,
      name: (id: string) => byId.get(id)?.name ?? id,
      of: (id: string) => byId.get(id)
    })
  };
});

vi.mock("@/delivery/lib/use-planning", () => ({
  usePlanning: () => ({
    readModel: harness.readModel,
    setReadModel: harness.setReadModel,
    status: "ready",
    error: null,
    reload: harness.reload,
    apply: async (command: unknown) => {
      const result = await harness.apply(command);
      if (result?.ok) harness.readModel = { ...harness.readModel, planVersion: result.planVersion };
      return result;
    },
    applyBatch: async (commands: unknown[], options?: unknown) => {
      const result = await harness.applyBatch(commands, options);
      if (result?.ok) harness.readModel = { ...harness.readModel, planVersion: result.planVersion };
      return result;
    }
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

vi.mock("@/delivery/lib/use-pointer-drag", () => ({
  usePointerDrag: () => ({ state: null, begin: vi.fn() })
}));

vi.mock("@/delivery/schedule/schedule-rows", () => ({
  mapRows: () => ({ rows: harness.rows, deadlineDay: null, projectFinishDay: 5 })
}));

vi.mock("@/delivery/lib/date-origin", () => ({
  currentPlanDate: () => "2026-07-06",
  deriveScheduleTimeline: () => ({ originDay: 0, totalDays: 7, todayOffsetDays: 0 }),
  formatWeekLabel: () => "6-12 Jul"
}));

vi.mock("@/delivery/schedule/schedule-saved-views", () => ({
  ScheduleSavedViews: () => null
}));

vi.mock("@/delivery/schedule/schedule-editors", () => ({
  DEP_RU: { FS: "ОН", SS: "НН", FF: "ОО", SF: "НО" },
  DateEditor: ({ children }: { children: ReactNode }) => <>{children}</>,
  DependencyEditor: ({ children }: { children: ReactNode }) => <>{children}</>,
  LinkLagEditor: ({ children }: { children: ReactNode }) => <>{children}</>,
  ResourceEditor: ({ resources, children }: { resources?: readonly unknown[]; children: ReactNode }) => (
    <>{children}<span data-testid="resource-editor" data-resource-count={resources?.length ?? 0} /></>
  ),
  RowMenu: ({ children, onEdit }: { children: ReactNode; onEdit: () => void }) => (
    <>{children}{createPortal(<button type="button" data-testid="open-edit" onClick={onEdit}>Open edit</button>, document.body)}</>
  ),
  TaskModal: ({
    open,
    mode,
    initial,
    resources,
    canAssign,
    onSubmit
  }: {
    open: boolean;
    mode: "create" | "edit";
    initial: { title: string; assigneeId: string; startIso: string; durDays: number; workH: number; pct: number };
    resources?: ReadonlyArray<{ id: string }>;
    canAssign?: boolean;
    onSubmit: (value: { title: string; assigneeId: string; startIso: string; durDays: number; workH: number; pct: number }) => void;
  }) => open ? (
    <section data-testid="task-modal" data-can-assign={String(canAssign)}>
      {mode === "create" ? (
        <button type="button" data-testid="submit-create" onClick={() => onSubmit({
          ...initial,
          title: "Created from modal",
          startIso: "2026-07-10",
          durDays: 2,
          workH: 12,
          assigneeId: resources?.[0]?.id ?? ""
        })}>Submit create</button>
      ) : (
        <>
          <button type="button" data-testid="submit-edit-clear" onClick={() => onSubmit({
            ...initial,
            title: "Renamed task",
            assigneeId: ""
          })}>Submit edit clear</button>
          <button type="button" data-testid="submit-edit-work" onClick={() => onSubmit({
            ...initial,
            workH: initial.workH + 1
          })}>Submit edit work</button>
        </>
      )}
    </section>
  ) : null
}));

const baseReadModel = () => ({
  project: {
    plannedStart: "2026-07-06",
    calendarId: "calendar-six-hour"
  },
  authored: {
    tasks: [{
      id: "task-1",
      parentTaskId: null,
      wbsCode: "1",
      title: "Original task",
      schedulingMode: "auto",
      durationMinutes: 1_800,
      workMinutes: 1_800,
      percentComplete: 10,
      calendarId: "calendar-six-hour",
      customFields: {}
    }],
    assignments: [{
      id: "assignment-1",
      taskId: "task-1",
      resourceId: "resource-1",
      role: "executor",
      unitsPermille: 1_000,
      workMinutes: 1_800
    }]
  },
  calculatedPlan: {
    tasks: [{
      id: "task-1",
      calculatedStart: "2026-07-06",
      calculatedFinish: "2026-07-11",
      totalSlackMinutes: 0,
      isCritical: true
    }]
  },
  calendars: [{
    id: "calendar-six-hour",
    workingWeekdays: [1, 2, 3, 4, 5],
    workingMinutesPerDay: 360
  }],
  calendarExceptions: [],
  planVersion: 3
});

const row = (): Row => ({
  id: "task-1",
  wbs: "1",
  name: "Original task",
  level: 0,
  kind: "task",
  hasChildren: false,
  mode: "auto",
  parentId: null,
  durDays: 5,
  durationMinutes: 1_800,
  pct: 10,
  startIso: "2026-07-06",
  finishIso: "2026-07-11",
  predDisplay: "",
  predList: [],
  res: "Resource One",
  workH: 30,
  slackDays: 0,
  dayStart: 0,
  dayDur: 5,
  critical: true,
  warning: false,
  effectiveCalendarId: "calendar-six-hour",
  workingMinutesPerDay: 360
});

let root: Root | null = null;

async function renderSchedule() {
  const container = document.body.appendChild(document.createElement("div"));
  root = createRoot(container);
  await act(async () => root!.render(<ProjectSchedule projectId="project-alpha" />));
}

function findButton(label: string) {
  const match = [...document.querySelectorAll<HTMLButtonElement>("button")]
    .find((candidate) => candidate.textContent?.trim() === label);
  if (!match) throw new Error(`Button not found: ${label}`);
  return match;
}

function batchButton() {
  const match = [...document.querySelectorAll<HTMLButtonElement>("button")]
    .find((candidate) => candidate.textContent?.trim().startsWith("Пакет"));
  if (!match) throw new Error("Batch button not found");
  return match;
}

function byTestId(id: string) {
  const match = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
  if (!match) throw new Error(`Element not found: ${id}`);
  return match;
}

async function click(element: HTMLElement) {
  await act(async () => {
    element.click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function stageQuickCreate() {
  await click(batchButton());
  const input = document.querySelector<HTMLInputElement>('input[placeholder^="Новая задача"]');
  if (!input) throw new Error("Quick-create input not found");

  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "Staged task");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
  expect(document.body.textContent).toContain("накоплено: 1");
}

beforeEach(() => {
  permissions = [
    "tenant.project_plan.read",
    "tenant.project_plan.manage",
    "tenant.project_resources.manage"
  ];
  harness.readModel = baseReadModel();
  harness.rows = [row()];
  harness.setReadModel.mockReset();
  harness.reload.mockReset();
  harness.apply.mockReset();
  harness.applyBatch.mockReset();
  harness.compensate.mockReset();
  harness.toastError.mockReset();
  harness.toastSuccess.mockReset();
  harness.apply.mockResolvedValue({ ok: true, planVersion: 4, changed: ["task-1"] });
  harness.applyBatch.mockResolvedValue({ ok: true, planVersion: 4, changed: ["task-1"] });
  harness.compensate.mockImplementation((_commands: unknown[], before: ReturnType<typeof baseReadModel>) => [{
    type: "task.update_identity",
    payload: { taskId: "task-1", title: before.authored.tasks[0]!.title }
  }]);
  window.history.replaceState(null, "", "/projects/project-alpha/schedule");
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("Schedule batch and undo integrity", () => {
  it("preserves a cancelled staged preview, then clears it only after successful retry", async () => {
    harness.applyBatch
      .mockResolvedValueOnce({ ok: false, message: "preview_cancelled" })
      .mockResolvedValueOnce({ ok: true, planVersion: 4, changed: ["task-1"] });
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    await renderSchedule();
    await stageQuickCreate();

    await click(findButton("Применить пакетом"));

    expect(harness.applyBatch).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("накоплено: 1");
    expect(harness.reload).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();

    await click(findButton("Применить пакетом"));

    expect(harness.applyBatch).toHaveBeenCalledTimes(2);
    expect(document.body.textContent).not.toContain("накоплено: 1");
    expect(back).toHaveBeenCalledTimes(1);
    expect(harness.compensate).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({
      planVersion: 3
    }));
  });

  it("discards staged state without applying it", async () => {
    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    await renderSchedule();
    await stageQuickCreate();

    await click(findButton("Сбросить"));

    expect(harness.apply).not.toHaveBeenCalled();
    expect(harness.applyBatch).not.toHaveBeenCalled();
    expect(harness.setReadModel).toHaveBeenLastCalledWith(expect.objectContaining({ planVersion: 3 }));
    expect(harness.reload).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).not.toContain("накоплено: 1");
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("routes modal command batches through staging and applies them in one commit", async () => {
    await renderSchedule();
    await click(batchButton());
    await click(findButton("Задача"));
    await click(byTestId("submit-create"));

    expect(harness.apply).not.toHaveBeenCalled();
    expect(harness.applyBatch).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("накоплено: 2");

    const back = vi.spyOn(window.history, "back").mockImplementation(() => undefined);
    await click(findButton("Применить пакетом"));

    expect(harness.applyBatch).toHaveBeenCalledTimes(1);
    const commands = harness.applyBatch.mock.calls[0]![0] as Array<{
      type: string;
      payload: Record<string, unknown>;
    }>;
    expect(commands.map((command) => command.type)).toEqual(["task.create", "assignment.upsert"]);
    expect(commands[0]?.payload).toMatchObject({
      plannedStart: "2026-07-10",
      plannedFinish: "2026-07-13",
      durationMinutes: 720,
      workMinutes: 720
    });
    expect(harness.readModel.planVersion).toBe(4);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("does not allow dirty batch mode to be switched off", async () => {
    await renderSchedule();
    await stageQuickCreate();

    await click(batchButton());

    expect(batchButton().getAttribute("aria-pressed")).toBe("true");
    expect(document.body.textContent).toContain("накоплено: 1");
    expect(harness.apply).not.toHaveBeenCalled();
    expect(harness.applyBatch).not.toHaveBeenCalled();
    expect(harness.toastError).toHaveBeenCalledWith("Сначала примените или сбросьте накопленный пакет");
  });

  it("keeps undo available when its preview is cancelled and retries the same inverse", async () => {
    harness.applyBatch
      .mockResolvedValueOnce({ ok: true, planVersion: 4, changed: ["task-1"] })
      .mockResolvedValueOnce({ ok: false, message: "preview_cancelled" })
      .mockResolvedValueOnce({ ok: true, planVersion: 5, changed: ["task-1"] });
    await renderSchedule();
    await click(byTestId("open-edit"));
    await click(byTestId("submit-edit-clear"));

    const undo = findButton("Откат");
    expect(undo.disabled).toBe(false);

    await click(undo);

    expect(harness.applyBatch).toHaveBeenCalledTimes(2);
    expect(findButton("Откат").disabled).toBe(false);

    await click(findButton("Откат"));

    expect(harness.applyBatch).toHaveBeenCalledTimes(3);
    expect(findButton("Откат").disabled).toBe(true);
    expect(harness.applyBatch.mock.calls[1]![0]).toEqual(harness.applyBatch.mock.calls[2]![0]);
  });

  it("emits assignment.delete when edit clears an existing assignee", async () => {
    await renderSchedule();
    await click(byTestId("open-edit"));
    await click(byTestId("submit-edit-clear"));

    expect(harness.applyBatch).toHaveBeenCalledTimes(1);
    const commands = harness.applyBatch.mock.calls[0]![0] as Array<{ type: string; payload: Record<string, unknown> }>;
    expect(commands).toContainEqual({
      type: "assignment.delete",
      payload: { assignmentId: "assignment-1" }
    });
  });

  it("uses planning resources once and blocks assignment and assigned-work writes without resource manage", async () => {
    permissions = ["tenant.project_plan.read", "tenant.project_plan.manage"];
    await renderSchedule();

    expect(document.querySelector('[data-testid="resource-editor"]')).toBeNull();
    await click(byTestId("open-edit"));
    expect(byTestId("task-modal").getAttribute("data-can-assign")).toBe("false");

    await click(byTestId("submit-edit-work"));

    expect(harness.apply).not.toHaveBeenCalled();
    expect(harness.applyBatch).not.toHaveBeenCalled();
    expect(document.querySelector('[data-testid="task-modal"]')).not.toBeNull();
    expect(harness.toastError).toHaveBeenCalledWith(
      "Труд назначенной задачи меняет загрузку ресурса. Нужно право управления ресурсами"
    );

    await click(byTestId("submit-edit-clear"));

    const commands = harness.applyBatch.mock.calls[0]![0] as Array<{ type: string }>;
    expect(commands.some((command) => command.type.startsWith("assignment."))).toBe(false);
  });
});

describe("Schedule surface calendar command builders", () => {
  it("sends engine-consistent work for units-driven task types", () => {
    const calendarRow = row(); // 6h/день; см. row() фикстуру
    const base = { row: calendarRow, durationMinutes: 720 };
    // fixed_units: движок выведет duration = work×1000/units — труд из длительности×юнитов.
    expect(engineConsistentWorkMinutes({ ...base, workModel: { taskType: "fixed_units", effortDriven: false }, unitsPermille: 500 })).toBe(360);
    // fixed_work (не effortDriven): труд фиксирован — прежние часы строки.
    expect(engineConsistentWorkMinutes({ ...base, workModel: { taskType: "fixed_work", effortDriven: false }, unitsPermille: 500 })).toBe(Math.round(calendarRow.workH * 60));
    // fixed_duration или нет назначений: прежняя пропорция (scaledWorkMinutes).
    expect(engineConsistentWorkMinutes({ ...base, workModel: { taskType: "fixed_duration", effortDriven: false }, unitsPermille: 500 }))
      .toBe(engineConsistentWorkMinutes({ ...base, workModel: { taskType: "fixed_units", effortDriven: false }, unitsPermille: 0 }));
    expect(taskUnitsPermille([{ taskId: "t", unitsPermille: 600 }, { taskId: "t", unitsPermille: 400 }, { taskId: "x", unitsPermille: 999 }], "t")).toBe(1000);
  });

  it("preserves the task's work model semantics instead of forcing fixed_duration", () => {
    const calendarRow = row();
    const tasks = [{ id: calendarRow.id, taskType: "fixed_units" as const, effortDriven: true }];

    const workModel = resolveTaskWorkModel(tasks, calendarRow.id);
    expect(workModel).toEqual({ taskType: "fixed_units", effortDriven: true });
    expect(buildScheduleWorkCommand(calendarRow, 2, 12, workModel)).toMatchObject({
      payload: { taskType: "fixed_units", effortDriven: true }
    });
    // Неизвестная задача (legacy) — честный fallback.
    expect(resolveTaskWorkModel(tasks, "missing")).toEqual({ taskType: "fixed_duration", effortDriven: false });
  });

  it("uses the row calendar for work, units, dependency lag and dated timing", () => {
    const calendarRow = row();

    expect(buildScheduleWorkCommand(calendarRow, 2, 12)).toMatchObject({
      type: "task.update_work_model",
      payload: {
        durationMinutes: 720,
        workMinutes: 720
      }
    });
    expect(buildScheduleDependencyCommand({
      id: "dependency-1",
      predecessorTaskId: "predecessor",
      successor: calendarRow,
      type: "FS",
      lagDays: 1
    })).toMatchObject({
      type: "dependency.upsert",
      payload: { lagMinutes: 360 }
    });
    expect(scheduleUnitsPercent(calendarRow)).toBe(100);
    expect(resolveScheduleTiming(
      baseReadModel(),
      calendarRow.effectiveCalendarId,
      "2026-07-10",
      2
    )).toEqual({
      durationMinutes: 720,
      finishIso: "2026-07-13",
      workingMinutesPerDay: 360
    });
  });

  it("normalizes resize and move commands across a weekend and holiday", () => {
    const source = {
      ...baseReadModel(),
      calendarExceptions: [{
        id: "holiday",
        calendarId: "calendar-six-hour",
        resourceId: null,
        date: "2026-07-13",
        workingMinutes: 0,
        reason: "holiday"
      }]
    };
    const calendarRow = {
      ...row(),
      startIso: "2026-07-10",
      finishIso: "2026-07-10",
      dayStart: 0,
      dayDur: 0,
      durDays: 1,
      durationMinutes: 360,
      workH: 6
    };
    const commands = buildScheduleRangeCommands({
      source,
      row: calendarRow,
      startIso: "2026-07-10",
      finishIso: "2026-07-13"
    });

    expect(commands).toEqual([
      {
        type: "task.update_schedule",
        payload: {
          taskId: "task-1",
          plannedStart: "2026-07-10",
          plannedFinish: "2026-07-14"
        }
      },
      {
        type: "task.update_work_model",
        payload: {
          taskId: "task-1",
          taskType: "fixed_duration",
          effortDriven: false,
          durationMinutes: 720,
          workMinutes: 720
        }
      }
    ]);
    expect(buildScheduleMoveCommand(
      source,
      calendarRow,
      "2026-07-11"
    )).toEqual({
      type: "task.update_schedule",
      payload: {
        taskId: "task-1",
        plannedStart: "2026-07-14",
        plannedFinish: "2026-07-14"
      }
    });
  });

  it("keeps optimistic duration/work intact on schedule updates and recalculates finish by working time", () => {
    const source = {
      ...baseReadModel(),
      authored: {
        ...baseReadModel().authored,
        tasks: [{
          ...baseReadModel().authored.tasks[0],
          plannedStart: "2026-07-10",
          plannedFinish: "2026-07-10",
          durationMinutes: 360,
          workMinutes: 360
        }]
      },
      calculatedPlan: {
        tasks: [{
          ...baseReadModel().calculatedPlan.tasks[0],
          calculatedStart: "2026-07-10",
          calculatedFinish: "2026-07-10"
        }]
      },
      calendarExceptions: [{
        id: "holiday",
        calendarId: "calendar-six-hour",
        resourceId: null,
        date: "2026-07-13",
        workingMinutes: 0,
        reason: "holiday"
      }]
    };
    const moved = optimisticPatch(source as any, {
      type: "task.update_schedule",
      payload: {
        taskId: "task-1",
        plannedStart: "2026-07-10",
        plannedFinish: "2026-07-14"
      }
    });

    expect(moved.authored.tasks[0]).toMatchObject({
      durationMinutes: 360,
      workMinutes: 360
    });
    const resized = optimisticPatch(moved, {
      type: "task.update_work_model",
      payload: {
        taskId: "task-1",
        taskType: "fixed_duration",
        effortDriven: false,
        durationMinutes: 720,
        workMinutes: 720
      }
    });
    expect(resized.calculatedPlan.tasks[0]?.calculatedFinish).toBe("2026-07-14");
  });
});
