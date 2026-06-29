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
  });
});
