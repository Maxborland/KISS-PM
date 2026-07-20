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

  it("квитирует реплику и очищает composer при ненастроенном LLM-провайдере", async () => {
    // Новый контракт (P1): 503 приходит от СЕРВЕРА, который персистит реплику и
    // квитанцию (переживают reload); клиент квитирует по коду ошибки и принимает
    // серверные id для дедупликации при последующей гидрации.
    agentMock.provider = { configured: false, live: false, model: "mock-provider" };
    agentMock.proposeStream.mockResolvedValueOnce({
      ok: false,
      code: "agent_provider_not_configured",
      persisted: { threadId: "agent-thread-user-1", messageIds: ["message-server-1", "message-server-2"] }
    });
    const root = await renderAgent();

    await submitGoal("Проверь проект");

    const input = document.querySelector<HTMLInputElement>("input[aria-label='Сообщение Генри Гантту']");
    expect(input?.value).toBe("");
    expect(getTextContent("[role='log']")).toContain("Проверь проект");
    expect(getTextContent("[role='log']")).toContain("LLM-провайдер не настроен");
    expect(agentMock.proposeStream).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(input);

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

    // Сырой код ошибки не попадает в текст страницы (гейт shell-role-nav
    // запрещает литералы вроде permission_missing) — только в title.
    expect(document.body.textContent).toContain("Не удалось загрузить возможности агента");
    expect(document.body.textContent).not.toContain("request_failed");
    expect(document.querySelector("[role='alert']")?.getAttribute("title")).toBe("request_failed");
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

    // Время рендерится toLocaleTimeString в таймзоне раннера (локально +07 это
    // «13:37», в CI/UTC — «06:37») — ожидание считаем тем же форматтером,
    // а не литералом, иначе тест падает в любой другой таймзоне.
    const expectedTime = new Date("2026-07-07T13:37:00+07:00").toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit"
    });
    expect(getTextContent("[role='log']")).toContain(expectedTime);
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
        summary: { applied: 1, denied: 0, conflict: 0, failed: 0 }
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

  // ── Ревью F2: ручная правка правит ПОЛЕ, а не отрисованную сводку превью ──
  // Раньше редактор засевался из preview.after (у create_task это сводная фраза
  // «Название» · проект … · 8 ч · приоритет: normal · исполнитель: вы, ~116 символов —
  // под лимитом 160), и она уходила в input.title целиком: задача молча создавалась
  // с именем-предложением.
  const CREATE_TASK_SUFFIX = "» · проект «Стройка» · 2026-07-20 → 2026-07-24 · 8 ч · приоритет: normal · исполнитель: вы";

  function createTaskProposal() {
    return {
      ok: true,
      data: {
        analyzeResults: [],
        goal: "Заведи задачу",
        iterations: 1,
        model: "test-model",
        proposedActions: [
          {
            capability: { allowed: true, reason: "allowed" },
            input: { title: "Согласовать смету", projectId: "project-1", plannedWork: 8 },
            preview: {
              before: "Задачи не существует",
              after: `«Согласовать смету${CREATE_TASK_SUFFIX}`,
              editable: {
                field: "title",
                label: "Название задачи",
                value: "Согласовать смету",
                prefix: "«",
                suffix: CREATE_TASK_SUFFIX
              }
            },
            title: "Создать задачу: «Согласовать смету» · проект «Стройка»",
            tool: "create_task"
          }
        ],
        reasoning: "Одно действие."
      }
    };
  }

  async function editFirstCard(value: string): Promise<void> {
    const editButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Изменить");
    expect(editButton).toBeDefined();
    await act(async () => {
      editButton!.click();
    });
    const textarea = document.querySelector<HTMLTextAreaElement>("[data-testid='agent-change-card'] textarea");
    expect(textarea).not.toBeNull();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(textarea!, value);
      textarea!.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it("правка create_task меняет input.title, а не всю сводку превью", async () => {
    agentMock.proposeStream.mockResolvedValueOnce(createTaskProposal());
    agentMock.execute.mockResolvedValueOnce({
      ok: true,
      data: { applied: true, results: [{ ok: true, status: "applied", tool: "create_task" }], summary: { applied: 1, denied: 0, conflict: 0, failed: 0 } }
    });
    const root = await renderAgent();

    await submitGoal("Заведи задачу");

    // Редактор засеян СЫРЫМ названием, а не сводной фразой превью.
    const editButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Изменить");
    await act(async () => {
      editButton!.click();
    });
    expect(document.querySelector<HTMLTextAreaElement>("[data-testid='agent-change-card'] textarea")?.value)
      .toBe("Согласовать смету");

    await editFirstCard("Согласовать смету с заказчиком");

    const textarea = document.querySelector<HTMLTextAreaElement>("[data-testid='agent-change-card'] textarea");
    expect(textarea!.value).toBe("Согласовать смету с заказчиком");
    // Превью пересобрано и остаётся честным: изменилось только название.
    expect(document.querySelector("[data-testid='agent-change-card']")?.textContent)
      .toContain(`«Согласовать смету с заказчиком${CREATE_TASK_SUFFIX}`);

    const applyButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Применить"));
    await act(async () => {
      applyButton!.click();
    });

    expect(agentMock.execute).toHaveBeenCalledWith([
      { tool: "create_task", input: { title: "Согласовать смету с заказчиком", projectId: "project-1", plannedWork: 8 } }
    ]);
    // Ключевая регрессия: в title не уходит сводка превью.
    const sentTitle = (agentMock.execute.mock.calls[0]![0] as Array<{ input: { title: string } }>)[0]!.input.title;
    expect(sentTitle).not.toContain("приоритет");
    expect(sentTitle).not.toContain("·");

    await act(async () => {
      root.unmount();
    });
  });

  it("правка comment_task меняет input.body (после = сырое тело, без сводки)", async () => {
    agentMock.proposeStream.mockResolvedValueOnce({
      ok: true,
      data: {
        analyzeResults: [],
        goal: "Прокомментируй задачу",
        iterations: 1,
        model: "test-model",
        proposedActions: [
          {
            capability: { allowed: true, reason: "allowed" },
            input: { taskId: "task-1", body: "Смета уточнена." },
            preview: {
              before: "Комментариев: 2",
              after: "Смета уточнена.",
              editable: { field: "body", label: "Текст комментария", value: "Смета уточнена.", prefix: "", suffix: "" }
            },
            title: "Прокомментировать задачу: «Смета» · проект project-1, задача task-1",
            tool: "comment_task"
          }
        ],
        reasoning: "Одно действие."
      }
    });
    agentMock.execute.mockResolvedValueOnce({
      ok: true,
      data: { applied: true, results: [{ ok: true, status: "applied", tool: "comment_task" }], summary: { applied: 1, denied: 0, conflict: 0, failed: 0 } }
    });
    const root = await renderAgent();

    await submitGoal("Прокомментируй задачу");
    await editFirstCard("Смета уточнена, жду подтверждения заказчика.");

    const applyButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Применить"));
    await act(async () => {
      applyButton!.click();
    });

    expect(agentMock.execute).toHaveBeenCalledWith([
      { tool: "comment_task", input: { taskId: "task-1", body: "Смета уточнена, жду подтверждения заказчика." } }
    ]);

    await act(async () => {
      root.unmount();
    });
  });

  it("действие без объявленного сервером редактируемого поля правку не открывает", async () => {
    agentMock.proposeStream.mockResolvedValueOnce({
      ok: true,
      data: {
        analyzeResults: [],
        goal: "Смени статус",
        iterations: 1,
        model: "test-model",
        proposedActions: [
          {
            capability: { allowed: true, reason: "allowed" },
            input: { taskId: "task-1", projectId: "project-1", statusId: "status-review" },
            // preview.editable отсутствует — структурное действие правке не подлежит.
            preview: { before: "В работе", after: "На проверке" },
            title: "Сменить статус задачи: task-1",
            tool: "change_task_status"
          }
        ],
        reasoning: "Одно действие."
      }
    });
    const root = await renderAgent();

    await submitGoal("Смени статус");
    const editButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Изменить");
    await act(async () => {
      editButton!.click();
    });

    expect(document.querySelector("[data-testid='agent-change-card'] textarea")).toBeNull();
    expect(document.body.textContent).toContain("нельзя отредактировать вручную");

    await act(async () => {
      root.unmount();
    });
  });

  it("не преселектит доменную mutation с пустым diff — apply не уходит вслепую", async () => {
    agentMock.proposeStream.mockResolvedValueOnce({
      ok: true,
      data: {
        analyzeResults: [],
        goal: "Заведи клиента и обнови задачу",
        iterations: 1,
        model: "test-model",
        proposedActions: [
          {
            capability: { allowed: true, reason: "allowed" },
            input: { taskId: "task-1", projectId: "project-1", statusId: "status-review" },
            preview: { before: "В работе", after: "На проверке" },
            title: "Сменить статус задачи: task-1",
            tool: "change_task_status"
          },
          {
            // Пустой «после» — честный diff не отрисован: карточка не должна преселектиться.
            capability: { allowed: true, reason: "allowed" },
            input: { fields: { name: "Acme" } },
            preview: { before: "Текущее значение определяется целевым маршрутом", after: "" },
            title: "Создать клиента: Acme",
            tool: "create_crm_client"
          }
        ],
        reasoning: "Два действия."
      }
    });
    agentMock.execute.mockResolvedValueOnce({
      ok: true,
      data: {
        applied: true,
        results: [{ ok: true, status: "applied", tool: "change_task_status" }],
        summary: { applied: 1, denied: 0, conflict: 0, failed: 0 }
      }
    });
    const root = await renderAgent();

    await submitGoal("Заведи клиента и обнови задачу");

    const applyButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Применить выбранное"));
    expect(applyButton).toBeDefined();
    await act(async () => {
      applyButton!.click();
    });

    // Уходит только действие с честным diff; mutation с пустым «после» осталась невыбранной.
    expect(agentMock.execute).toHaveBeenCalledTimes(1);
    expect(agentMock.execute).toHaveBeenCalledWith([
      { tool: "change_task_status", input: { taskId: "task-1", projectId: "project-1", statusId: "status-review" } }
    ]);

    await act(async () => {
      root.unmount();
    });
  });
});
