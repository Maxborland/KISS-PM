// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { AgentCockpitBlock } from "@/views/blocks/agent-cockpit-block";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("AgentCockpitBlock", () => {
  it("renders empty, thinking, review and applied audit states without fake enabled actions", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => {
        root.render(
          createElement(AgentCockpitBlock, {
            isSending: true,
            operationsCockpit: {
              generatedAt: "2026-06-01T00:00:00.000Z",
              scope: { type: "workspace", tenantId: "tenant-alpha" },
              indicators: {
                activeProjects: 3,
                overdueProjects: 1,
                activeTasks: 9,
                overdueTasks: 2,
                waitingTasks: 1,
                criticalTasks: 1,
                openDeals: 4,
                readyToActivateDeals: 1
              },
              attentionItems: [
                {
                  id: "attention-1",
                  kind: "project_overdue",
                  severity: "critical",
                  title: "Проект требует решения",
                  reason: "Плановая дата завершения проекта уже прошла.",
                  entity: { type: "project", id: "project-1", title: "Проект требует решения" },
                  projectId: "project-1",
                  ownerUserId: null,
                  dueDate: "2026-05-30"
                }
              ],
              workloadHints: { byPerson: [] },
              pipelinePressure: { deals: [] },
              agentContext: {
                contextType: "operations_cockpit",
                focus: { type: "workspace", tenantId: "tenant-alpha" },
                generatedAt: "2026-06-01T00:00:00.000Z",
                sourceEntityTypes: ["Project", "Task", "Opportunity", "TenantUser"],
                unavailableSources: []
              }
            },
            thread: {
              context: {},
              messages: [],
              proposals: [
                {
                  actionType: "workspace.agent.create_task",
                  auditEventId: "audit-hidden",
                  context: {},
                  createdAt: "2026-06-01T00:01:00.000Z",
                  description: "Создать задачу восстановления срока.",
                  id: "proposal-applied",
                  messageId: "message-runtime",
                  payload: { task: { title: "Проверить просроченный этап" } },
                  resultSummary: {
                    status: "succeeded",
                    mutationApplied: true,
                    changedEntity: {
                      type: "Task",
                      id: "task-agent-result",
                      title: "Проверить просроченный этап"
                    },
                    auditEventId: "audit-hidden",
                    description: "Создана задача «Проверить просроченный этап»."
                  },
                  resolvedAt: "2026-06-01T00:02:00.000Z",
                  status: "applied",
                  title: "Создать задачу"
                },
                {
                  actionType: "workspace.agent.review_request",
                  auditEventId: null,
                  context: {},
                  createdAt: "2026-06-01T00:03:00.000Z",
                  description: "Согласовать управленческое поручение.",
                  id: "proposal-pending",
                  messageId: "message-runtime",
                  payload: {},
                  resolvedAt: null,
                  status: "proposed",
                  title: "Зафиксировать поручение"
                }
              ]
            }
          })
        );
      });

      expect(host.textContent).toContain("История пуста");
      expect(host.textContent).toContain("Контекст cockpit");
      expect(host.textContent).toContain("3 активных проектов");
      expect(host.textContent).toContain("Проект требует решения");
      expect(host.textContent).toContain("Читает доступный контекст рабочей области");
      expect(host.textContent).toContain("Сверка изменений");
      expect(host.textContent).toContain("До / после");
      expect(host.textContent).toContain("Создана задача: Проверить просроченный этап");
      expect(host.textContent).toContain("Изменение применено");
      expect(host.textContent).toContain("Task:task-agent-result · Проверить просроченный этап");
      expect(host.textContent).toContain("Записано в аудит: audit-hidden");
      expect(host.textContent).toContain("Результат применен и записан в аудит рабочей области.");

      const applyButton = Array.from(host.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Применить")
      );
      expect(applyButton?.hasAttribute("disabled")).toBe(true);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("surfaces unavailable operations cockpit context instead of presenting it as empty", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => {
        root.render(
          createElement(AgentCockpitBlock, {
            operationsCockpit: {
              generatedAt: "",
              scope: { type: "workspace", tenantId: "" },
              indicators: {
                activeProjects: 0,
                overdueProjects: 0,
                activeTasks: 0,
                overdueTasks: 0,
                waitingTasks: 0,
                criticalTasks: 0,
                openDeals: 0,
                readyToActivateDeals: 0
              },
              attentionItems: [],
              workloadHints: { byPerson: [] },
              pipelinePressure: { deals: [] },
              agentContext: {
                contextType: "operations_cockpit",
                focus: { type: "workspace", tenantId: "" },
                generatedAt: "",
                sourceEntityTypes: [],
                unavailableSources: [
                  {
                    source: "operations_cockpit",
                    reason: "persistence_not_configured"
                  }
                ]
              }
            },
            thread: {
              context: {},
              messages: [],
              proposals: []
            }
          })
        );
      });

      expect(host.textContent).toContain("Операционный контекст недоступен: persistence_not_configured.");
      expect(host.textContent).not.toContain("Критичных сигналов в доступном контексте нет.");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("renders persisted agent replies as Henry even when the triggering user id is stored for audit", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => {
        root.render(
          createElement(AgentCockpitBlock, {
            currentUserId: "user-alpha",
            thread: {
              context: {},
              messages: [
                {
                  id: "message-user",
                  authorUserId: "user-alpha",
                  authorType: "user",
                  body: "Что требует внимания?",
                  context: {},
                  createdAt: "2026-06-01T00:00:00.000Z"
                },
                {
                  id: "message-agent",
                  authorUserId: "user-alpha",
                  authorType: "agent",
                  body: "Подготовил действие. Без подтверждения ничего не изменю.",
                  context: {},
                  createdAt: "2026-06-01T00:01:00.000Z"
                }
              ],
              proposals: []
            }
          })
        );
      });

      expect(host.textContent).toContain("Вы");
      expect(host.textContent).toContain("Генри Гантт");
      expect(host.textContent).toContain("Подготовил действие. Без подтверждения ничего не изменю.");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});
