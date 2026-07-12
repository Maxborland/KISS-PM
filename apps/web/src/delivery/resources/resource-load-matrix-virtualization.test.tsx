/**
 * @vitest-environment happy-dom
 *
 * Виртуализация матрицы загрузки: на 1k/10k ресурсов обе колонки (левая панель и
 * период-строки) рендерят одно ограниченное окно строк, spacer'ы держат полную
 * высоту, «Итого» остаётся в конце. Виртуализация в тестах НЕ отключается:
 * скролл-карточка меряется через offsetWidth/offsetHeight (virtual-core getRect) —
 * happy-dom отдаёт нули, поэтому здесь честный мок замера элемента.
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, afterAll, describe, expect, it } from "vitest";

import type { Resource } from "@/delivery/lib/planning-demo-data";
import { ResourceLoadMatrix, type MatrixData, type MatrixScope, type RBucket } from "./resource-load-matrix";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ROW_H = 36;
// Верхняя граница окна: мок-вьюпорт 600px (≈16 строк) + overscan 12 + «Итого» + запас.
const MAX_WINDOW_ROWS = 60;
const DATES = ["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10"];

const offsetDescriptors = {
  offsetHeight: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight"),
  offsetWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth")
};

beforeAll(() => {
  // virtual-core (observeElementRect → getRect) читает offsetWidth/offsetHeight
  // скролл-элемента; happy-dom не считает layout — даём типовой замер карточки.
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 600 });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 1024 });
});

afterAll(() => {
  if (offsetDescriptors.offsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetDescriptors.offsetHeight);
  if (offsetDescriptors.offsetWidth) Object.defineProperty(HTMLElement.prototype, "offsetWidth", offsetDescriptors.offsetWidth);
});

function makeResources(count: number): Resource[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `res-${index + 1}`,
    name: `Сотрудник ${index + 1}`,
    positionId: "engineer",
    positionName: "Инженер",
    teamId: "delivery",
    teamName: "Delivery",
    capacityMinPerDay: 480
  }));
}

function makeBuckets(resources: Resource[]): RBucket[] {
  // Бакеты дня для каждого ресурса на короткое окно дат — periods матрицы стабильны,
  // а нагрузка ненулевая (иначе сортировка/фильтры выключат строки из выборки).
  return resources.flatMap((resource) =>
    DATES.map((date) => ({
      resourceId: resource.id,
      date,
      granularity: "day" as const,
      assignedMinutes: 240,
      reservedMinutes: 0,
      occupiedMinutes: 0,
      capacityMinutes: 480,
      freeMinutes: 240,
      assignmentContributions: [],
      reservationContributions: [],
      occupancyContributions: []
    }))
  );
}

const SCOPE: MatrixScope = { level: "project", groupLevels: ["person"], windowNoun: "проект" };

function makeData(count: number): MatrixData {
  const resources = makeResources(count);
  return {
    buckets: makeBuckets(resources),
    resources,
    taskById: new Map(),
    asgById: new Map(),
    calcStartById: new Map(),
    accepted: new Set()
  };
}

let root: Root | null = null;

async function renderMatrix(count: number) {
  const container = document.body.appendChild(document.createElement("div"));
  root = createRoot(container);
  await act(async () => root!.render(<ResourceLoadMatrix scope={SCOPE} data={makeData(count)} />));
}

describe("resource load matrix row virtualization (bounded DOM)", () => {
  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = "";
  });

  it.each([1_000, 10_000])("матрица на %i ресурсов рендерит ограниченное окно строк в обеих колонках", async (count) => {
    await renderMatrix(count);

    const leftRows = document.querySelectorAll("[data-matrix-left-row]");
    const periodRows = document.querySelectorAll("[data-matrix-period-row]");
    console.info(`[virtualization] матрица ${count} ресурсов → DOM: ${leftRows.length} строк слева, ${periodRows.length} период-строк`);
    expect(leftRows.length).toBeGreaterThan(0);
    expect(leftRows.length).toBeLessThan(MAX_WINDOW_ROWS);
    // lockstep: левая панель и период-строки рендерят одно и то же окно
    expect(periodRows.length).toBe(leftRows.length);

    // «Итого» остаётся закреплённой в конце обеих колонок
    expect(document.querySelector('[data-matrix-left-row="__totals"]')).not.toBeNull();
    expect(document.querySelector('[data-matrix-period-row="__totals"]')).not.toBeNull();

    // spacer'ы компенсируют невиртуализованные строки (в каждой колонке пара top/bottom)
    const spacers = [...document.querySelectorAll<HTMLElement>('[data-testid="matrix-virtual-spacer"]')];
    const windowRowCount = leftRows.length - 1; // без «Итого»
    const leftSpacersHeight = spacers.slice(0, spacers.length / 2)
      .reduce((sum, spacer) => sum + Number.parseFloat(spacer.style.height), 0);
    expect(leftSpacersHeight + windowRowCount * ROW_H).toBe(count * ROW_H);
  });
});
