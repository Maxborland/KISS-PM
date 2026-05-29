import type { ScenarioName } from "./scenarios";

let activeScenario: ScenarioName = "default";

/** Текущий глобальный сценарий Storybook (обновляется декоратором withScenario). */
export function getActiveStorybookScenario(): ScenarioName {
  return activeScenario;
}

export function setActiveStorybookScenario(name: ScenarioName): void {
  activeScenario = name;
}
