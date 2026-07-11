import { describe, expect, it, vi } from "vitest";

import { runAgentLoop } from "./agentLoop";
import { createMockLlmProvider, type LlmResponse } from "./llmProvider";
import { findAgentTool } from "./toolRegistry";

const listMyTasks = findAgentTool("list_my_tasks")!;
const changeStatus = findAgentTool("change_task_status")!;

describe("runAgentLoop", () => {
  it("исполняет analyze вживую, mutation записывает как предложение (не применяет), завершается", async () => {
    const script: LlmResponse[] = [
      { stopReason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "list_my_tasks", input: {} }] },
      { stopReason: "tool_use", content: [{ type: "tool_use", id: "t2", name: "change_task_status", input: { projectId: "p1", taskId: "task-1", statusId: "status-review" } }] },
      { stopReason: "end_turn", content: [{ type: "text", text: "Предлагаю продвинуть задачу task-1." }] }
    ];
    const executeAnalyze = vi.fn().mockResolvedValue({ tasks: [{ id: "task-1", title: "Тест", statusId: "status-in-progress" }] });

    const result = await runAgentLoop({
      provider: createMockLlmProvider(script),
      system: "test",
      goal: "Продвинь мои задачи",
      tools: [listMyTasks, changeStatus],
      executeAnalyze
    });

    // analyze исполнен ровно один раз (live)
    expect(executeAnalyze).toHaveBeenCalledTimes(1);
    expect(executeAnalyze).toHaveBeenCalledWith(listMyTasks, {});
    expect(result.analyzeResults).toHaveLength(1);
    expect(result.analyzeResults[0]!.tool).toBe("list_my_tasks");

    // mutation записан как предложение, НЕ применён
    expect(result.proposedActions).toHaveLength(1);
    expect(result.proposedActions[0]).toMatchObject({ tool: "change_task_status", input: { taskId: "task-1", statusId: "status-review" } });

    expect(result.reasoning).toContain("task-1");
    expect(result.iterations).toBe(3);
  });

  it("неизвестный/недоступный инструмент → tool_result error, не падает", async () => {
    const script: LlmResponse[] = [
      { stopReason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "forbidden_tool", input: {} }] },
      { stopReason: "end_turn", content: [{ type: "text", text: "Ок." }] }
    ];
    const result = await runAgentLoop({
      provider: createMockLlmProvider(script),
      system: "test",
      goal: "тест",
      tools: [listMyTasks], // forbidden_tool НЕ в наборе
      executeAnalyze: vi.fn()
    });
    expect(result.proposedActions).toHaveLength(0);
    expect(result.analyzeResults).toHaveLength(0);
  });

  it("без tool_use сразу завершается (только текст)", async () => {
    const result = await runAgentLoop({
      provider: createMockLlmProvider([{ stopReason: "end_turn", content: [{ type: "text", text: "Нет безопасных действий." }] }]),
      system: "test",
      goal: "тест",
      tools: [listMyTasks, changeStatus],
      executeAnalyze: vi.fn()
    });
    expect(result.iterations).toBe(1);
    expect(result.proposedActions).toHaveLength(0);
    expect(result.reasoning).toContain("Нет безопасных действий");
    expect(result.stopReason).toBe("completed");
  });
  it("заменяет словесное подтверждение действий без tool_use на безопасный fallback", async () => {
    const result = await runAgentLoop({
      provider: createMockLlmProvider([
        {
          stopReason: "end_turn",
          content: [{ type: "text", text: "Предлагаю создать две задачи. Подтвердите действие 1 и действие 2." }]
        }
      ]),
      system: "test",
      goal: "создай задачи",
      tools: [changeStatus],
      executeAnalyze: vi.fn()
    });

    expect(result.proposedActions).toHaveLength(0);
    expect(result.reasoning).toContain("не сформировал применимых действий");
    expect(result.reasoning).not.toContain("Подтвердите действие");
  });


  it("останавливается по токен-бюджету (stopReason=token_budget)", async () => {
    // Каждый ответ зовёт analyze (цикл продолжается) + тратит 600 токенов; бюджет 1000 → стоп после 2-го.
    const loop: LlmResponse = {
      stopReason: "tool_use",
      content: [{ type: "tool_use", id: "t", name: "list_my_tasks", input: {} }],
      usage: { inputTokens: 0, outputTokens: 600 }
    };
    const result = await runAgentLoop({
      provider: createMockLlmProvider([loop]),
      system: "test",
      goal: "тест",
      tools: [listMyTasks],
      executeAnalyze: vi.fn().mockResolvedValue({ tasks: [] }),
      limits: { maxTotalOutputTokens: 1000, maxIterations: 50 }
    });
    expect(result.stopReason).toBe("token_budget");
    expect(result.outputTokens).toBeGreaterThanOrEqual(1000);
    expect(result.iterations).toBeLessThan(50);
  });

  it("сохраняет предложение из ответа, превысившего бюджет токенов", async () => {
    // Ответ с mutation-предложением сразу выбивает бюджет; предложение должно сохраниться,
    // а остановка случиться на следующей итерации (запись proposal не требует нового вызова LLM).
    const script: LlmResponse[] = [
      { stopReason: "tool_use", content: [{ type: "tool_use", id: "m", name: "change_task_status", input: { projectId: "p", taskId: "t", statusId: "status-review" } }], usage: { inputTokens: 0, outputTokens: 2000 } },
      { stopReason: "end_turn", content: [{ type: "text", text: "done" }] }
    ];
    const result = await runAgentLoop({
      provider: createMockLlmProvider(script),
      system: "s",
      goal: "g",
      tools: [changeStatus],
      executeAnalyze: vi.fn(),
      limits: { maxTotalOutputTokens: 1000, maxIterations: 50 }
    });
    expect(result.proposedActions).toHaveLength(1);
    expect(result.proposedActions[0]!.tool).toBe("change_task_status");
    expect(result.stopReason).toBe("token_budget");
  });

  it("останавливается по дедлайну (stopReason=deadline)", async () => {
    let t = 0;
    const result = await runAgentLoop({
      provider: createMockLlmProvider([{ stopReason: "tool_use", content: [{ type: "tool_use", id: "t", name: "list_my_tasks", input: {} }] }]),
      system: "test",
      goal: "тест",
      tools: [listMyTasks],
      executeAnalyze: vi.fn().mockResolvedValue({ tasks: [] }),
      limits: { timeoutMs: 100, maxIterations: 50 },
      now: () => (t += 60) // 0,60,120… → дедлайн 100 пройден на 2-й проверке
    });
    expect(result.stopReason).toBe("deadline");
    expect(result.iterations).toBeLessThan(50);
  });

  it("память чата: history идёт ПЕРЕД текущей целью в сообщениях LLM", async () => {
    let seen: Array<{ role: string; content: unknown }> = [];
    const provider = {
      model: "capture",
      createMessage(input: { messages: Array<{ role: string; content: unknown }> }) {
        if (seen.length === 0) seen = [...input.messages];
        return Promise.resolve({ stopReason: "end_turn" as const, content: [{ type: "text" as const, text: "ок" }] });
      }
    };
    await runAgentLoop({
      provider,
      system: "s",
      goal: "теперь то же для проекта Б",
      tools: [],
      executeAnalyze: vi.fn(),
      history: [
        { role: "user", content: "продвинь задачи проекта А" },
        { role: "assistant", content: "Продвинул А." }
      ]
    });
    expect(seen.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(seen[0]!.content).toBe("продвинь задачи проекта А");
    expect(seen[2]!.content).toBe("теперь то же для проекта Б");
  });

  it("эмитит CoT-события onEvent в порядке: reasoning → analyze → proposal", async () => {
    const script: LlmResponse[] = [
      { stopReason: "tool_use", content: [{ type: "text", text: "Смотрю задачи." }, { type: "tool_use", id: "t1", name: "list_my_tasks", input: {} }] },
      { stopReason: "tool_use", content: [{ type: "tool_use", id: "t2", name: "change_task_status", input: { projectId: "p1", taskId: "task-1", statusId: "status-review" } }] },
      { stopReason: "end_turn", content: [{ type: "text", text: "Готово." }] }
    ];
    const events: string[] = [];
    await runAgentLoop({
      provider: createMockLlmProvider(script),
      system: "test",
      goal: "тест",
      tools: [listMyTasks, changeStatus],
      executeAnalyze: vi.fn().mockResolvedValue({ tasks: [{ id: "task-1" }] }),
      onEvent: (e) => { events.push(`${e.type}:${e.type === "reasoning" ? e.text : e.tool}`); }
    });
    expect(events).toEqual([
      "reasoning:Смотрю задачи.",
      "analyze:list_my_tasks",
      "proposal:change_task_status",
      "reasoning:Готово."
    ]);
  });

  it("останавливается по максимуму итераций (stopReason=max_iterations)", async () => {
    const result = await runAgentLoop({
      provider: createMockLlmProvider([{ stopReason: "tool_use", content: [{ type: "tool_use", id: "t", name: "list_my_tasks", input: {} }] }]),
      system: "test",
      goal: "тест",
      tools: [listMyTasks],
      executeAnalyze: vi.fn().mockResolvedValue({ tasks: [] }),
      limits: { maxIterations: 3 }
    });
    expect(result.stopReason).toBe("max_iterations");
    expect(result.iterations).toBe(3);
  });
});
