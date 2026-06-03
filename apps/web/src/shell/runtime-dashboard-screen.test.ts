// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";

import { getScheduledTaskDailyWorkMinutes } from "@/lib/scheduled-tasks";
import { getScreenRoute } from "@/shell/navigation-registry";
import { RuntimeDashboardScreen } from "@/shell/runtime-dashboard-screen";
import { ScreenRouteProvider } from "@/views/layout/screen-route-context";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("getScheduledTaskDailyWorkMinutes", () => {
  it("uses the full scheduled work for a single-day task", () => {
    expect(
      getScheduledTaskDailyWorkMinutes(
        {
          plannedStart: "2026-05-30",
          plannedFinish: "2026-05-30",
          workMinutes: 480
        },
        "2026-05-30"
      )
    ).toBe(480);
  });

  it("uses only the daily slice for a task spanning multiple days", () => {
    expect(
      getScheduledTaskDailyWorkMinutes(
        {
          plannedStart: "2026-05-30",
          plannedFinish: "2026-06-03",
          workMinutes: 2400
        },
        "2026-05-30"
      )
    ).toBe(480);
  });

  it("ignores tasks outside the selected day", () => {
    expect(
      getScheduledTaskDailyWorkMinutes(
        {
          plannedStart: "2026-05-30",
          plannedFinish: "2026-06-03",
          workMinutes: 2400
        },
        "2026-06-04"
      )
    ).toBe(0);
  });
});

describe("RuntimeDashboardScreen", () => {
  it("renders the unified workspace agent thread and sends messages", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const sent: string[] = [];
    const confirmed: Array<[string, "apply" | "reject"]> = [];

    try {
      await act(async () => {
        root.render(
          createElement(
            ScreenRouteProvider,
            {
              meta: getScreenRoute("01-dashboard"),
              children: createElement(RuntimeDashboardScreen, {
                currentUserId: "usr-1",
                data: {
                  projects: [],
                  scheduledTasks: [],
                  tasks: [],
                  operationsCockpit: emptyOperationsCockpit(),
                  workspaceAgentThread: {
                    context: {},
                    messages: [
                      {
                        authorUserId: "usr-1",
                        body: "Проверить просроченные задачи",
                        context: {},
                        createdAt: "2026-06-01T00:00:00.000Z",
                        id: "message-runtime"
                      }
                    ],
                    proposals: [
                      {
                        actionType: "workspace.agent.review_request",
                        auditEventId: null,
                        context: {},
                        createdAt: "2026-06-01T00:01:00.000Z",
                        description: "Записать поручение без изменения проектов.",
                        id: "proposal-runtime",
                        messageId: "message-runtime",
                        payload: {},
                        resolvedAt: null,
                        status: "proposed",
                        title: "Зафиксировать управленческое поручение"
                      }
                    ]
                  }
                } as never,
                onConfirmWorkspaceAgentAction: async (proposalId, decision) => {
                  confirmed.push([proposalId, decision]);
                },
                onSendWorkspaceAgentMessage: async (body) => {
                  sent.push(body);
                }
              })
            }
          )
        );
      });

      expect(host.textContent).toContain("Управленческий агент");
      expect(host.textContent).toContain("Генри Гантт");
      expect(host.textContent).toContain("Сверка изменений");
      expect(host.textContent).toContain("Ждет подтверждения перед изменениями");
      expect(host.textContent).toContain("Проверить просроченные задачи");
      expect(host.textContent).toContain("Зафиксировать управленческое поручение");
      expect(host.textContent).toContain("Применить");

      const textarea = host.querySelector("textarea");
      expect(textarea).not.toBeNull();
      await act(async () => {
        const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
        valueSetter?.call(textarea, "Что горит сегодня?");
        textarea!.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
      });
      await act(async () => {
        host.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      });

      expect(sent).toEqual(["Что горит сегодня?"]);
      await act(async () => {
        Array.from(host.querySelectorAll("button"))
          .find((button) => button.textContent?.includes("Применить"))
          ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(confirmed).toEqual([["proposal-runtime", "apply"]]);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("shows the concrete task changed by an applied agent proposal", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => {
        root.render(
          createElement(
            ScreenRouteProvider,
            {
              meta: getScreenRoute("01-dashboard"),
              children: createElement(RuntimeDashboardScreen, {
                currentUserId: "usr-1",
                data: {
                  projects: [],
                  scheduledTasks: [],
                  tasks: [],
                  operationsCockpit: emptyOperationsCockpit(),
                  workspaceAgentThread: {
                    context: {},
                    messages: [],
                    proposals: [
                      {
                        actionType: "workspace.agent.create_task",
                        auditEventId: "audit-agent-action-1",
                        context: {},
                        createdAt: "2026-06-01T00:01:00.000Z",
                        description: "Генри подготовил задачу: Проверить исходные данные.",
                        id: "proposal-task",
                        messageId: "message-runtime",
                        payload: {
                          task: {
                            id: "task-agent-result",
                            title: "Проверить исходные данные"
                          }
                        },
                        resultSummary: {
                          status: "succeeded",
                          mutationApplied: true,
                          changedEntity: {
                            type: "Task",
                            id: "task-agent-result",
                            title: "Проверить исходные данные"
                          },
                          auditEventId: "audit-agent-action-1",
                          description: "Создана задача «Проверить исходные данные»."
                        },
                        resolvedAt: "2026-06-01T00:02:00.000Z",
                        status: "applied",
                        title: "Создать задачу"
                      }
                    ]
                  }
                } as never
              })
            }
          )
        );
      });

      expect(host.textContent).toContain("Создана задача: Проверить исходные данные");
      expect(host.textContent).toContain("Task:task-agent-result · Проверить исходные данные");
      expect(host.textContent).toContain("Записано в аудит: audit-agent-action-1");
      expect(host.textContent).toContain("Результат применен и записан в аудит рабочей области.");
      expect(host.textContent).toContain("применено");
      expect(host.textContent).not.toContain("Применить");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("renders operational attention, workload and pipeline pressure from the dashboard read model", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => {
        root.render(
          createElement(
            ScreenRouteProvider,
            {
              meta: getScreenRoute("01-dashboard"),
              children: createElement(RuntimeDashboardScreen, {
                currentUserId: "usr-1",
                data: {
                  projects: [],
                  scheduledTasks: [],
                  tasks: [],
                  operationsCockpit: {
                    ...emptyOperationsCockpit(),
                    indicators: {
                      ...emptyOperationsCockpit().indicators,
                      activeProjects: 3,
                      overdueTasks: 2,
                      openDeals: 4
                    },
                    attentionItems: [
                      {
                        id: "attention-1",
                        kind: "task_overdue",
                        severity: "critical",
                        title: "Просрочен авторский надзор",
                        reason: "Срок задачи прошел вчера.",
                        entity: {
                          type: "task",
                          id: "task-1",
                          title: "Авторский надзор ЖК Север"
                        },
                        projectId: "project-1",
                        ownerUserId: "usr-2",
                        dueDate: "2026-05-31"
                      },
                      {
                        id: "attention-2",
                        kind: "deal_ready_to_activate",
                        severity: "info",
                        title: "Сделка готова к проекту",
                        reason: "Нужно передать в проект.",
                        entity: {
                          type: "deal",
                          id: "deal-1",
                          title: "Бизнес-центр на Ленина"
                        },
                        projectId: null,
                        ownerUserId: "usr-3",
                        dueDate: "2026-06-10"
                      },
                      {
                        id: "attention-3",
                        kind: "deal_missing_next_action",
                        severity: "warning",
                        title: "Сделка без следующего действия",
                        reason: "У сделки не задано следующее действие для клиента.",
                        entity: {
                          type: "deal",
                          id: "deal-without-next-action",
                          title: "Квартал на Садовой"
                        },
                        projectId: null,
                        ownerUserId: "usr-3",
                        dueDate: "2026-06-12"
                      }
                    ],
                    workloadHints: {
                      byPerson: [
                        {
                          userId: "usr-2",
                          name: "Анна Орлова",
                          positionName: "Ведущий архитектор",
                          activeTaskCount: 7,
                          overdueTaskCount: 2,
                          criticalTaskCount: 1,
                          plannedWorkHours: 46
                        }
                      ]
                    },
                    pipelinePressure: {
                      deals: [
                        {
                          id: "deal-1",
                          title: "Бизнес-центр на Ленина",
                          clientName: "ООО Север",
                          status: "qualification",
                          probability: 70,
                          plannedFinish: "2026-06-10",
                          plannedHours: 320,
                          contractValue: 5000000,
                          ownerUserId: "usr-3",
                          feasibilityStatus: "at_risk"
                        }
                      ]
                    }
                  },
                  workspaceAgentThread: {
                    context: {},
                    messages: [],
                    proposals: []
                  }
                } as never
              })
            }
          )
        );
      });

      expect(host.textContent).toContain("Что требует внимания");
      expect(host.textContent).toContain("Просрочен авторский надзор");
      expect(host.textContent).toContain("Срок задачи прошел вчера.");
      const attentionLink = host.querySelector(
        'a[href="/projects/project-1?taskId=task-1"][aria-label="Открыть сигнал: Просрочен авторский надзор"]'
      );
      expect(attentionLink?.textContent).toContain("Авторский надзор ЖК Север");
      const dealAttentionLink = host.querySelector(
        'a[href="/deals/deal-1"][aria-label="Открыть сигнал: Сделка готова к проекту"]'
      );
      expect(dealAttentionLink?.textContent).toContain("Бизнес-центр на Ленина");
      expect(host.textContent).toContain("У сделки не задано следующее действие для клиента.");
      const missingNextActionLink = host.querySelector(
        'a[href="/deals/deal-without-next-action"][aria-label="Открыть сигнал: Сделка без следующего действия"]'
      );
      expect(missingNextActionLink?.textContent).toContain("Квартал на Садовой");
      expect(host.textContent).toContain("Ресурсные риски");
      expect(host.textContent).toContain("Анна Орлова");
      expect(host.textContent).toContain("46 ч · 2 просрочено");
      expect(host.textContent).toContain("Давление воронки");
      expect(host.textContent).toContain("Бизнес-центр на Ленина");
      expect(host.textContent).toContain("ООО Север");
      expect(host.textContent).toContain("есть риск");
      const pipelineLink = host.querySelector(
        'a[href="/deals/deal-1"][aria-label="Открыть сделку: Бизнес-центр на Ленина"]'
      );
      expect(pipelineLink?.textContent).toContain("320 ч");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("does not report hidden workload as an empty workload state", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => {
        root.render(
          createElement(
            ScreenRouteProvider,
            {
              meta: getScreenRoute("01-dashboard"),
              children: createElement(RuntimeDashboardScreen, {
                currentUserId: "usr-1",
                data: {
                  projects: [],
                  scheduledTasks: [],
                  tasks: [],
                  operationsCockpit: {
                    ...emptyOperationsCockpit(),
                    agentContext: {
                      ...emptyOperationsCockpit().agentContext,
                      unavailableSources: [
                        {
                          source: "resource_workload",
                          reason: "permission_denied"
                        }
                      ]
                    }
                  },
                  workspaceAgentThread: {
                    context: {},
                    messages: [],
                    proposals: []
                  }
                } as never
              })
            }
          )
        );
      });

      expect(host.textContent).toContain("Загрузка недоступна");
      expect(host.textContent).toContain("Источник ресурсной загрузки недоступен: permission_denied.");
      expect(host.textContent).not.toContain("Перегруз не найден");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("does not report hidden pipeline as no pipeline pressure", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => {
        root.render(
          createElement(
            ScreenRouteProvider,
            {
              meta: getScreenRoute("01-dashboard"),
              children: createElement(RuntimeDashboardScreen, {
                currentUserId: "usr-1",
                data: {
                  projects: [],
                  scheduledTasks: [],
                  tasks: [],
                  operationsCockpit: {
                    ...emptyOperationsCockpit(),
                    agentContext: {
                      ...emptyOperationsCockpit().agentContext,
                      unavailableSources: [
                        {
                          source: "opportunity_pipeline",
                          reason: "permission_denied"
                        }
                      ]
                    }
                  },
                  workspaceAgentThread: {
                    context: {},
                    messages: [],
                    proposals: []
                  }
                } as never
              })
            }
          )
        );
      });

      expect(host.textContent).toContain("Воронка недоступна");
      expect(host.textContent).toContain("Источник сделок недоступен: permission_denied.");
      expect(host.textContent).not.toContain("Pipeline не давит на портфель");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });

  it("keeps the active-project tile limited to projects with active status", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    try {
      await act(async () => {
        root.render(
          createElement(
            ScreenRouteProvider,
            {
              meta: getScreenRoute("01-dashboard"),
              children: createElement(RuntimeDashboardScreen, {
                currentUserId: "usr-1",
                data: {
                  projects: [
                    { id: "project-active", status: "active" },
                    { id: "project-draft", status: "draft" },
                    { id: "project-paused", status: "paused" }
                  ],
                  scheduledTasks: [],
                  tasks: [],
                  operationsCockpit: {
                    ...emptyOperationsCockpit(),
                    indicators: {
                      ...emptyOperationsCockpit().indicators,
                      activeProjects: 3
                    }
                  },
                  workspaceAgentThread: {
                    context: {},
                    messages: [],
                    proposals: []
                  }
                } as never
              })
            }
          )
        );
      });

      const activeProjectsTile = Array.from(host.querySelectorAll(".kpi-tile")).find((tile) =>
        tile.textContent?.includes("Активные проекты")
      );
      expect(activeProjectsTile?.querySelector(".kpi-tile__value")?.textContent).toBe("1");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});

function emptyOperationsCockpit() {
  return {
    generatedAt: "2026-06-01T00:00:00.000Z",
    scope: { type: "workspace", tenantId: "tenant-alpha" },
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
      focus: { type: "workspace", tenantId: "tenant-alpha" },
      generatedAt: "2026-06-01T00:00:00.000Z",
      sourceEntityTypes: ["Project", "Task", "Opportunity", "TenantUser"],
      unavailableSources: []
    }
  };
}
