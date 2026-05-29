import type { Decorator, StoryObj } from "@storybook/react";
import type { ReactElement, ReactNode } from "react";

import type { ScenarioName } from "@/lib/mock-data/scenarios";
import type { ScreenId } from "@/views/screen-ids";
import { getScreenRoute } from "@/views/screens/screen-route";
import { WorkspaceChrome } from "@/views/layout/workspace-chrome";
import { ScreenView } from "@/views/screens/screen-view";

/** Fullscreen product screen @ 1440px (Phase 7 acceptance). */
export const SCREEN_STORY_PARAMETERS = {
  layout: "fullscreen" as const,
  viewport: { defaultViewport: "desktop1440" }
};

export function screenStoryArgs(id: ScreenId): { id: ScreenId } {
  return { id };
}

/** Суффикс story id внутри root `Screens/*` (итог: `screens-<группа>--*` для VRT). */
export function screenStoryId(exportName: string): string {
  const kebab = exportName
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
  return kebab;
}

/** Обёртка экрана в shell с фиксированным сценарием MSW/фикстур. */
export function ScreenScenarioRender({ id }: { id: ScreenId }) {
  return <ScreenView id={id} />;
}

export function withScreenScenario(scenario: ScenarioName): Decorator {
  return (Story, context) => {
    context.parameters.scenario = scenario;
    return <Story />;
  };
}

export function workspaceBlockStory<Props extends Record<string, unknown>>(
  screenId: ScreenId,
  renderBlock: (props: Props) => ReactNode
): {
  render: (args: Props) => ReactElement;
  parameters: typeof SCREEN_STORY_PARAMETERS;
} {
  const meta = getScreenRoute(screenId);
  return {
    parameters: SCREEN_STORY_PARAMETERS,
    render: (args: Props) => (
      <WorkspaceChrome meta={meta}>{renderBlock(args)}</WorkspaceChrome>
    )
  };
}

export type ScreenStory = StoryObj<typeof ScreenView> & { id?: string };

/** Параметры сценария MSW (Phase 7). `name` задавайте в object literal story — иначе Storybook CSF indexer подставит English из export id. */
export function screenScenarioStory(
  id: ScreenId,
  scenario: ScenarioName
): Omit<ScreenStory, "name"> {
  return {
    args: screenStoryArgs(id),
    parameters: { ...SCREEN_STORY_PARAMETERS, scenario }
  };
}
