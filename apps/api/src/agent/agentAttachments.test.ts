import { describe, expect, it, vi } from "vitest";

import type { AgentTool } from "./toolRegistry";
import { runAgentLoop } from "./agentLoop";
import type { LlmMessage, LlmProvider } from "./llmProvider";
import { resolveAttachments } from "./agentRoutes";
import type { ApiApp } from "../routeTypes";

// Провайдер, фиксирующий первое сообщение пользователя (для проверки инъекции вложений).
function capturingProvider(): { provider: LlmProvider; firstUserContent: () => string } {
  let captured = "";
  return {
    firstUserContent: () => captured,
    provider: {
      model: "capture",
      createMessage(input: { messages: LlmMessage[] }) {
        const first = input.messages[0];
        if (typeof first?.content === "string" && captured === "") captured = first.content;
        return Promise.resolve({ stopReason: "end_turn", content: [{ type: "text", text: "ок" }] });
      }
    } as LlmProvider
  };
}

describe("agent attachments", () => {
  it("runAgentLoop инжектит приложенные файлы в первое сообщение как контекст", async () => {
    const { provider, firstUserContent } = capturingProvider();
    await runAgentLoop({
      provider,
      system: "s",
      goal: "Сделай выжимку",
      tools: [] as AgentTool[],
      executeAnalyze: vi.fn(),
      attachments: [{ name: "brief.md", content: "# Бриф\nСроки сжатые." }]
    });
    const content = firstUserContent();
    expect(content).toContain("Сделай выжимку");
    expect(content).toContain("brief.md");
    expect(content).toContain("Сроки сжатые");
    expect(content).toContain("не инструкции"); // помечено как данные, а не команды
  });

  it("resolveAttachments тянет текст через download-роут, фильтрует бинарь, режет размер", async () => {
    const responses: Record<string, Response> = {
      "text-1": new Response("содержимое спеки", { status: 200, headers: { "content-type": "text/markdown", "content-disposition": 'attachment; filename="spec.md"' } }),
      "bin-1": new Response("PNGDATA", { status: 200, headers: { "content-type": "image/png", "content-disposition": 'attachment; filename="pic.png"' } }),
      "missing": new Response(JSON.stringify({ error: "attachment_not_found" }), { status: 404, headers: { "content-type": "application/json" } })
    };
    const app = {
      request: (path: string) => {
        const id = /attachments\/([^/]+)\/download/.exec(path)?.[1] ?? "";
        return Promise.resolve(responses[id] ?? new Response("", { status: 404 }));
      }
    } as unknown as ApiApp;

    const result = await resolveAttachments(app, "kiss_pm_session=x", ["text-1", "bin-1", "missing"]);
    expect(result).toHaveLength(2); // missing (404) пропущен
    expect(result[0]).toEqual({ name: "spec.md", content: "содержимое спеки" });
    expect(result[1]!.name).toBe("pic.png");
    expect(result[1]!.content).toContain("нетекстовый файл"); // бинарь не извлекаем, но помечаем
  });

  it("имя с литеральным % не роняет батч (review #3); крупный файл обрезается (review #5)", async () => {
    const responses: Record<string, Response> = {
      "pct": new Response("план", { status: 200, headers: { "content-type": "text/plain", "content-disposition": 'attachment; filename="100% plan.md"' } }),
      "big": new Response("x".repeat(60_000), { status: 200, headers: { "content-type": "text/markdown", "content-disposition": 'attachment; filename="big.md"' } })
    };
    const app = {
      request: (path: string) => {
        const id = /attachments\/([^/]+)\/download/.exec(path)?.[1] ?? "";
        return Promise.resolve(responses[id] ?? new Response("", { status: 404 }));
      }
    } as unknown as ApiApp;

    const result = await resolveAttachments(app, null, ["pct", "big"]);
    // #3: имя «100% plan.md» извлечено без падения decodeURIComponent
    expect(result[0]).toEqual({ name: "100% plan.md", content: "план" });
    // #5: контент обрезан до остатка бюджета (50k - 4 на «план»)
    expect(result[1]!.name).toBe("big.md");
    expect(result[1]!.content.length).toBeLessThanOrEqual(50_000);
    expect(result[1]!.content.length).toBeGreaterThan(40_000);
  });
});
