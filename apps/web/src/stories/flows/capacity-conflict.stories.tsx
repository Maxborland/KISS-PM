import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";

import { ProjectResourcesBlock } from "@/views/blocks/project-resources-block";
import { getScreenRoute } from "@/views/screens/screen-route";
import { WorkspaceChrome } from "@/views/layout/workspace-chrome";
import {
  FlowStage,
  FlowStoryFrame,
  flowParameters,
  FLOW_STORY_PARAMETERS
} from "@/stories/flows/flow-story-helpers";

const STEPS = [
  "Планировщик открывает матрицу ресурсов проекта на период.",
  "Видит перегруз по ролям (сценарий «Перегруз»).",
  "Принимает решение: переназначить, сдвинуть срок или эскалировать конфликт."
] as const;

const meta: Meta = {
  title: "Flows/Конфликт загрузки",
  parameters: FLOW_STORY_PARAMETERS,
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  name: "Конфликт capacity",
  parameters: flowParameters([...STEPS], "overload"),
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("13-project-resources")}>
      <FlowStoryFrame
        title="Конфликт загрузки"
        lead="Ресурсный контур: матрица загрузки и перегруз по часам."
        steps={[...STEPS]}
      >
        <FlowStage index={1} title="Матрица ресурсов" apiHint="GET /api/tenant/current/scheduled-tasks">
          <ProjectResourcesBlock />
        </FlowStage>
      </FlowStoryFrame>
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Назначить|Роли/i)).toBeTruthy();
    expect(canvasElement.querySelector(".rmatrix")).toBeTruthy();
  }
};
