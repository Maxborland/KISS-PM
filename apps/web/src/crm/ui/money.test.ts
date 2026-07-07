import { describe, expect, it } from "vitest";

import { money } from "./money";

describe("money", () => {
  it("formats values below one thousand as rubles", () => {
    expect(money(100)).toBe("100 ₽");
    expect(money(500)).toBe("500 ₽");
    expect(money(999)).toBe("999 ₽");
  });

  it("keeps compact thousand and million labels", () => {
    expect(money(1_000)).toBe("1 тыс ₽");
    expect(money(650_000)).toBe("650 тыс ₽");
    expect(money(1_200_000)).toBe("1,2 млн ₽");
  });
});
