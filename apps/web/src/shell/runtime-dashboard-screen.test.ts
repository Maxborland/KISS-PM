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

    try {
      await act(async () => {
        root.render(
          createElement(
            ScreenRouteProvider,
            {
              meta: getScreenRoute("01-dashboard"),
              children: createElement(RuntimeDashboardScreen, {
                data: {
                  projects: [],
                  tasks: [],
                  scheduledTasks: [],
                  workspaceAgentThread: {
                    context: {},
                    messages: [
                      {
                        id: "message-runtime",
                        authorUserId: "usr-1",
                        body: "Проверить просроченные задачи",
                        context: {},
                        createdAt: "2026-06-01T00:00:00.000Z"
                      }
                    ]
                  }
              } as never,
              currentUserId: "usr-1",
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
      expect(host.textContent).not.toContain("Применить выбранное");

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
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});
