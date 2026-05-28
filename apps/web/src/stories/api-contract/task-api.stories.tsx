import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, waitFor, within } from "@storybook/test";

import { EntityDetailBlock } from "@/views/blocks/entity-detail-block";
import { TaskCreateModalBlock } from "@/views/blocks/task-create-modal-block";
import { getScreenRoute } from "@/views/screens/screen-route";
import { WorkspaceChrome } from "@/views/layout/workspace-chrome";

const meta: Meta = {
  title: "API Contract/Задачи",
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj;

const CREATE_TASK_STORY_FORM = {
  plannedStart: new Date(Date.UTC(2026, 4, 27)),
  plannedFinish: new Date(Date.UTC(2026, 4, 29)),
  durationWorkingDays: 3,
  plannedWork: 24,
  participants: [{ userId: "user-ivanova", role: "executor" as const }]
};

export const CreateTaskPayload: Story = {
  name: "POST CreateTaskBody — превью",
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("04-create-task-modal")}>
      <TaskCreateModalBlock
        initialStep={2}
        initialProjectId="PRJ-2026-014"
        initialForm={CREATE_TASK_STORY_FORM}
        showApiContractPreview
      />
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nameInput = canvas.getByLabelText(/Название/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Согласовать ТЗ" } });
    fireEvent.click(canvas.getByRole("button", { name: "Далее" }));
    await waitFor(() => {
      expect(canvas.getByRole("heading", { level: 3, name: "Участники" })).toBeTruthy();
    });
    fireEvent.click(canvas.getByRole("button", { name: "Создать" }));
    await waitFor(() => {
      const preview = canvas.getByTestId("task-payload-preview");
      expect(preview.textContent).toContain('"plannedWork"');
      expect(preview.textContent).toContain('"durationWorkingDays"');
      expect(preview.textContent).toContain('"participants"');
      expect(preview.textContent).toContain('"requiresAcceptance"');
    });
  }
};

export const UpdateTaskPayload: Story = {
  name: "PATCH UpdateTaskBody — превью",
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("03-task-card")}>
      <EntityDetailBlock
        title="Согласовать ТЗ"
        subtitle="MDS-39 · Внедрение CRM"
        stage={{ label: "В работе", tone: "info" }}
        variant="task"
        showApiContractPreview
      />
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const workInput = canvas.getByLabelText(/Трудозатраты/i) as HTMLInputElement;
    fireEvent.change(workInput, { target: { value: "20" } });
    await waitFor(() => {
      expect(canvas.getByRole("button", { name: /Сохранить · есть изменения/i })).toBeTruthy();
    });
    fireEvent.click(canvas.getByRole("button", { name: /Сохранить · есть изменения/i }));
    await waitFor(() => {
      const preview = canvas.getByTestId("task-payload-preview");
      expect(preview.textContent).toContain('"clientUpdatedAt"');
      expect(preview.textContent).toContain('"plannedWork": 20');
    });
  }
};

export const CreateTaskValidation: Story = {
  name: "Валидация CreateTaskBody",
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("04-create-task-modal")}>
      <TaskCreateModalBlock initialStep={2} />
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    fireEvent.click(canvas.getByRole("button", { name: "Далее" }));
    await waitFor(() => {
      expect(canvas.getByText(/Название: от 3 до 160 символов/i)).toBeTruthy();
    });
  }
};
