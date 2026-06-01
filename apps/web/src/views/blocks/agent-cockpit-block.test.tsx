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
      expect(host.textContent).toContain("Читает доступный контекст рабочей области");
      expect(host.textContent).toContain("Сверка изменений");
      expect(host.textContent).toContain("До / после");
      expect(host.textContent).toContain("Создана задача: Проверить просроченный этап");
      expect(host.textContent).toContain("Результат применен и записан в аудит рабочей области.");
      expect(host.textContent).not.toContain("audit-hidden");

      const applyButton = Array.from(host.querySelectorAll("button")).find((button) =>
        button.textContent?.includes("Применить")
      );
      expect(applyButton?.hasAttribute("disabled")).toBe(true);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
  });
});
