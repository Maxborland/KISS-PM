import type { Decorator } from "@storybook/react";
import React, { createContext, useContext, useMemo } from "react";

import type { FixtureBundle } from "@/lib/mock-data/fixture-bundle";
import { getFixtureBundle } from "@/lib/mock-data/fixture-bundle";
import {
  SCENARIO_META,
  SCENARIO_NAMES,
  createScenarioState,
  isScenarioName,
  type ScenarioName,
  type ScenarioState
} from "@/lib/mock-data/scenarios";
import { setActiveStorybookScenario } from "@/lib/mock-data/storybook-scenario-runtime";

export type ScenarioContextValue = {
  scenario: ScenarioName;
  state: ScenarioState;
  fixtures: FixtureBundle;
};

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

export function useScenario(): ScenarioContextValue {
  const value = useContext(ScenarioContext);
  if (!value) {
    throw new Error("useScenario: оберните story в декоратор withScenario (Storybook preview).");
  }
  return value;
}

function resolveScenarioName(globalScenario: unknown, parameterScenario: unknown): ScenarioName {
  if (isScenarioName(parameterScenario)) return parameterScenario;
  if (isScenarioName(globalScenario)) return globalScenario;
  return "default";
}

export const withScenario: Decorator = (Story, context) => {
  const scenario = resolveScenarioName(
    context.globals.scenario,
    context.parameters.scenario
  );
  setActiveStorybookScenario(scenario);

  const value = useMemo<ScenarioContextValue>(
    () => ({
      scenario,
      state: createScenarioState(scenario),
      fixtures: getFixtureBundle(scenario)
    }),
    [scenario]
  );

  return (
    <ScenarioContext.Provider value={value}>
      <Story />
    </ScenarioContext.Provider>
  );
};

export const scenarioGlobalType = {
  scenario: {
    name: "Сценарий",
    description: "Системные визуальные состояния данных и API (MSW).",
    defaultValue: "default" as ScenarioName,
    toolbar: {
      icon: "mirror",
      items: SCENARIO_NAMES.map((name) => ({
        value: name,
        title: SCENARIO_META[name].labelRu
      }))
    }
  }
} as const;
