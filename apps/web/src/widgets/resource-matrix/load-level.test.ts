import { describe, expect, it } from "vitest";

import { resolvePersonDayLoadLevel } from "./load-level";

describe("resolvePersonDayLoadLevel", () => {
  it("норма до 8 ч включительно", () => {
    expect(resolvePersonDayLoadLevel(7.6)).toBe("normal");
    expect(resolvePersonDayLoadLevel(8)).toBe("normal");
  });

  it("высокая между 10 и 15 ч", () => {
    expect(resolvePersonDayLoadLevel(11)).toBe("high");
    expect(resolvePersonDayLoadLevel(15)).toBe("high");
  });

  it("перегруз свыше 15 ч", () => {
    expect(resolvePersonDayLoadLevel(16)).toBe("over");
    expect(resolvePersonDayLoadLevel(16.9)).toBe("over");
  });
});
