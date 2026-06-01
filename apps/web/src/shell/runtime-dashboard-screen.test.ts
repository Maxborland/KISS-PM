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
                            title: "Проверить исходные данные"
                          }
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
      expect(host.textContent).toContain("Записано в аудит");
      expect(host.textContent).toContain("Результат применен и записан в аудит рабочей области.");
      expect(host.textContent).not.toContain("audit-agent-action-1");
      expect(host.textContent).toContain("применено");
      expect(host.textContent).not.toContain("Применить");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});
