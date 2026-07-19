// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectControl } from "./control-surface";

let permissions: string[] = [];

const READ_PERMISSIONS = [
  "tenant.project_plan.read",
  "tenant.kpi_definitions.read",
  "tenant.control_signals.read"
];
const RETRO_PERMISSIONS = ["tenant.projects.read", "tenant.retrospectives.read"];

const CANDIDATE_WITH_DELTA = {
  id: "act-1",
  type: "apply_planning_delta",
  label: "Применить сценарий balanced",
  targetEntity: { type: "ControlSignal", id: "sig-1" },
  requiredPermissions: ["tenant.project_plan.manage"],
  planDelta: {
    commands: [{ type: "task.update_schedule", payload: { taskId: "t-1" } }],
    changedTaskIds: ["t-1"],
    changedAssignmentIds: [],
    changedDependencyIds: []
  },
  input: {},
  explainability: {
    reason: "Сценарий balanced для перегруза",
    deadlineDeltaDays: -2,
    overloadMinutes: 60,
    changedTaskIds: ["t-1"],
    changedAssignmentIds: [],
    riskScore: 30,
    cost: 1
  }
};

const CANDIDATE_WITHOUT_DELTA = {
  ...CANDIDATE_WITH_DELTA,
  id: "act-2",
  type: "create_corrective_action",
  label: "Создать корректирующее действие",
  requiredPermissions: [],
  planDelta: null
};

const SIGNAL = {
  id: "sig-1",
  tenantId: "tenant",
  projectId: "project",
  sourceEntity: { type: "Project", id: "project" },
  sourceMetric: "deadline_delta_days",
  evaluationId: "kpi-eval-1",
  severity: "critical",
  explanation: "Расчётный финиш превышает дедлайн на 3 дня",
  ownerUserId: null,
  allowedActions: ["apply_planning_delta", "create_corrective_action"],
  scenarioProposals: [CANDIDATE_WITH_DELTA, CANDIDATE_WITHOUT_DELTA],
  status: "open",
  createdAt: "2026-07-10T00:00:00.000Z",
  updatedAt: "2026-07-10T00:00:00.000Z"
};

const READ_MODEL = {
  definitions: [
    {
      id: "kpi-1",
      tenantId: "tenant",
      entityType: "project",
      code: "project.deadline_delta_days",
      label: "Сдвиг срока проекта",
      formula: { type: "builtin", key: "deadline_delta_days" },
      unit: "days",
      period: "snapshot",
      thresholdRules: [],
      ownerRole: null,
      allowedActions: [],
      version: 1,
      status: "active"
    }
  ],
  evaluations: [
    {
      id: "kpi-eval-1",
      tenantId: "tenant",
      projectId: "project",
      definitionId: "kpi-1",
      definitionVersion: 1,
      formulaVersion: 1,
      sourceData: {},
      periodStart: null,
      periodEnd: null,
      threshold: null,
      calculatedValue: 3,
      severity: "critical",
      evaluatedAt: "2026-07-10T00:00:00.000Z"
    }
  ],
  signals: [SIGNAL],
  correctiveActions: [],
  actionExecutions: []
};

const evaluate = vi.fn(async () => ({ ok: true as const, data: { evaluations: [], signals: [], actionCandidates: [], auditEventId: "audit-eval" } }));
const previewAction = vi.fn(async () => ({
  ok: true as const,
  data: {
    action: CANDIDATE_WITH_DELTA,
    execution: { id: "action-exec-1", actionType: "apply_planning_delta", targetEntity: { type: "ControlSignal", id: "sig-1" }, actorUserId: "user", status: "previewed", auditEventId: "audit-preview" },
    auditEventId: "audit-preview"
  }
}));
const applyAction = vi.fn();
const setSignalStatus = vi.fn();
const createCorrectiveAction = vi.fn();
const loadRetrospective = vi.fn();
const controlReload = vi.fn();

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock("@/shell/use-session-user", () => ({
  useSessionUser: () => ({ id: "user", name: "Test User", permissions })
}));

vi.mock("@/delivery/lib/use-control", () => ({
  useControl: () => ({
    readModel: READ_MODEL,
    status: "ready",
    error: null,
    reload: controlReload,
    retrospective: { status: "ready", view: { snapshot: null, lessons: [], templateImprovementActions: [] } },
    loadRetrospective,
    evaluate,
    previewAction,
    applyAction,
    setSignalStatus,
    createCorrectiveAction
  })
}));

vi.mock("@/delivery/lib/use-planning", () => ({
  usePlanning: () => ({
    readModel: { planVersion: 7, project: {}, calculatedPlan: {} },
    status: "ready",
    error: null,
    reload: vi.fn()
  })
}));

vi.mock("@/delivery/lib/project-chrome", () => ({
  PROJECT_FALLBACK: {},
  deriveProjectMeta: () => ({}),
  useProjectBase: () => ({ name: "Project", code: "PRJ" })
}));

vi.mock("@/delivery/ui/delivery-frame", () => ({
  DeliveryFrame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>
}));

describe("control surface permission gates", () => {
  beforeEach(() => {
    permissions = [];
    evaluate.mockClear();
    previewAction.mockClear();
    applyAction.mockClear();
    setSignalStatus.mockClear();
    createCorrectiveAction.mockClear();
    loadRetrospective.mockClear();
  });

  it("shows forbidden state without the read permissions", async () => {
    const denied = await renderSurface([]);
    expect(denied.host.textContent).toContain("Нет доступа к контуру управления");
    expect(denied.host.textContent).not.toContain("Сигналы (");
    await denied.unmount();

    // Частичного чтения недостаточно: read-model требует все три права.
    const partial = await renderSurface(["tenant.control_signals.read"]);
    expect(partial.host.textContent).toContain("Нет доступа к контуру управления");
    await partial.unmount();
  });

  it("renders KPI and signals read-only without mutation controls", async () => {
    const readOnly = await renderSurface(READ_PERMISSIONS);
    expect(readOnly.host.querySelectorAll('[data-testid="control-kpi-card"]')).toHaveLength(1);
    expect(readOnly.host.textContent).toContain("Сдвиг срока проекта");
    expect(readOnly.host.querySelectorAll('[data-testid="control-signal-card"]')).toHaveLength(1);
    expect(readOnly.host.textContent).toContain("Расчётный финиш превышает дедлайн на 3 дня");
    expect(button(readOnly.host, "Пересчитать показатели")).toBeUndefined();
    expect(button(readOnly.host, "Взять в работу")).toBeUndefined();
    expect(button(readOnly.host, "Корректирующее действие")).toBeUndefined();
    // Ретроспектива скрыта без retrospectives.read
    expect(readOnly.host.querySelector('[data-testid="control-retrospective"]')).toBeNull();
    expect(loadRetrospective).not.toHaveBeenCalled();

    // Кандидаты раскрываются, но без права исполнения предпросмотра нет.
    await act(async () => {
      button(readOnly.host, "Действия (2)")?.click();
    });
    expect(readOnly.host.querySelectorAll('[data-testid="control-action-candidate"]')).toHaveLength(2);
    expect(button(readOnly.host, "Предпросмотр")).toBeUndefined();
    await readOnly.unmount();
  });

  it("gates signal status and evaluate behind control_signals.manage", async () => {
    const manager = await renderSurface([...READ_PERMISSIONS, "tenant.control_signals.manage"]);
    expect(button(manager.host, "Пересчитать показатели")).toBeDefined();
    expect(button(manager.host, "Взять в работу")).toBeDefined();
    expect(button(manager.host, "Решён")).toBeDefined();
    expect(button(manager.host, "Предпросмотр")).toBeUndefined();
    await manager.unmount();
  });

  it("runs preview → apply flow with management_actions.execute", async () => {
    const executor = await renderSurface([...READ_PERMISSIONS, "tenant.management_actions.execute"]);
    expect(button(executor.host, "Пересчитать показатели")).toBeUndefined();

    await act(async () => {
      button(executor.host, "Действия (2)")?.click();
    });
    const previewButtons = [...executor.host.querySelectorAll("button")].filter(
      (candidate) => candidate.textContent?.trim() === "Предпросмотр"
    );
    // Предпросмотр есть только у кандидата с planDelta; второй помечен «без изменений плана».
    expect(previewButtons).toHaveLength(1);
    expect(executor.host.textContent).toContain("без изменений плана");

    await act(async () => {
      previewButtons[0]?.click();
    });
    expect(previewAction).toHaveBeenCalledWith("sig-1", "act-1");
    expect(executor.host.querySelector('[data-testid="control-action-preview"]')).not.toBeNull();
    expect(executor.host.textContent).toContain("audit-preview");
    // Применение — отдельная кнопка с подтверждением, доступна после предпросмотра.
    expect(button(executor.host, "Применить")).toBeDefined();
    expect(applyAction).not.toHaveBeenCalled();
    await executor.unmount();
  });

  it("gates corrective action creation and shows retrospective section with read rights", async () => {
    const corrective = await renderSurface([
      ...READ_PERMISSIONS,
      ...RETRO_PERMISSIONS,
      "tenant.corrective_actions.manage"
    ]);
    expect(button(corrective.host, "Корректирующее действие")).toBeDefined();
    expect(corrective.host.querySelector('[data-testid="control-retrospective"]')).not.toBeNull();
    expect(corrective.host.textContent).toContain("Проект ещё не закрыт");
    expect(loadRetrospective).toHaveBeenCalledTimes(1);
    await corrective.unmount();
  });
});

async function renderSurface(nextPermissions: string[]) {
  permissions = nextPermissions;
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => {
    root.render(<ProjectControl projectId="project" />);
    await Promise.resolve();
    await Promise.resolve();
  });
  return {
    host,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
    }
  };
}

function button(host: HTMLElement, label: string) {
  return [...host.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === label
  );
}
