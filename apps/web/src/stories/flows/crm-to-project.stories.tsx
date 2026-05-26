import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";

import { DealsBlock } from "@/views/blocks/deals-block";
import { EntityDetailBlock } from "@/views/blocks/entity-detail-block";
import { ProjectsListBlock } from "@/views/blocks/projects-list-block";
import { getScreenRoute } from "@/views/screens/screen-route";
import { WorkspaceChrome } from "@/views/layout/workspace-chrome";
import {
  FlowStage,
  FlowStoryFrame,
  flowParameters,
  FLOW_STORY_PARAMETERS
} from "@/stories/flows/flow-story-helpers";

const STEPS = [
  "Менеджер открывает воронку сделок и видит стадии CRM.",
  "Переходит в карточку сделки: проверяет клиента, сумму и ответственного.",
  "После согласования сделка активируется как проект в реестре проектов."
] as const;

const meta: Meta = {
  title: "Flows/CRM → проект",
  parameters: FLOW_STORY_PARAMETERS,
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  name: "CRM → проект",
  parameters: flowParameters([...STEPS]),
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("05-deals")}>
      <FlowStoryFrame
        title="CRM → проект"
        lead="Контур приёмки: opportunity → intake → активный проект."
        steps={[...STEPS]}
      >
        <FlowStage index={1} title="Воронка сделок" apiHint="GET /api/workspace/opportunities">
          <DealsBlock />
        </FlowStage>
        <FlowStage index={2} title="Карточка сделки" apiHint="GET /api/workspace/clients">
          <EntityDetailBlock
            title="Внедрение CRM для «СеверСтрой»"
            subtitle="OPP-2026-041 · стадия «Согласование»"
            stage={{ label: "Согласование", tone: "info" }}
            variant="deal"
          />
        </FlowStage>
        <FlowStage index={3} title="Реестр проектов" apiHint="GET /api/workspace/projects">
          <ProjectsListBlock />
        </FlowStage>
      </FlowStoryFrame>
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Сделки|воронк/i)).toBeTruthy();
    await expect(canvas.getByRole("table")).toBeTruthy();
  }
};
