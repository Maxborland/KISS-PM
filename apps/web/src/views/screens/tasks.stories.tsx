import { expect, fireEvent, waitFor, within } from "@storybook/test";

import { TaskCreateModalBlock } from "@/views/blocks/task-create-modal-block";
import { getScreenRoute } from "@/views/screens/screen-route";
import {
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
  title: "Screens/Задачи",
};
export default meta;


type Story = ScreenStory;

export const TaskCard: Story = {
  id: screenStoryId("TaskCard"), name: "Карточка задачи", args: screenStoryArgs("03-task-card") };

export const CreateTaskModal: Story = {
  id: screenStoryId("CreateTaskModal"),
  name: "Создание задачи · обзор",
  args: screenStoryArgs("04-create-task-modal")
};

export const CreateTaskModalStep1: Story = {
  id: screenStoryId("CreateTaskModalStep1"),
  name: "Создание задачи · шаг 1",
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("04-create-task-modal")}>
      <TaskCreateModalBlock initialStep={1} />
    </WorkspaceChrome>
  )
};

export const CreateTaskModalValidation: Story = {
  id: screenStoryId("CreateTaskModalValidation"),
  name: "Создание задачи · валидация",
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("04-create-task-modal")}>
      <TaskCreateModalBlock initialStep={2} />
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const next = canvas.getByRole("button", { name: "Далее" });
    fireEvent.click(next);
    await waitFor(() => {
      expect(canvas.getByText(/Название: от 3 до 160 символов/i)).toBeTruthy();
    });
    const nameInput = canvas.getByLabelText(/Название/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Согласовать ТЗ" } });
    fireEvent.click(next);
    await waitFor(() => {
      expect(canvas.getByRole("heading", { level: 3, name: "Участники" })).toBeTruthy();
      expect(canvas.getByRole("button", { name: /3\s+Участники/ })).toHaveAttribute("aria-current", "step");
    });
  }
};
