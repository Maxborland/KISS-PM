import { expect, fireEvent, waitFor, within } from "@storybook/test";

import { DealsBlock } from "@/views/blocks/deals-block";
import { EntityDetailBlock } from "@/views/blocks/entity-detail-block";
import { getScreenRoute } from "@/views/screens/screen-route";
import { kanbanPlayRoot, playKanbanPointerDrag } from "@/stories/storybook-kanban-play";
import {
  screenScenarioStory,
  screenStoryArgs,
  screenStoryId,
  type ScreenStory
} from "@/views/screens/screen-story-helpers";
import { WorkspaceChrome } from "@/views/layout/workspace-chrome";

import type { Meta } from "@storybook/react";

import { screenStoryMetaBase } from "@/views/screens/screen-story-meta";
import { ScreenView } from "@/views/screens/screen-view";

const meta: Meta<typeof ScreenView> = {
  ...screenStoryMetaBase,
  title: "Screens/Сделки",
};
export default meta;


type Story = ScreenStory;

export const Deals: Story = {
  id: screenStoryId("Deals"), name: "Воронка", args: screenStoryArgs("05-deals") };

export const DealCard: Story = {
  id: screenStoryId("DealCard"), name: "Карточка сделки", args: screenStoryArgs("06-deal-card") };

export const EntityDetailDirty: Story = {
  id: screenStoryId("EntityDetailDirty"),
  name: "Сохранение изменений",
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("06-deal-card")}>
      <EntityDetailBlock
        title="Сделка «Ромашка»"
        subtitle="DEAL-101 · ООО «Ромашка»"
        stage={{ label: "Квалификация", tone: "violet" }}
      />
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const save = canvas.getByRole("button", { name: "Сохранить" });
    expect(save.hasAttribute("disabled")).toBe(true);
    const amount = canvas.getByLabelText(/Сумма/i) as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "920 000" } });
    await waitFor(() => {
      expect(canvas.getByRole("button", { name: /Сохранить · есть изменения/i })).toBeTruthy();
    });
    fireEvent.click(canvas.getByRole("button", { name: /Сохранить · есть изменения/i }));
    await waitFor(() => {
      expect(canvas.getByRole("button", { name: "Сохранить" }).hasAttribute("disabled")).toBe(true);
    });
  }
};

export const DealsFunnelDragging: Story = {
  id: screenStoryId("DealsFunnelDragging"),
  name: "Перетаскивание",
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("05-deals")}>
      <DealsBlock />
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const board = kanbanPlayRoot(canvasElement);
    await playKanbanPointerDrag(board, "DEAL-103", "КП", "Аудит Salesforce");
  }
};

export const DealsLoading: Story = {
  id: screenStoryId("DealsLoading"),
  name: "Загрузка",
  ...screenScenarioStory("05-deals", "loading"),
};

export const DealsError: Story = {
  id: screenStoryId("DealsError"),
  name: "Ошибка",
  ...screenScenarioStory("05-deals", "error"),
};

export const DealsForbidden: Story = {
  id: screenStoryId("DealsForbidden"),
  name: "Нет доступа",
  ...screenScenarioStory("05-deals", "forbidden"),
};
