/**
 * @vitest-environment happy-dom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ClosureClient,
  ClosurePreviewResult,
  ClosureReadState
} from "@/delivery/lib/closure-client";

import {
  CLOSURE_CLOSE_PERMISSIONS,
  CLOSURE_READ_PERMISSIONS,
  ProjectClosureSection
} from "./project-closure-section";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let permissions: string[] = [];

vi.mock("@/shell/use-session-user", () => ({
  useSessionUser: () => ({ id: "user-1", name: "Test User", permissions })
}));

const planFactSummary = {
  planVersion: 4,
  plannedStart: "2026-07-01",
  plannedFinish: "2026-07-31",
  actualStart: "2026-07-01",
  actualFinish: null,
  plannedWorkMinutes: 4800,
  actualWorkMinutes: 5400,
  workVarianceMinutes: 600,
  scheduleVarianceDays: 3,
  taskCount: 10,
  completedTaskCount: 8,
  openTaskCount: 2,
  baselineId: null
};

const activeState: ClosureReadState = {
  project: { id: "project-1", title: "Проект", status: "active", templateId: null, closedAt: null },
  snapshot: null,
  lessons: [],
  templateImprovementActions: []
};

const previewResult: ClosurePreviewResult = {
  canClose: true,
  projectStatus: "active",
  planFactSummary,
  proposedTemplateImprovement: null
};

const closedSnapshot = {
  id: "closure-1",
  projectId: "project-1",
  projectStatusBefore: "active",
  planVersion: 4,
  planFactSummary,
  closedByUserId: "user-1",
  closedAt: "2026-07-19T10:00:00.000Z",
  closeReason: "работы завершены",
  auditEventId: "audit-1"
};

function createMockClient(): ClosureClient {
  return {
    getClosure: vi.fn(async () => activeState),
    previewClosure: vi.fn(async () => previewResult),
    closeProject: vi.fn(async () => ({
      projectId: "project-1",
      snapshot: closedSnapshot,
      lessons: [],
      templateImprovementActions: [],
      auditEventId: "audit-1"
    })),
    addLesson: vi.fn(async () => ({
      lesson: {
        id: "lesson-1",
        tenantId: "tenant",
        projectId: "project-1",
        snapshotId: "closure-1",
        category: "process" as const,
        title: "Урок",
        body: "Текст",
        impact: "neutral" as const,
        createdByUserId: "user-1",
        createdAt: "2026-07-19T10:05:00.000Z"
      },
      auditEventId: "audit-2"
    })),
    applyTemplateImprovement: vi.fn(async () => ({
      action: {
        id: "improvement-1",
        tenantId: "tenant",
        projectId: "project-1",
        snapshotId: "closure-1",
        templateId: "template-1",
        status: "applied" as const,
        title: "Улучшение",
        description: "Описание",
        impact: { plannedWorkDeltaMinutes: 0, plannedDurationDeltaDays: 0, confidence: "medium" as const, sourceMetric: "estimation" },
        createdByUserId: "user-1",
        appliedByUserId: "user-1",
        createdAt: "2026-07-19T10:05:00.000Z",
        appliedAt: "2026-07-19T10:06:00.000Z",
        auditEventId: "audit-3"
      },
      auditEventId: "audit-3"
    })),
    getTemplateInsights: vi.fn(async () => ({
      templateId: "template-1",
      appliedImprovements: [],
      estimationLearning: { appliedActionCount: 0, plannedWorkDeltaMinutes: 0, plannedDurationDeltaDays: 0 }
    }))
  };
}

let root: Root;
let container: HTMLDivElement;

async function render(client: ClosureClient) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<ProjectClosureSection projectId="project-1" client={client} />);
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("ProjectClosureSection", () => {
  beforeEach(() => {
    permissions = [];
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("без права чтения показывает честную заглушку и не ходит на сервер", async () => {
    const client = createMockClient();
    await render(client);
    expect(container.querySelector('[data-testid="closure-forbidden"]')).not.toBeNull();
    expect(client.getClosure).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="closure-prepare"]')).toBeNull();
  });

  it("с правом чтения без права закрытия показывает статус, но не кнопку закрытия", async () => {
    permissions = [...CLOSURE_READ_PERMISSIONS];
    const client = createMockClient();
    await render(client);
    expect(container.querySelector('[data-testid="closure-open"]')).not.toBeNull();
    expect(container.textContent).toContain("Активен");
    expect(container.querySelector('[data-testid="closure-prepare"]')).toBeNull();
    expect(container.querySelector('[data-testid="closure-no-close-rights"]')).not.toBeNull();
  });

  it("happy-path: подготовить закрытие → preview → причина → закрыть → секция «Закрыт»", async () => {
    permissions = [...CLOSURE_READ_PERMISSIONS, ...CLOSURE_CLOSE_PERMISSIONS];
    const client = createMockClient();
    await render(client);

    const prepare = container.querySelector<HTMLButtonElement>('[data-testid="closure-prepare"]');
    expect(prepare).not.toBeNull();
    await act(async () => {
      prepare!.click();
    });

    expect(client.previewClosure).toHaveBeenCalledWith("project-1");
    expect(container.querySelector('[data-testid="closure-preview"]')).not.toBeNull();
    expect(container.textContent).toContain("открыто 2");
    expect(container.textContent).toContain("8 из 10");

    const confirm = container.querySelector<HTMLButtonElement>('[data-testid="closure-confirm"]');
    expect(confirm).not.toBeNull();
    // Без причины подтверждение заблокировано
    expect(confirm!.disabled).toBe(true);

    const reason = container.querySelector<HTMLInputElement>('[data-testid="closure-reason"]');
    expect(reason).not.toBeNull();
    await act(async () => {
      setInputValue(reason!, "работы завершены");
    });
    const confirmEnabled = container.querySelector<HTMLButtonElement>('[data-testid="closure-confirm"]');
    expect(confirmEnabled!.disabled).toBe(false);

    await act(async () => {
      confirmEnabled!.click();
    });

    expect(client.closeProject).toHaveBeenCalledWith("project-1", {
      closeReason: "работы завершены",
      lessons: []
    });
    expect(container.querySelector('[data-testid="closure-closed"]')).not.toBeNull();
    expect(container.textContent).toContain("Закрыт");
    expect(container.textContent).toContain("19.07.2026");
    expect(container.textContent).toContain("работы завершены");
    // Кнопки подготовки закрытия больше нет
    expect(container.querySelector('[data-testid="closure-prepare"]')).toBeNull();
  });

  it("у закрытого проекта показывает уроки и добавляет новый через форму", async () => {
    permissions = [...CLOSURE_READ_PERMISSIONS, ...CLOSURE_CLOSE_PERMISSIONS];
    const client = createMockClient();
    (client.getClosure as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...activeState,
      project: { ...activeState.project, status: "closed", closedAt: "2026-07-19T10:00:00.000Z" },
      snapshot: closedSnapshot
    });
    await render(client);

    expect(container.querySelector('[data-testid="closure-closed"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="lessons-empty"]')).not.toBeNull();

    const addButton = container.querySelector<HTMLButtonElement>('[data-testid="lesson-add"]');
    await act(async () => {
      addButton!.click();
    });
    const title = container.querySelector<HTMLInputElement>('[data-testid="lesson-title"]');
    const body = container.querySelector<HTMLTextAreaElement>('[data-testid="lesson-body"]');
    await act(async () => {
      setInputValue(title!, "Урок");
      const bodySetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      bodySetter?.call(body!, "Текст");
      body!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const submit = container.querySelector<HTMLButtonElement>('[data-testid="lesson-submit"]');
    expect(submit!.disabled).toBe(false);
    await act(async () => {
      submit!.click();
    });

    expect(client.addLesson).toHaveBeenCalledWith("project-1", {
      category: "process",
      title: "Урок",
      body: "Текст",
      impact: "neutral"
    });
    expect(container.querySelector('[data-testid="lesson-lesson-1"]')).not.toBeNull();
    expect(container.textContent).toContain("Процесс");
  });
});
