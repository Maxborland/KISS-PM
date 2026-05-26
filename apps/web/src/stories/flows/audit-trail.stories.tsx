import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";

import { ProjectAuditBlock } from "@/views/blocks/project-audit-block";
import { getScreenRoute } from "@/views/screens/screen-route";
import { WorkspaceChrome } from "@/views/layout/workspace-chrome";
import {
  FlowStage,
  FlowStoryFrame,
  flowParameters,
  FLOW_STORY_PARAMETERS
} from "@/stories/flows/flow-story-helpers";

const STEPS = [
  "Аудитор открывает журнал управленческих действий проекта.",
  "Фильтрует события по типу действия и исполнителю.",
  "Проверяет результат permission check и ссылку на сущность."
] as const;

const meta: Meta = {
  title: "Flows/Аудит",
  parameters: FLOW_STORY_PARAMETERS,
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  name: "Журнал аудита",
  parameters: flowParameters([...STEPS]),
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("17-project-audit")}>
      <FlowStoryFrame
        title="Аудит действий"
        lead="Governed actions: каждое существенное действие оставляет след в audit trail."
        steps={[...STEPS]}
      >
        <FlowStage index={1} title="Журнал событий" apiHint="GET /api/tenant/current/audit-events">
          <ProjectAuditBlock />
        </FlowStage>
      </FlowStoryFrame>
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Журнал событий")).toBeTruthy();
    await expect(canvas.getByPlaceholderText("Поиск по аудиту")).toBeTruthy();
  }
};
