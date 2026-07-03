export type CapacityBalance = {
  freeMinutes: number;
  overloadMinutes: number;
  isOverload: boolean;
};

/**
 * Единственная формула баланса ёмкости дня:
 *   free     = max(0, capacity − used)
 *   overload = max(0, used − capacity)
 *   isOverload = used > capacity
 *
 * «used» задаёт вызывающий — и это НАМЕРЕННО две разные величины в двух подсистемах:
 *  - матрица загрузки проекта (resourcePlanning): used = committedMinutes (назначения+резервы+занятость),
 *    capacity — от календаря ПРОЕКТА (дефолт 480/день);
 *  - workspace-вид (employeeCapacity): used = суммарный труд, capacity — от ПРОИЗВОДСТВЕННОГО календаря +
 *    персональных исключений + отсутствий (KPI-001).
 * Раньше сами выражения free/overload/isOverload были продублированы в обеих подсистемах — теперь «как из
 * used и capacity выводится перегруз» живёт в одном месте, чтобы определения не разъехались (KPI-001-trap).
 */
export function computeCapacityBalance(usedMinutes: number, capacityMinutes: number): CapacityBalance {
  return {
    freeMinutes: Math.max(0, capacityMinutes - usedMinutes),
    overloadMinutes: Math.max(0, usedMinutes - capacityMinutes),
    isOverload: usedMinutes > capacityMinutes
  };
}
