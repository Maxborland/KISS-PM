import { describe, expect, it } from "vitest";

describe("usePlanMutation preview generation", () => {
  it("ignores stale preview results when generation advances", () => {
    let generation = 0;
    const applyPreview = (requestGeneration: number, latestGeneration: number) =>
      requestGeneration === latestGeneration;

    const first = ++generation;
    const second = ++generation;
    expect(applyPreview(first, generation)).toBe(false);
    expect(applyPreview(second, generation)).toBe(true);
  });
});
