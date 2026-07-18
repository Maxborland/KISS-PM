import { describe, expect, it } from "vitest";

import { createAgentClient } from "./agent-client";

function clientWithResponse(payload: unknown) {
  const fetchImpl = (async () =>
    new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } })
  ) as unknown as typeof fetch;
  return createAgentClient({ apiOrigin: "http://api.test", fetchImpl });
}

describe("agent thread history decode", () => {
  it("превращает персистентные ходы в типизированные turns и пропускает не-agent сообщения", async () => {
    const client = clientWithResponse({
      messages: [
        { id: "m-1", body: "Разгрузи Иванова", createdAt: "2026-07-18T10:00:00.000Z", metadata: { agent: { role: "user" } } },
        { id: "m-2", body: "Предлагаю сценарий.", createdAt: "2026-07-18T10:00:05.000Z", metadata: { agent: { role: "agent", proposal: { actionsTotal: 1, actions: [{ tool: "comment_task", title: "Комментарий" }] } } } },
        { id: "m-3", body: "Служебное сообщение без agent-метки", createdAt: "2026-07-18T10:00:06.000Z", metadata: {} },
        {
          id: "m-4",
          body: "Результат: применено 1, отказано 0, конфликтов 0, ошибок 0.",
          createdAt: "2026-07-18T10:00:10.000Z",
          metadata: {
            agent: {
              role: "agent",
              kind: "result",
              correlationId: "agent-execute-1",
              outcomes: [
                { tool: "apply_resource_resolution", status: "applied", auditEventId: "agent-action-1", planningAuditEventId: "audit-9", planVersion: 6, projectId: "project-1" },
                { tool: "broken-entry" }
              ]
            }
          }
        }
      ],
      nextCursor: "m-0"
    });

    const page = await client.loadThreadHistory("agent-thread-user-1");
    expect(page.nextCursor).toBe("m-0");
    expect(page.turns.map((turn) => turn.id)).toEqual(["m-1", "m-2", "m-4"]);
    expect(page.turns[0]).toMatchObject({ role: "user", body: "Разгрузи Иванова" });
    expect(page.turns[1]!.proposal).toMatchObject({ actionsTotal: 1 });
    // Битый outcome без status отброшен, валидный сохранил все поля квитанции.
    expect(page.turns[2]!.outcomes).toEqual([{
      tool: "apply_resource_resolution",
      status: "applied",
      auditEventId: "agent-action-1",
      planningAuditEventId: "audit-9",
      planVersion: 6,
      projectId: "project-1"
    }]);
    expect(page.turns[2]!.correlationId).toBe("agent-execute-1");
  });

  it("loadThread отдаёт id беседы и падает 502-кодом на битом ответе", async () => {
    const ok = clientWithResponse({ conversation: { id: "agent-thread-user-1" } });
    await expect(ok.loadThread()).resolves.toEqual({ id: "agent-thread-user-1" });

    const broken = clientWithResponse({ conversation: {} });
    await expect(broken.loadThread()).rejects.toMatchObject({ code: "invalid_thread_response" });
  });
});
