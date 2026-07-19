// @vitest-environment happy-dom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectScenarios } from "./scenarios-surface";

let permissions: string[] = [];
const SOLVER_PERMISSIONS = ["tenant.project_plan.manage", "tenant.project_resources.manage"];

const solverProposals = [
  {
    id: "proposal-1",
    mode: "schedule",
    kind: "no_overlap",
    conflictEffect: "removed",
    label: "Resolve without overlap",
    planDelta: {
      commands: [
        {
          type: "assignment.upsert",
          payload: { id: "asg-1", taskId: "task-1", resourceId: "res-2", workMinutes: 480, role: "executor" }
        }
      ],
      changedTaskIds: ["task-1"],
      changedAssignmentIds: ["asg-1"],
      acceptedRiskIds: []
    },
    explainability: {
      finishDate: "2026-07-20",
      deadlineDeltaDays: 0,
      overloadMinutes: 0,
      overloadedResourceIds: [],
      changedTaskIds: ["task-1"],
      changedAssignmentIds: ["asg-1"],
      requiredApprovals: [],
      riskScore: 10,
      cost: { deadlineMissDays: 0, finishDateRank: 0, overloadMinutes: 0, changedTaskCount: 1, changedAssignmentCount: 1, riskScore: 10 }
    }
  },
  {
    id: "proposal-2",
    mode: "schedule",
    kind: "accepted_overload",
    conflictEffect: "accepted_overload",
    label: "Accept controlled overload",
    planDelta: {
      commands: [
        {
          type: "risk.accept_overload",
          payload: { overloadId: "res-1:2026-07-10", acceptedRiskReason: "solver" }
        }
      ],
      changedTaskIds: [],
      changedAssignmentIds: [],
      acceptedRiskIds: ["res-1:2026-07-10"]
    },
    explainability: {
      finishDate: "2026-07-18",
      deadlineDeltaDays: 0,
      overloadMinutes: 120,
      overloadedResourceIds: ["res-1"],
      changedTaskIds: [],
      changedAssignmentIds: [],
      requiredApprovals: [],
      riskScore: 80,
      cost: { deadlineMissDays: 0, finishDateRank: 1, overloadMinutes: 120, changedTaskCount: 0, changedAssignmentCount: 0, riskScore: 80 }
    }
  }
];

const runAutoSolver = vi.fn(async () => ({
  ok: true as const,
  runId: "planning-auto-solver-run-1",
  proposals: solverProposals,
  planVersion: 7,
  // далёкое будущее: клиентский TTL-таймер не должен гасить кнопки в тесте
  expiresAt: "2099-01-01T00:00:00.000Z"
}));
const applySolverProposal = vi.fn(async () => ({
  ok: true as const,
  planVersion: 8,
  auditEventId: "audit-8"
}));
const reload = vi.fn();

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// SSE-подписка плана: в юнитах не открываем EventSource (happy-dom полез бы в сеть) — noop-подписка
vi.mock("@kiss-pm/planning-client", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  subscribeToPlanEvents: () => ({ unsubscribe() {} })
}));

vi.mock("@/shell/use-session-user", () => ({
  useSessionUser: () => ({ id: "user", name: "Test User", permissions })
}));

vi.mock("@/delivery/lib/use-planning", () => ({
  usePlanning: () => ({
    readModel: {
      project: { deadline: "2026-07-25", plannedStart: "2026-07-06" },
      authored: { tasks: [], assignments: [] },
      calculatedPlan: { projectFinish: "2026-07-21", criticalPathTaskIds: [] },
      resourceLoad: { overloads: [], acceptedOverloads: [] },
      planVersion: 7
    },
    status: "ready",
    error: null,
    reload,
    previewScenarios: vi.fn(),
    applyScenario: vi.fn(),
    rejectScenario: vi.fn(),
    previewBatch: vi.fn(),
    runAutoSolver,
    applySolverProposal
  })
}));

vi.mock("@/delivery/lib/project-chrome", () => ({
  PROJECT_FALLBACK: {},
  deriveProjectMeta: () => ({}),
  planningErr: (value: string) => value,
  useProjectBase: () => ({ name: "Project", code: "PRJ" })
}));

vi.mock("@/delivery/lib/use-resource-directory", () => ({
  useResourceDirectory: () => ({ name: () => "Resource One" })
}));

vi.mock("@/delivery/ui/delivery-frame", () => ({
  DeliveryFrame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>
}));

describe("scenarios auto-solver source", () => {
  beforeEach(() => {
    permissions = [...SOLVER_PERMISSIONS];
    runAutoSolver.mockClear();
    applySolverProposal.mockClear();
    reload.mockClear();
    applySolverProposal.mockResolvedValue({ ok: true as const, planVersion: 8, auditEventId: "audit-8" });
  });

  it("hides the run control without plan+resources manage permissions", async () => {
    permissions = [];
    const view = await renderSurface();
    expect(view.host.querySelector('[data-testid="solver-section"]')).not.toBeNull();
    expect(button(view.host, "Рассчитать")).toBeUndefined();
    expect(view.host.textContent).toContain("Недостаточно прав для запуска авто-солвера");
    expect(runAutoSolver).not.toHaveBeenCalled();
    await view.unmount();
  });

  it("creates a persisted run and renders solver proposal cards with delta", async () => {
    const view = await renderSurface();
    expect(view.host.querySelector('[data-testid="solver-idle"]')).not.toBeNull();
    await act(async () => { button(view.host, "Рассчитать")?.click(); });

    expect(runAutoSolver).toHaveBeenCalledTimes(1);
    expect(runAutoSolver).toHaveBeenCalledWith("schedule");
    expect(view.host.querySelector('[data-testid="solver-card-proposal-1"]')).not.toBeNull();
    expect(view.host.querySelector('[data-testid="solver-card-proposal-2"]')).not.toBeNull();
    expect(view.host.querySelector('[data-testid="solver-ttl"]')).not.toBeNull();
    expect(view.host.textContent).toContain("Без перегрузов");
    expect(view.host.textContent).toContain("С принятием перегруза");
    // дельта плана из planDelta.commands
    expect(view.host.textContent).toContain("Изменения (1)");
    expect(button(view.host, "Рассчитать заново")).toBeDefined();
    await view.unmount();
  });

  it("applies a proposal happy-path: apply-роут run + квитанция + сброс run", async () => {
    const view = await renderSurface();
    await act(async () => { button(view.host, "Рассчитать")?.click(); });
    const card = view.host.querySelector('[data-testid="solver-card-proposal-1"]') as HTMLElement;
    await act(async () => { button(card, "Применить")?.click(); });

    expect(applySolverProposal).toHaveBeenCalledTimes(1);
    expect(applySolverProposal).toHaveBeenCalledWith("planning-auto-solver-run-1", "proposal-1", undefined);
    // квитанция применения с auditEventId и сброс предложений (run одноразовый)
    expect(view.host.textContent).toContain("Применено предложение авто-солвера «Без перегрузов» — коммит v8.");
    expect(view.host.textContent).toContain("audit-8");
    expect(view.host.querySelector('[data-testid="solver-card-proposal-1"]')).toBeNull();
    expect(view.host.querySelector('[data-testid="solver-idle"]')).not.toBeNull();
    await view.unmount();
  });

  it("requires accepted-risk reason before applying an accepted_overload proposal", async () => {
    const view = await renderSurface();
    await act(async () => { button(view.host, "Рассчитать")?.click(); });
    const card = view.host.querySelector('[data-testid="solver-card-proposal-2"]') as HTMLElement;
    await act(async () => { button(card, "Применить")?.click(); });

    expect(applySolverProposal).not.toHaveBeenCalled();
    expect(view.host.textContent).toContain("Укажите причину принятия риска");

    const input = card.querySelector("input") as HTMLInputElement;
    await act(async () => {
      setNativeInputValue(input, "согласовано с РП");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { button(card, "Применить")?.click(); });
    expect(applySolverProposal).toHaveBeenCalledWith("planning-auto-solver-run-1", "proposal-2", "согласовано с РП");
    await view.unmount();
  });

  it("shows an honest conflict message and resets the run on plan_version_conflict", async () => {
    applySolverProposal.mockResolvedValueOnce({
      ok: false as const,
      conflict: true,
      code: "plan_version_conflict",
      message: "План уже изменился. Данные обновлены, повторите действие"
    } as never);
    const view = await renderSurface();
    await act(async () => { button(view.host, "Рассчитать")?.click(); });
    const card = view.host.querySelector('[data-testid="solver-card-proposal-1"]') as HTMLElement;
    await act(async () => { button(card, "Применить")?.click(); });

    const errorBox = view.host.querySelector('[data-testid="solver-error"]');
    expect(errorBox?.textContent).toContain("Конфликт версий — данные обновлены, рассчитайте заново");
    // run сброшен — карточек больше нет, можно пересчитать
    expect(view.host.querySelector('[data-testid="solver-card-proposal-1"]')).toBeNull();
    expect(view.host.querySelector('[data-testid="solver-idle"]')).not.toBeNull();
    await view.unmount();
  });

  it("resets the run on stale 409 solver codes (already applied)", async () => {
    applySolverProposal.mockResolvedValueOnce({
      ok: false as const,
      conflict: false,
      code: "planning_solver_run_already_applied",
      message: "Это предложение авто-солвера уже применено. Данные обновлены"
    } as never);
    const view = await renderSurface();
    await act(async () => { button(view.host, "Рассчитать")?.click(); });
    const card = view.host.querySelector('[data-testid="solver-card-proposal-1"]') as HTMLElement;
    await act(async () => { button(card, "Применить")?.click(); });

    expect(reload).toHaveBeenCalledTimes(1);
    const errorBox = view.host.querySelector('[data-testid="solver-error"]');
    expect(errorBox?.textContent).toContain("уже применено");
    expect(view.host.querySelector('[data-testid="solver-card-proposal-1"]')).toBeNull();
    await view.unmount();
  });
});

async function renderSurface() {
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () => {
    root.render(<ProjectScenarios projectId="project" />);
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

// controlled input: пишем через нативный сеттер, чтобы React увидел изменение значения
function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
}
