import { describe, expect, it } from "vitest";

import {
  SCENARIO_NAMES,
  createScenarioState,
  isScenarioName,
  parseScenarioState,
  scenarioHttpBehavior,
  serializeScenarioState
} from "./scenarios";

describe("scenarios", () => {
  it("exposes all required scenario names", () => {
    expect(SCENARIO_NAMES).toEqual([
      "default",
      "empty",
      "loading",
      "error",
      "forbidden",
      "overload",
      "late"
    ]);
  });

  it("round-trips serializable scenario state", () => {
    const state = createScenarioState("overload", { delayMs: 500 });
    const restored = parseScenarioState(serializeScenarioState(state));
    expect(restored).toEqual(state);
  });

  it("maps HTTP behavior per scenario", () => {
    expect(scenarioHttpBehavior("loading").kind).toBe("loading");
    expect(scenarioHttpBehavior("forbidden").kind).toBe("forbidden");
    expect(scenarioHttpBehavior("default").kind).toBe("success");
  });

  it("rejects unknown scenario names", () => {
    expect(isScenarioName("unknown")).toBe(false);
    expect(isScenarioName("default")).toBe(true);
  });
});
