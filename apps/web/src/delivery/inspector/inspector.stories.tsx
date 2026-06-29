import type { Meta, StoryObj } from "@storybook/react";

import { TaskInspector } from "@/delivery/inspector/task-inspector-surface";

/**
 * Project Delivery — инспектор задачи (design v4).
 * Форма + внутренние табы (рабочий fixture-переключатель), зависимости,
 * назначения, effort-driven пересчёт, bento-рейл (назначение, контроль/права,
 * лента коммитов). Данные по форме planning read-model.
 */
const meta: Meta<typeof TaskInspector> = {
  title: "Project Delivery/Task Inspector",
  component: TaskInspector,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof TaskInspector>;

export const Default: Story = { name: "Инспектор задачи" };
