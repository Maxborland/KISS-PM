/**
 * @vitest-environment happy-dom
 *
 * Виртуализация грида Графика: на плане из 1k/10k строк в DOM попадает только
 * окно вокруг вьюпорта (WBS-строки, gantt-строки, SVG-связи), а spacer'ы
 * держат полную высоту списка. Виртуализация в тестах НЕ отключается:
 * window-virtualizer меряет окно happy-dom (innerHeight по умолчанию > 0).
 * Скролл документа детерминирован стабами: happy-dom не считает layout, поэтому
 * scrollTo → scrollY + событие scroll (ровно то, что слушает window-virtualizer),
 * а rAF → макротаска setTimeout(0) — retry-циклы surface гоняются таймерами.
 */

import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

// TaskPeek сам читает ?task= и открыл бы sheet-диалог (перехват фокуса) — здесь
// проверяем контракт виртуализации (скролл/монтирование/фокус строки), а не peek.
vi.mock("@/workspace/task-peek/task-peek", () => ({
  TaskPeek: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock("@/delivery/schedule/schedule-editors", () => ({
  DEP_RU: { FS: "ОН", SS: "НН", FF: "ОО", SF: "НО" },
  DateEditor: ({ children }: { children: ReactNode }) => <>{children}</>,
  DependencyEditor: ({ children }: { children: ReactNode }) => <>{children}</>,
  LinkLagEditor: ({ children }: { children: ReactNode }) => <>{children}</>,
  ResourceEditor: ({ children }: { children: ReactNode }) => <>{children}</>,
  // Мок ПКМ-меню отдаёт кнопку «добавить ниже» — иначе inlineNew из теста не открыть.
  RowMenu: ({ children, onAddBelow }: { children: ReactNode; onAddBelow?: () => void }) => (
    <>
      {children}
      <tr data-testid="row-menu-proxy-row" aria-hidden>
        <td><button type="button" data-testid="row-menu-add-below" onClick={onAddBelow} /></td>
      </tr>
    </>
  ),
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

function spacersHeightSum(testId: string): number {
  return [...document.querySelectorAll<HTMLTableCellElement>(`[data-testid="${testId}"] td`)]
    .reduce((sum, cell) => sum + Number.parseFloat(cell.style.height), 0);
}

/** Скролл документа как в браузере: scrollY + событие scroll (его слушает virtualizer). */
function setWindowScroll(top: number) {
  Object.defineProperty(window, "scrollY", { configurable: true, value: top });
  Object.defineProperty(window, "pageYOffset", { configurable: true, value: top });
  window.dispatchEvent(new Event("scroll"));
}

/** Детерминированные scrollTo/rAF-стабы + сброс скролла (вызывается в beforeEach). */
function installScrollStubs() {
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  Object.defineProperty(window, "pageYOffset", { configurable: true, value: 0 });
  // happy-dom не считает layout: scrollHeight документа = 0, и virtual-core клампил бы
  // целевой offset scrollToIndex к нулю (getMaxScrollOffset) — даём «высокий» документ.
  Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, get: () => 1_000_000 });
  // scrollTo (его зовёт virtualizer.scrollToIndex) → детерминированный setWindowScroll
  window.scrollTo = ((options?: ScrollToOptions | number, y?: number) => {
    const top = typeof options === "object" && options !== null ? options.top ?? 0 : y ?? 0;
    setWindowScroll(top);
  }) as typeof window.scrollTo;
  // rAF → макротаска: retry-циклы surface (deep-link фокус, возврат фокуса) гоняются flushFrames
  window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    window.setTimeout(() => cb(performance.now()), 0)) as typeof window.requestAnimationFrame;
}

async function scrollWindowTo(top: number) {
  await act(async () => setWindowScroll(top));
}

/** Прогоняет rAF-циклы surface (заполифилены в setTimeout(0)) через act. */
async function flushFrames(count: number) {
  for (let index = 0; index < count; index++) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  }
}

const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

beforeAll(() => {
  // Surface меряет scrollMargin как rect.top + scrollY (инвариант документа). happy-dom
  // всегда отдаёт rect.top=0 — моделируем документ, где грид стоит в самом верху.
  HTMLElement.prototype.getBoundingClientRect = function () {
    const top = -window.scrollY;
    return { top, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  };
});

afterAll(() => {
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
});

describe("schedule row virtualization (bounded DOM)", () => {
  beforeEach(() => {
    permissions = ["tenant.project_plan.read"];
    harness.readModel = baseReadModel();
    installScrollStubs();
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";
    window.history.replaceState(null, "", "/");
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

  it("связь «насквозь» рендерится в середине списка, когда ОБА конца вне окна", async () => {
    const rows = makeRows(1_000);
    rows[999] = { ...rows[999]!, predList: [{ depId: "dep-cross", predId: "task-1", type: "FS", lagDays: 0 }] };
    harness.rows = rows;

    await renderSchedule();
    // окно в середину списка — оба конца связи 1→1000 далеко за окном
    await scrollWindowTo(500 * ROW_H);
    await flushFrames(3);

    expect(document.querySelector('[data-schedule-row-id="task-1"]')).toBeNull();
    expect(document.querySelector('[data-schedule-row-id="task-1000"]')).toBeNull();
    expect(document.querySelector('[data-dep-id="dep-cross"]')).not.toBeNull();
  });

  it("deep-link ?task= вне окна доскролливает, монтирует и фокусирует строку", async () => {
    harness.rows = makeRows(1_000);
    window.history.replaceState(null, "", "/projects/project-huge/schedule?task=task-900");

    await renderSchedule();
    // rAF-цепочка: selection-эффект → focusScheduleRow → scrollToIndex → retry до появления <tr>
    for (let attempt = 0; attempt < 20 && document.activeElement?.getAttribute("data-schedule-row-id") !== "task-900"; attempt++) {
      await flushFrames(1);
    }

    const row = document.querySelector<HTMLElement>('[data-schedule-row-id="task-900"]');
    expect(row).not.toBeNull();
    expect(row!.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(row);
  });

  it("сворачивание summary-группы в 1000-строчном плане пересчитывает spacer'ы", async () => {
    const rows = makeRows(1_000);
    rows[0] = { ...rows[0]!, kind: "summary" as const, hasChildren: true };
    for (let index = 1; index < 500; index++) {
      rows[index] = { ...rows[index]!, parentId: "task-1", level: 1 };
    }
    harness.rows = rows;

    await renderSchedule();
    const toggleButton = document.querySelector<HTMLButtonElement>('button[aria-label="Свернуть группу"]');
    expect(toggleButton).not.toBeNull();
    await act(async () => toggleButton!.click());

    // видимых строк стало 1000 - 499 скрытых детей = 501 — spacer'ы сведены к новой высоте
    const visibleCount = 501;
    const wbsRows = document.querySelectorAll("[data-schedule-row-id]").length;
    const padTop = spacerHeight("schedule-virtual-spacer-top");
    const padBottom = spacerHeight("schedule-virtual-spacer-bottom");
    expect(wbsRows).toBeLessThan(MAX_WINDOW_ROWS);
    expect(padTop + padBottom + wbsRows * ROW_H).toBe(visibleCount * ROW_H);
  });

  it("фокус возвращается на workspace-обёртку при размонтировании сфокусированной строки", async () => {
    harness.rows = makeRows(1_000);

    await renderSchedule();
    const row = document.querySelector<HTMLElement>('[data-schedule-row-id="task-1"]');
    expect(row).not.toBeNull();
    await act(async () => row!.focus());
    expect(document.activeElement).toBe(row);

    await scrollWindowTo(700 * ROW_H);
    await flushFrames(3);

    expect(document.querySelector('[data-schedule-row-id="task-1"]')).toBeNull();
    const workspace = document.querySelector('[data-testid="schedule-productivity-workspace"]');
    expect(document.activeElement).toBe(workspace);
  });
});

describe("schedule row virtualization (pinned editing rows)", () => {
  beforeEach(() => {
    permissions = ["tenant.project_plan.read", "tenant.project_plan.manage"];
    harness.readModel = baseReadModel();
    installScrollStubs();
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";
  });

  it("inlineNew-строка закреплена в окне, её высота сведена с totalSize, ввод переживает скролл", async () => {
    harness.rows = makeRows(1_000);

    await renderSchedule();
    // ПКМ-мок: «добавить ниже» у первой строки окна (task-1)
    const addBelow = document.querySelector<HTMLButtonElement>('[data-testid="row-menu-add-below"]');
    expect(addBelow).not.toBeNull();
    await act(async () => addBelow!.click());
    // отложенный фокус инлайн-редактора (40мс из-за Radix ContextMenu)
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 60)); });

    const inlineInput = document.querySelector<HTMLInputElement>("tr.msgrid-newrow input");
    expect(inlineInput).not.toBeNull();
    expect(document.activeElement).toBe(inlineInput);

    // P3-2: инлайн-строка (36px) вычтена из нижнего spacer'а — tbody сведён с totalSize
    const wbsRows = document.querySelectorAll("[data-schedule-row-id]").length;
    const padTop = spacerHeight("schedule-virtual-spacer-top");
    const padBottom = spacerHeight("schedule-virtual-spacer-bottom");
    expect(padTop + padBottom + (wbsRows + 1) * ROW_H).toBe(1_000 * ROW_H);

    await scrollWindowTo(700 * ROW_H);
    await flushFrames(3);

    // строка-якорь и редактор закреплены rangeExtractor'ом: ввод не прерван скроллом
    expect(document.querySelector('[data-schedule-row-id="task-1"]')).not.toBeNull();
    const inlineInputAfterScroll = document.querySelector<HTMLInputElement>("tr.msgrid-newrow input");
    expect(inlineInputAfterScroll).toBe(inlineInput); // тот же DOM-узел — remount не было
    expect(document.activeElement).toBe(inlineInput);

    // геометрия сходится и с gap-spacer'ом между закреплённой строкой и окном
    const gapSum = spacersHeightSum("schedule-virtual-spacer-gap");
    expect(gapSum).toBeGreaterThan(0);
    const wbsRowsAfter = document.querySelectorAll("[data-schedule-row-id]").length;
    const padTopAfter = spacerHeight("schedule-virtual-spacer-top");
    const padBottomAfter = spacerHeight("schedule-virtual-spacer-bottom");
    expect(padTopAfter + gapSum + padBottomAfter + (wbsRowsAfter + 1) * ROW_H).toBe(1_000 * ROW_H);
  });

  it("строка с inline-редактором ячейки закреплена: ввод и фокус переживают скролл", async () => {
    harness.rows = makeRows(1_000);

    await renderSchedule();
    const nameCell = document.querySelector<HTMLTableCellElement>('[data-schedule-row-id="task-2"] td[title]');
    expect(nameCell).not.toBeNull();
    await act(async () => {
      nameCell!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    });

    const editInput = document.querySelector<HTMLInputElement>('[data-schedule-row-id="task-2"] td[title] input');
    expect(editInput).not.toBeNull();
    expect(document.activeElement).toBe(editInput);

    await scrollWindowTo(700 * ROW_H);
    await flushFrames(3);

    const editInputAfterScroll = document.querySelector<HTMLInputElement>('[data-schedule-row-id="task-2"] td[title] input');
    expect(editInputAfterScroll).toBe(editInput); // тот же DOM-узел — remount не было
    expect(document.activeElement).toBe(editInput);
  });
});
