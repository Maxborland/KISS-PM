/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HISTORY_ITEMS } from "@/widgets/landing-agent-demo/scenario";
import { AgentSurface } from "./agent-surface";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const agentMock = vi.hoisted(() => ({
  execute: vi.fn(),
  listProjects: vi.fn(),
  proposeStream: vi.fn(),
  uploadAttachment: vi.fn()
}));

vi.mock("./use-agent", () => ({
  useAgent: () => ({
    execute: agentMock.execute,
    listProjects: agentMock.listProjects,
    provider: { configured: true, live: true, model: "test-model" },
    proposeStream: agentMock.proposeStream,
    status: "idle",
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

describe("AgentSurface production shell contract", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T13:37:00+07:00"));
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

  it("does not render landing demo history as product history", async () => {
    const root = await renderAgent();

    const historyText = getTextContent(".lad-history");
    for (const demoItem of HISTORY_ITEMS) {
      expect(historyText).not.toContain(demoItem);
    }
    expect(document.querySelectorAll(".lad-history button")).toHaveLength(0);

    await act(async () => {
      root.unmount();
    });
  });

  it("renders mini navigation as real product links, not inert demo buttons", async () => {
    const root = await renderAgent();

    const nav = document.querySelector("nav[aria-label='Навигация приложения']");
    expect(nav).not.toBeNull();
    const links = Array.from(nav?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? []);
    expect(links.map((link) => [link.textContent?.trim(), link.getAttribute("href")])).toEqual([
      ["Агент", "/agent"],
      ["Проекты", "/projects"],
      ["Мои задачи", "/my-work"],
      ["Дашборд", "/dashboard"],
      ["Коммуникации", "/communications/chat"],
      ["Администрирование", "/admin"]
    ]);
    const fakeNavigationButtons = Array.from(nav?.querySelectorAll("button") ?? []).filter(
      (button) => button.classList.contains("lad-app-nav__item")
    );
    expect(fakeNavigationButtons).toHaveLength(0);

    await act(async () => {
      root.unmount();
    });
  });

  it("timestamps new messages from the current Date at message creation", async () => {
    const root = await renderAgent();

    const input = document.querySelector<HTMLInputElement>("input[aria-label='Сообщение Генри Гантту']");
    expect(input).not.toBeNull();
    await act(async () => {
      setInputValue(input!, "Проверь проект");
    });
    const form = document.querySelector<HTMLFormElement>(".lad-composer");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(getTextContent(".lad-chat__body")).toContain("13:37");
    expect(getTextContent(".lad-chat__body")).not.toContain("10:41");
    expect(getTextContent(".lad-chat__body")).not.toContain("10:42");

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
            title: "Перевести задачу 1",
            tool: "change_task_status"
          },
          {
            capability: { allowed: true, reason: "allowed" },
            input: { taskId: "task-2", projectId: "project-1", statusId: "status-review" },
            preview: { before: "В работе", after: "На проверке" },
            title: "Перевести задачу 2",
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

    const input = document.querySelector<HTMLInputElement>("input[aria-label='Сообщение Генри Гантту']");
    expect(input).not.toBeNull();
    await act(async () => {
      setInputValue(input!, "Проверь проект");
    });
    const form = document.querySelector<HTMLFormElement>(".lad-composer");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    const rejectButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .filter((button) => button.textContent?.trim() === "Отклонить");
    expect(rejectButtons).toHaveLength(2);
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
