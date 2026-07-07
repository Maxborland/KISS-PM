import { describe, expect, it, vi } from "vitest";

import { createAgentClient, type AgentStreamEvent } from "./agent-client";

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
        'event: reasoning\r\ndata: {"type":"reasoning","text":"CRLF ок"}\r\n\r\n',
        `event: done\r\ndata: ${JSON.stringify(done)}\r\n\r\n`
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
