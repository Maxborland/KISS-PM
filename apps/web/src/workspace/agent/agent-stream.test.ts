import { describe, expect, it, vi } from "vitest";

import { createAgentClient, type AgentStreamEvent } from "./agent-client";
import { createMockAgentFetch } from "./mock-agent-backend";

// Собираем Response с телом-ReadableStream из SSE-кадров (как Hono streamSSE).
function sseResponse(frames: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    }
  });
  return new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } });
}

describe("agent-client.proposeStream", () => {
  it("парсит SSE-кадры в события и резолвится финальным done", async () => {
    const done = { goal: "g", model: "m", reasoning: "Готово.", analyzeResults: [], proposedActions: [], iterations: 2 };
    const fetchImpl = vi.fn().mockResolvedValue(
      sseResponse([
        'event: reasoning\ndata: {"type":"reasoning","text":"Смотрю задачи."}\n\n',
        'event: analyze\ndata: {"type":"analyze","tool":"list_my_tasks","title":"Мои задачи","ok":true}\n\n',
        // кадр, пришедший двумя чанками — проверяем буферизацию
        'event: proposal\ndata: {"type":"proposal","tool":"change_task_status",',
        '"title":"Сменить статус задачи"}\n\n',
        `event: done\ndata: ${JSON.stringify(done)}\n\n`
      ])
    );
    const client = createAgentClient({ apiOrigin: "", fetchImpl: fetchImpl as unknown as typeof fetch });

    const events: AgentStreamEvent[] = [];
    const result = await client.proposeStream("g", (e) => events.push(e));

    expect(events).toEqual([
      { type: "reasoning", text: "Смотрю задачи." },
      { type: "analyze", tool: "list_my_tasks", title: "Мои задачи", ok: true },
      { type: "proposal", tool: "change_task_status", title: "Сменить статус задачи" }
    ]);
    expect(result.reasoning).toBe("Готово.");
    expect(result.iterations).toBe(2);
  });

  it("кидает AgentApiError на event: error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(sseResponse(['event: error\ndata: {"error":"token_budget_exceeded"}\n\n']));
    const client = createAgentClient({ apiOrigin: "", fetchImpl: fetchImpl as unknown as typeof fetch });
    await expect(client.proposeStream("g", () => {})).rejects.toMatchObject({ code: "token_budget_exceeded" });
  });

  it("парсит CRLF SSE-кадры от прокси", async () => {
    const done = { goal: "g", model: "m", reasoning: "Готово.", analyzeResults: [], proposedActions: [], iterations: 1 };
    const fetchImpl = vi.fn().mockResolvedValue(
      sseResponse([
        'event: reasoning\r\ndata: {"type":"reasoning","text":"CRLF ок"}\r\n\r',
        '\n',
        `event: done\r\ndata: ${JSON.stringify(done)}\r\n\r`,
        '\n'
      ])
    );
    const client = createAgentClient({ apiOrigin: "", fetchImpl: fetchImpl as unknown as typeof fetch });

    const events: AgentStreamEvent[] = [];
    const result = await client.proposeStream("g", (e) => events.push(e));

    expect(events).toEqual([{ type: "reasoning", text: "CRLF ок" }]);
    expect(result).toMatchObject({ goal: "g", reasoning: "Готово.", iterations: 1 });
  });

  it("кидает stream_incomplete, если поток закрылся без done", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      sseResponse(['event: reasoning\ndata: {"type":"reasoning","text":"Начал."}\n\n'])
    );
    const client = createAgentClient({ apiOrigin: "", fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.proposeStream("g", () => {})).rejects.toMatchObject({
      status: 500,
      code: "stream_incomplete",
      body: { error: "stream_incomplete" }
    });
  });
});

describe("agent-client.execute", () => {
  const action = { tool: "comment_task", input: { taskId: "task-1", body: "Готово" } };
  const statusAction = {
    tool: "change_task_status",
    input: { projectId: "project-1", taskId: "task-1", statusId: "review" },
    preconditionVersions: { taskUpdatedAt: "2026-06-01T10:00:00.000Z" }
  };

  it("принимает полный aggregate response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({
      results: [{ tool: "comment_task", ok: true, status: "applied", result: {} }],
      applied: true,
      summary: { applied: 1, skipped: 0, denied: 0, conflict: 0, failed: 0 }
    }));
    const client = createAgentClient({ apiOrigin: "", fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.execute([action])).resolves.toMatchObject({
      applied: true,
      summary: { applied: 1, failed: 0 }
    });
  });

  it("сохраняет актуальную версию задачи при конфликте", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({
      results: [{
        tool: "change_task_status",
        ok: false,
        status: "conflict",
        error: "task_version_conflict",
        currentVersions: { taskUpdatedAt: "2026-06-01T10:00:00.000Z" }
      }],
      applied: false,
      summary: { applied: 0, skipped: 0, denied: 0, conflict: 1, failed: 0 }
    }));
    const client = createAgentClient({ apiOrigin: "", fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.execute([statusAction])).resolves.toMatchObject({
      results: [{
        status: "conflict",
        currentVersions: { taskUpdatedAt: "2026-06-01T10:00:00.000Z" }
      }]
    });
  });

  it("отмечает неполный 2xx response как неопределённый transport outcome", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ results: [] }));
    const client = createAgentClient({ apiOrigin: "", fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.execute([action])).rejects.toMatchObject({
      status: 502,
      code: "invalid_execute_response"
    });

  });
  it("отклоняет aggregate response с противоречивыми counts", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({
      results: [{ tool: "comment_task", ok: true, status: "applied" }],
      applied: true,
      summary: { applied: 0, skipped: 0, denied: 0, conflict: 0, failed: 1 }
    }));
    const client = createAgentClient({ apiOrigin: "", fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.execute([action])).rejects.toMatchObject({
      status: 502,
      code: "invalid_execute_response"
    });
  });

  it("отклоняет aggregate response с противоречивыми ok и status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({
      results: [{ tool: "comment_task", ok: false, status: "applied" }],
      applied: true,
      summary: { applied: 1, skipped: 0, denied: 0, conflict: 0, failed: 0 }
    }));
    const client = createAgentClient({ apiOrigin: "", fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.execute([action])).rejects.toMatchObject({
      status: 502,
      code: "invalid_execute_response"
    });
  });
});

describe("mock-agent-backend optimistic contract", () => {
  it("rejects a stale proposal and applies its captured version", async () => {
    const fetchImpl = createMockAgentFetch();
    const proposalResponse = await fetchImpl("/api/workspace/agent/propose", {
      method: "POST",
      body: JSON.stringify({ goal: "Продвинь задачу" })
    });
    const proposal = await proposalResponse.json() as {
      proposedActions: Array<{
        tool: string;
        title: string;
        input: Record<string, unknown>;
        preconditionVersions: { taskUpdatedAt: string };
      }>;
    };
    const action = proposal.proposedActions[0]!;
    expect(action.title).toBe("Сменить статус задачи: «Согласовать макеты с клиентом» · проект proj-portal, задача task-portal-1");

    const staleResponse = await fetchImpl("/api/workspace/agent/execute", {
      method: "POST",
      body: JSON.stringify({
        actions: [{ ...action, preconditionVersions: { taskUpdatedAt: "2026-05-31T10:00:00.000Z" } }]
      })
    });
    await expect(staleResponse.json()).resolves.toMatchObject({
      results: [{ status: "conflict", currentVersions: action.preconditionVersions }]
    });

    const applyResponse = await fetchImpl("/api/workspace/agent/execute", {
      method: "POST",
      body: JSON.stringify({ actions: [action] })
    });
    await expect(applyResponse.json()).resolves.toMatchObject({
      results: [{ status: "applied", ok: true }],
      summary: { applied: 1, conflict: 0 }
    });
  });
});
