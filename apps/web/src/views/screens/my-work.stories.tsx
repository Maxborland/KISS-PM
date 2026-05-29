import { expect, fireEvent, screen, waitFor, within } from "@storybook/test";

import { MyWorkBlock } from "@/views/blocks/my-work-block";
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
  title: "Screens/Моя работа",
};
export default meta;


type Story = ScreenStory;

export const MyWork: Story = {
  id: screenStoryId("MyWork"), name: "Обзор", args: screenStoryArgs("02-my-work") };

export const MyWorkListMode: Story = {
  id: screenStoryId("MyWorkListMode"),
  name: "Список",
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("02-my-work")}>
      <MyWorkBlock initialMode="list" />
    </WorkspaceChrome>
  )
};

export const MyWorkKanbanDragging: Story = {
  id: screenStoryId("MyWorkKanbanDragging"),
  name: "Перетаскивание",
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("02-my-work")}>
      <MyWorkBlock initialMode="kanban" />
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const board = kanbanPlayRoot(canvasElement);
    await playKanbanPointerDrag(board, "MDS-39", "В работе", "Новая страница продукта");

    const openCard = await canvas.findByLabelText(/Открыть карточку MDS-2/i);
    openCard.focus();
    fireEvent.keyDown(openCard, { key: "Enter", code: "Enter" });
    await waitFor(() => {
      expect(screen.queryAllByText("Презентация для клиента").length).toBeGreaterThan(0);
    });
  }
};

export const MyWorkEmpty: Story = {
  id: screenStoryId("MyWorkEmpty"),
  name: "Пусто",
  ...screenScenarioStory("02-my-work", "empty"),
};

export const MyWorkLoading: Story = {
  id: screenStoryId("MyWorkLoading"),
  name: "Загрузка",
  ...screenScenarioStory("02-my-work", "loading"),
};

export const MyWorkError: Story = {
  id: screenStoryId("MyWorkError"),
  name: "Ошибка",
  ...screenScenarioStory("02-my-work", "error"),
};

export const MyWorkForbidden: Story = {
  id: screenStoryId("MyWorkForbidden"),
  name: "Нет доступа",
  ...screenScenarioStory("02-my-work", "forbidden"),
};
