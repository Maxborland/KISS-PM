import type { Decorator } from "@storybook/react";
import { useMemo } from "react";

import { ScenarioProvider } from "@/lib/mock-data/scenario-context";
import { getFixtureBundle } from "@/lib/mock-data/fixture-bundle";
import {
  SCENARIO_META,
  SCENARIO_NAMES,
  createScenarioState,
  isScenarioName,
  type ScenarioName
} from "@/lib/mock-data/scenarios";
import { setActiveStorybookScenario } from "@/lib/mock-data/storybook-scenario-runtime";

export { useScenarioFixtures } from "@/lib/mock-data/scenario-context";

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

  const value = useMemo(
    () => ({
      scenario,
      state: createScenarioState(scenario),
      fixtures: getFixtureBundle(scenario)
    }),
    [scenario]
  );

  return (
    <ScenarioProvider value={value}>
      <Story />
    </ScenarioProvider>
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
