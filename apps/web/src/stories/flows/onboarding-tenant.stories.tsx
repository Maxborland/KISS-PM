import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";

import { AdminBlock } from "@/views/blocks/admin-block";
import { SettingsBlock } from "@/views/blocks/settings-block";
import { getScreenRoute } from "@/views/screens/screen-route";
import { WorkspaceChrome } from "@/views/layout/workspace-chrome";
import {
  FlowStage,
  FlowStoryFrame,
  flowParameters,
  FLOW_STORY_PARAMETERS
} from "@/stories/flows/flow-story-helpers";

const STEPS = [
  "Администратор рабочей области приглашает пользователей и назначает профили доступа.",
  "Настраивает оргструктуру и должности.",
  "Включает шаблоны проектов и пользовательские поля в настройках рабочей области."
] as const;

const meta: Meta = {
  title: "Flows/Онбординг рабочей области",
  parameters: FLOW_STORY_PARAMETERS,
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  name: "Онбординг рабочей области",
  parameters: flowParameters([...STEPS]),
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("09-admin")}>
      <FlowStoryFrame
        title="Онбординг рабочей области"
        lead="Первичная настройка рабочей области перед запуском проектов."
        steps={[...STEPS]}
      >
        <FlowStage index={1} title="Администрирование" apiHint="GET /api/tenant/current/access-profiles">
          <AdminBlock />
        </FlowStage>
        <FlowStage index={2} title="Настройки рабочей области" apiHint="GET /api/workspace/config/project-templates">
          <SettingsBlock />
        </FlowStage>
      </FlowStoryFrame>
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Администрирование")).toBeTruthy();
    await expect(canvas.getByText("Настройки")).toBeTruthy();
  }
};
