import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";

import { ProjectKpiBlock } from "@/views/blocks/project-kpi-block";
import { getScreenRoute } from "@/views/screens/screen-route";
import { WorkspaceChrome } from "@/views/layout/workspace-chrome";
import {
  FlowStage,
  FlowStoryFrame,
  flowParameters,
  FLOW_STORY_PARAMETERS
} from "@/stories/flows/flow-story-helpers";

const STEPS = [
  "Руководитель открывает KPI проекта и видит расчётные показатели.",
  "Система подсвечивает control signal при отклонении от порога.",
  "Пользователь назначает корректирующее действие и фиксирует исполнение в аудите."
] as const;

const meta: Meta = {
  title: "Flows/KPI → действие",
  parameters: FLOW_STORY_PARAMETERS,
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  name: "Сигнал KPI → корректирующее действие",
  parameters: flowParameters([...STEPS], "overload"),
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("16-project-kpi")}>
      <FlowStoryFrame
        title="KPI → корректирующее действие"
        lead="Управленческий контур: метрика → сигнал → действие → исполнение."
        steps={[...STEPS]}
      >
        <FlowStage
          index={1}
          title="KPI, сигналы и действия"
          apiHint="GET /api/workspace/projects/:projectId/control/read-model"
        >
          <ProjectKpiBlock />
        </FlowStage>
      </FlowStoryFrame>
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Сигналы контроля")).toBeTruthy();
    await expect(canvas.getByText("Корректирующие действия")).toBeTruthy();
  }
};
