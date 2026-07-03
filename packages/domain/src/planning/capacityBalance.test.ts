import { describe, expect, it } from "vitest";

import { computeCapacityBalance } from "./capacityBalance";

describe("computeCapacityBalance (единая формула баланса ёмкости)", () => {
  it("свободная ёмкость: used < capacity", () => {
    expect(computeCapacityBalance(180, 480)).toEqual({
      freeMinutes: 300,
      overloadMinutes: 0,
      isOverload: false
    });
  });

  it("перегруз: used > capacity", () => {
    expect(computeCapacityBalance(600, 480)).toEqual({
      freeMinutes: 0,
      overloadMinutes: 120,
      isOverload: true
    });
  });

  it("ровно по ёмкости: used == capacity → не перегруз, ноль свободного", () => {
    expect(computeCapacityBalance(480, 480)).toEqual({
      freeMinutes: 0,
      overloadMinutes: 0,
      isOverload: false
    });
  });

  it("нулевая ёмкость с нагрузкой (выходной/отсутствие) → перегруз на весь труд", () => {
    expect(computeCapacityBalance(240, 0)).toEqual({
      freeMinutes: 0,
      overloadMinutes: 240,
      isOverload: true
    });
  });
});
