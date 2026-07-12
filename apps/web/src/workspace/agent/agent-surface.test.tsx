/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ACTIVITY_STEPS, HISTORY_ITEMS } from "@/widgets/landing-agent-demo/scenario";
import { AgentSurface } from "./agent-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const agentMock = vi.hoisted(() => ({
  execute: vi.fn(),
  listProjects: vi.fn(),
  proposeStream: vi.fn(),
  uploadAttachment: vi.fn(),
  reloadTools: vi.fn(),
  // Мутируемые поля — тест может переопределить статус/провайдера до рендера.
  status: "idle" as string,
  provider: { configured: true, live: true, model: "test-model" } as unknown,
  toolsError: null as string | null
}));

vi.mock("./use-agent", () => ({
  useAgent: () => ({
    execute: agentMock.execute,
    listProjects: agentMock.listProjects,
    provider: agentMock.provider,
    proposeStream: agentMock.proposeStream,
    status: agentMock.status,
    tools: [],
    toolsError: agentMock.toolsError,
    reloadTools: agentMock.reloadTools,
    uploadAttachment: agentMock.uploadAttachment
  })
}));

function getTextContent(selector: string): string {
  return document.querySelector(selector)?.textContent ?? "";
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function renderAgent(): Promise<Root> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<AgentSurface />);
  });
  return root;
}

async function submitGoal(text: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>("input[aria-label='Сообщение Генри Гантту']");
  expect(input).not.toBeNull();
  await act(async () => {
    setInputValue(input!, text);
  });
  const form = document.querySelector<HTMLFormElement>("[data-testid='agent-composer']");
  await act(async () => {
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("AgentSurface production shell contract", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T13:37:00+07:00"));
    agentMock.status = "idle";
    agentMock.provider = { configured: true, live: true, model: "test-model" };
    agentMock.toolsError = null;
    agentMock.listProjects.mockResolvedValue([]);
    agentMock.proposeStream.mockResolvedValue({
      ok: true,
      data: {
        analyzeResults: [],
        goal: "Проверь проект",
        iterations: 1,
        model: "test-model",
        proposedActions: [],
        reasoning: "Проверил контекст, безопасных действий не нашел."
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    document.body.replaceChildren();
  });

  it("renders no landing demo chrome: no fake nav, no dead history rail", async () => {
    const root = await renderAgent();

    // Навигацией владеет WorkspaceShell (route-уровень) — внутри поверхности nav нет.
    expect(document.querySelector("nav")).toBeNull();
    // Мёртвая колонка «История» удалена вместе с демо-наполнением.
    expect(document.querySelector("[aria-label='История запусков']")).toBeNull();
    for (const demoItem of HISTORY_ITEMS) {
      expect(document.body.textContent).not.toContain(demoItem);
    }

    await act(async () => {
      root.unmount();
    });
  });

  it("shows honest thinking indicator without fabricated demo steps", async () => {
    // proposeStream «висит» — фаза thinking без единого SSE-события.
    agentMock.proposeStream.mockReturnValueOnce(new Promise(() => {}));
    const root = await renderAgent();

    await submitGoal("Проверь проект");

    expect(document.body.textContent).toContain("Генри анализирует запрос…");
    for (const fabricated of ACTIVITY_STEPS) {
      expect(document.body.textContent).not.toContain(fabricated);
    }

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps the completed CoT trace in the thread as a trace message", async () => {
    agentMock.proposeStream.mockImplementationOnce(async (_goal: string, onEvent: (e: unknown) => void) => {
      onEvent({ type: "analyze", tool: "list_tasks", title: "Задачи проекта", ok: true });
      onEvent({ type: "proposal", tool: "comment_task", title: "Добавить комментарий" });
      return {
        ok: true,
        data: {
          analyzeResults: [],
          goal: "Проверь проект",
          iterations: 1,
          model: "test-model",
          proposedActions: [],
          reasoning: "Готово."
        }
      };
    });
    const root = await renderAgent();

    await submitGoal("Проверь проект");

    const log = getTextContent("[role='log']");
    expect(log).toContain("Анализ: Задачи проекта");
    expect(log).toContain("Предложение: Добавить комментарий");
    expect(log).toContain("Готово.");

    await act(async () => {
      root.unmount();
    });
  });

  it("blocks the composer behind a skeleton while capabilities are loading", async () => {
    agentMock.status = "loading";
    const root = await renderAgent();

    expect(document.querySelector("[data-testid='agent-loading']")).not.toBeNull();
    expect(document.querySelector("input[aria-label='Сообщение Генри Гантту']")).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("surfaces listTools failure with a retry affordance", async () => {
    agentMock.toolsError = "request_failed";
    const root = await renderAgent();

    expect(document.body.textContent).toContain("Не удалось загрузить возможности агента (request_failed)");
    const retry = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Повторить");
    expect(retry).toBeDefined();
    await act(async () => {
      retry!.click();
    });
    expect(agentMock.reloadTools).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it("timestamps new messages from the current Date at message creation", async () => {
    const root = await renderAgent();

    await submitGoal("Проверь проект");

    expect(getTextContent("[role='log']")).toContain("13:37");
    expect(getTextContent("[role='log']")).not.toContain("10:41");
    expect(getTextContent("[role='log']")).not.toContain("10:42");

    await act(async () => {
      root.unmount();
    });
  });

  it("does not execute rejected actions", async () => {
    agentMock.proposeStream.mockResolvedValueOnce({
      ok: true,
      data: {
        analyzeResults: [],
        goal: "Проверь проект",
        iterations: 1,
        model: "test-model",
        proposedActions: [
          {
            capability: { allowed: true, reason: "allowed" },
            input: { taskId: "task-1", projectId: "project-1", statusId: "status-review" },
            preview: { before: "В работе", after: "На проверке" },
            title: "Сменить статус задачи: «Проверить смету» · проект project-1, задача task-1",
            tool: "change_task_status"
          },
          {
            capability: { allowed: true, reason: "allowed" },
            input: { taskId: "task-2", projectId: "project-1", statusId: "status-review" },
            preview: { before: "В работе", after: "На проверке" },
            title: "Сменить статус задачи: «Проверить смету» · проект project-1, задача task-2",
            tool: "change_task_status"
          }
        ],
        reasoning: "Подготовил два действия."
      }
    });
    agentMock.execute.mockResolvedValueOnce({
      ok: true,
      data: {
        applied: true,
        results: [{ ok: true, status: "applied", tool: "change_task_status" }],
        summary: { applied: 1, skipped: 0, denied: 0, conflict: 0, failed: 0 }
      }
    });
    const root = await renderAgent();

    await submitGoal("Проверь проект");

    expect(
      Array.from(document.querySelectorAll("[data-testid='agent-change-card'] strong"), (title) => title.textContent)
    ).toEqual([
      "Сменить статус задачи: «Проверить смету» · проект project-1, задача task-1",
      "Сменить статус задачи: «Проверить смету» · проект project-1, задача task-2"
    ]);

    const rejectButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .filter((button) => button.textContent?.trim() === "Отклонить");
    // Desktop-панель (мобильный Sheet закрыт и не смонтирован).
    expect(rejectButtons.length).toBeGreaterThanOrEqual(2);
    await act(async () => {
      rejectButtons[0]!.click();
    });
    const applyButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Применить выбранное"));
    expect(applyButton).toBeDefined();
    await act(async () => {
      applyButton!.click();
    });

    expect(agentMock.execute).toHaveBeenCalledTimes(1);
    expect(agentMock.execute).toHaveBeenCalledWith([
      { tool: "change_task_status", input: { taskId: "task-2", projectId: "project-1", statusId: "status-review" } }
    ]);

    await act(async () => {
      root.unmount();
    });
  });
});
