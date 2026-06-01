import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "@storybook/test";

import { AgentCockpitBlock } from "@/views/blocks/agent-cockpit-block";
import { getScreenRoute } from "@/views/screens/screen-route";
import { WorkspaceChrome } from "@/views/layout/workspace-chrome";

const meta: Meta = {
  title: "Flows/Агент рабочей области",
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj;

export const ReviewAndAudit: Story = {
  name: "Сверка и результат",
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("20-agent-cockpit")}>
      <div className="agent-cockpit-screen">
        <AgentCockpitBlock
          variant="surface"
          currentUserId="usr-1"
          thread={{
            context: {},
            messages: [
              {
                authorUserId: "usr-1",
                authorType: "user",
                body: "Что требует внимания сегодня?",
                context: {},
                createdAt: "2026-06-01T09:00:00.000Z",
                id: "message-1"
              },
              {
                authorUserId: "usr-1",
                authorType: "agent",
                body: "Нашел риск по срокам и подготовил действие для ревью.",
                context: {},
                createdAt: "2026-06-01T09:01:00.000Z",
                id: "message-2"
              }
            ],
            proposals: [
              {
                actionType: "workspace.agent.create_task",
                auditEventId: "audit-hidden",
                context: {},
                createdAt: "2026-06-01T09:02:00.000Z",
                description: "Добавить задачу для проверки просроченного этапа.",
                id: "proposal-1",
                messageId: "message-2",
                payload: { task: { id: "task-agent-story", title: "Проверить просроченный этап" } },
                resultSummary: {
                  status: "succeeded",
                  mutationApplied: true,
                  changedEntity: {
                    type: "Task",
                    id: "task-agent-story",
                    title: "Проверить просроченный этап"
                  },
                  auditEventId: "audit-hidden",
                  description: "Создана задача «Проверить просроченный этап»."
                },
                resolvedAt: "2026-06-01T09:03:00.000Z",
                status: "applied",
                title: "Создать задачу восстановления"
              }
            ]
          }}
        />
      </div>
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("Агент рабочей области").length).toBeGreaterThan(0);
    await expect(canvas.getByText("Сверка изменений")).toBeTruthy();
    await expect(canvas.getByText("Создана задача: Проверить просроченный этап")).toBeTruthy();
    await expect(canvas.getByText(/Task:task-agent-story/)).toBeTruthy();
    await expect(canvas.getByText(/audit-hidden/)).toBeTruthy();
  }
};
