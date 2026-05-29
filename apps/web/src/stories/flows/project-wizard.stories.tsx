import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, waitFor, within } from "@storybook/test";

import { TaskCreateModalBlock } from "@/views/blocks/task-create-modal-block";
import { getScreenRoute } from "@/views/screens/screen-route";
import { WorkspaceChrome } from "@/views/layout/workspace-chrome";
import {
  FlowStage,
  FlowStoryFrame,
  flowParameters,
  FLOW_STORY_PARAMETERS
} from "@/stories/flows/flow-story-helpers";

const STEPS = [
  "Пользователь открывает мастер создания задачи в контексте проекта.",
  "Заполняет основные поля и переходит к участникам.",
  "Подтверждает создание — UI показывает тело запроса CreateTaskBody (демо)."
] as const;

const CREATE_TASK_STORY_FORM = {
  plannedStart: new Date(Date.UTC(2026, 4, 27)),
  plannedFinish: new Date(Date.UTC(2026, 4, 29)),
  durationWorkingDays: 3,
  plannedWork: 24,
  participants: [{ userId: "user-ivanova", role: "executor" as const }]
};

const meta: Meta = {
  title: "Flows/Мастер задачи",
  parameters: FLOW_STORY_PARAMETERS,
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj;

export const Default: Story = {
  name: "Мастер создания задачи",
  parameters: flowParameters([...STEPS]),
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("04-create-task-modal")}>
      <FlowStoryFrame
        title="Мастер задачи"
        lead="Трёхшаговый мастер: данные → участники → подтверждение."
        steps={[...STEPS]}
      >
        <FlowStage index={1} title="Шаг 1 — Данные задачи">
          <TaskCreateModalBlock
            initialStep={1}
            initialProjectId="PRJ-2026-014"
            initialForm={CREATE_TASK_STORY_FORM}
          />
        </FlowStage>
      </FlowStoryFrame>
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    fireEvent.click(canvas.getByRole("button", { name: "Далее" }));
    await waitFor(() => {
      expect(canvas.getByRole("heading", { level: 3, name: "План" })).toBeTruthy();
    });
    const nameInput = canvas.getByLabelText(/Название/i);
    fireEvent.change(nameInput, { target: { value: "Согласовать ТЗ с заказчиком" } });
    fireEvent.click(canvas.getByRole("button", { name: "Далее" }));
    await waitFor(() => {
      expect(canvas.getByRole("heading", { level: 3, name: "Участники" })).toBeTruthy();
    });
    fireEvent.click(canvas.getByRole("button", { name: "Создать" }));
    await waitFor(() => {
      expect(canvas.getByText(/Задача создана|Запрос подготовлен/i)).toBeTruthy();
    });
  }
};
