/**
 * @vitest-environment happy-dom
 *
 * Виртуализация грида Графика: на плане из 1k/10k строк в DOM попадает только
 * окно вокруг вьюпорта (WBS-строки, gantt-строки, SVG-связи), а spacer'ы
 * держат полную высоту списка. Виртуализация в тестах НЕ отключается:
 * window-virtualizer меряет окно happy-dom (innerHeight по умолчанию > 0).
 */

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectSchedule } from "./schedule-surface";
import type { Row } from "./schedule-rows";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ROW_H = 36;
// Верхняя граница окна: вьюпорт happy-dom (768px ≈ 21 строка) + overscan 12 с двух
// сторон + запас. Смысл ассерта — DOM ограничен ОКНОМ, а не размером плана.
const MAX_WINDOW_ROWS = 60;

let permissions: string[] = [];

const harness = vi.hoisted(() => ({
  rows: [] as unknown[],
  readModel: null as unknown
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@kiss-pm/planning-client", () => ({
  buildCompensatingCommandBatch: () => []
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

vi.mock("@/delivery/lib/use-resource-directory", () => ({
  useResourceDirectory: () => ({ list: [], byId: new Map(), name: (id: string) => id, of: () => undefined })
}));

vi.mock("@/delivery/lib/use-planning", () => ({
  usePlanning: () => ({
    readModel: harness.readModel,
    setReadModel: vi.fn(),
    status: "ready",
    error: null,
    reload: vi.fn(),
    apply: vi.fn(),
    applyBatch: vi.fn()
  })
}));

vi.mock("@/delivery/lib/project-chrome", () => ({
  PROJECT_FALLBACK: {},
  deriveProjectMeta: () => ({ name: "Project", code: "PRJ", status: "В работе", planVersion: "3", deadline: "10.07.2026", finish: "12.07.2026" }),
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
  deriveScheduleTimeline: () => ({ originDay: 0, totalDays: 14, todayOffsetDays: 0 }),
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
  ResourceEditor: ({ children }: { children: ReactNode }) => <>{children}</>,
  RowMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  TaskModal: () => null
}));

/** Генератор плоского плана: цепочка задач с FS-связями task-(i)→task-(i+1). */
function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `task-${index + 1}`,
    wbs: String(index + 1),
    name: `Задача ${index + 1}`,
    level: 0,
    kind: "task" as const,
    hasChildren: false,
    mode: "auto" as const,
    parentId: null,
    durDays: 5,
    durationMinutes: 2_400,
    pct: 0,
    startIso: "2026-07-06",
    finishIso: "2026-07-10",
    predDisplay: index > 0 ? String(index) : "",
    predList: index > 0
      ? [{ depId: `dep-${index}`, predId: `task-${index}`, type: "FS", lagDays: 0 }]
      : [],
    res: "",
    workH: 40,
    slackDays: 0,
    dayStart: 0,
    dayDur: 5,
    critical: false,
    warning: false,
    effectiveCalendarId: "calendar-default",
    workingMinutesPerDay: 480
  }));
}

const baseReadModel = () => ({
  project: { plannedStart: "2026-07-06", calendarId: "calendar-default" },
  authored: { tasks: [], assignments: [] },
  calculatedPlan: { tasks: [] },
  calendars: [{ id: "calendar-default", workingWeekdays: [1, 2, 3, 4, 5], workingMinutesPerDay: 480 }],
  calendarExceptions: [],
  planVersion: 3
});

let root: Root | null = null;

async function renderSchedule() {
  const container = document.body.appendChild(document.createElement("div"));
  root = createRoot(container);
  await act(async () => root!.render(<ProjectSchedule projectId="project-huge" />));
}

function spacerHeight(testId: string): number {
  const cell = document.querySelector<HTMLTableCellElement>(`[data-testid="${testId}"] td`);
  return cell ? Number.parseFloat(cell.style.height) : 0;
}

describe("schedule row virtualization (bounded DOM)", () => {
  beforeEach(() => {
    permissions = ["tenant.project_plan.read"];
    harness.readModel = baseReadModel();
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";
  });

  it.each([1_000, 10_000])("план на %i строк рендерит ограниченное окно WBS- и gantt-строк", async (count) => {
    harness.rows = makeRows(count);

    await renderSchedule();

    const wbsRows = document.querySelectorAll("[data-schedule-row-id]");
    const ganttRows = document.querySelectorAll("[data-task-id]");
    console.info(`[virtualization] план ${count} строк → DOM: ${wbsRows.length} WBS-строк, ${ganttRows.length} gantt-строк (окно ${window.innerHeight}px)`);
    expect(wbsRows.length).toBeGreaterThan(0);
    expect(wbsRows.length).toBeLessThan(MAX_WINDOW_ROWS);
    // gantt-lane рендерит то же окно, что и WBS-таблица
    expect(ganttRows.length).toBe(wbsRows.length);

    // spacer'ы компенсируют невиртуализованные строки: сумма высот = полная высота списка
    const padTop = spacerHeight("schedule-virtual-spacer-top");
    const padBottom = spacerHeight("schedule-virtual-spacer-bottom");
    expect(padTop + padBottom + wbsRows.length * ROW_H).toBe(count * ROW_H);
    // окно у верха списка — верхний spacer нулевой (не рендерится), нижний держит хвост
    expect(padTop).toBe(0);
    expect(padBottom).toBeGreaterThan(0);
    expect(padBottom % ROW_H).toBe(0);
  });

  it("SVG-связи рендерятся только для окна, включая линии, пересекающие окно насквозь", async () => {
    const rows = makeRows(1_000);
    // связь с обоими концами далеко за окном (не должна рендериться)
    rows[501] = { ...rows[501]!, predList: [{ depId: "dep-far", predId: "task-501", type: "FS", lagDays: 0 }] };
    // связь от первой строки к последней: конец в окне → линия рендерится
    rows[999] = { ...rows[999]!, predList: [{ depId: "dep-cross", predId: "task-1", type: "FS", lagDays: 0 }] };
    harness.rows = rows;

    await renderSchedule();

    const renderedLinks = document.querySelectorAll("[data-dep-id]");
    expect(renderedLinks.length).toBeGreaterThan(0);
    expect(renderedLinks.length).toBeLessThan(MAX_WINDOW_ROWS);
    expect(document.querySelector('[data-dep-id="dep-far"]')).toBeNull();
    expect(document.querySelector('[data-dep-id="dep-cross"]')).not.toBeNull();
  });
});
