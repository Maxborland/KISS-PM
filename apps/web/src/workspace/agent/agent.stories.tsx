import type { Meta, StoryObj } from "@storybook/react";

import { AgentSurface } from "@/workspace/agent/agent-surface";

/**
 * Агент — альтернативное ведение работы через безопасные предложения. Анализирует
 * задачи пользователя (GET /api/workspace/my-work) и предлагает разрешённые переходы
 * статусов (ALLOWED_TRANSITIONS); применение — по двухшаговому подтверждению, боевым
 * PATCH /api/workspace/projects/:id/tasks/:taskId/status. createWorkspaceClient +
 * in-memory mock; данные in-memory.
 */
const meta: Meta<typeof AgentSurface> = {
  title: "Workspace/Agent",
  component: AgentSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof AgentSurface>;

export const Default: Story = { name: "Агент" };
