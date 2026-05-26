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

export type ScreenStory = StoryObj<typeof ScreenView>;

/** Сценарий MSW для экрана (Phase 7: loading / empty / error / forbidden). */
export function screenScenarioStory(
  id: ScreenId,
  name: string,
  scenario: ScenarioName
): ScreenStory {
  return {
    name,
    args: screenStoryArgs(id),
    parameters: { ...SCREEN_STORY_PARAMETERS, scenario }
  };
}
