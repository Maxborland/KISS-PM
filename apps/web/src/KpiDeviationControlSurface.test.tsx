import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KpiDeviationControlSurface } from "./KpiDeviationControlSurface";
import type { CurrentTenantDto } from "./phase2ApiClient";
import type {
  KpiDeviationApiClient,
  KpiDeviationAuditDto,
  KpiEvaluationDto,
  KpiEvaluationRunResultDto,
  KpiSignalDetailDto,
  KpiSignalDto
} from "./kpiDeviationApiClient";
import { withTestQueryClient } from "./testQueryClient";

function createCurrentTenant(
  permissions = ["tenant.read", "kpi:read", "kpi.evaluate:execute", "audit.read"]
): CurrentTenantDto {
  return {
    tenant: {
      id: "tenant-a",
      label: "Студия A",
      configurationVersion: 1
    },
    actor: {
      id: "project-manager-a",
      displayName: "Руководитель проекта",
      accessProfileId: "profile-project-manager-a"
    },
    labels: {},
    permissions
  };
}

function createSignal(id = "signal-kpi-schedule-variance-a"): KpiSignalDto {
  return {
    id,
    tenantId: "tenant-a",
    sourceType: "kpi_evaluation",
    sourceEvaluationId: "eval-kpi-schedule-variance-a-1",
    kpiDefinitionId: "kpi-schedule-variance-a",
    entityType: "project",
    entityId: "project-alpha-a",
    period: { start: "2026-06-01", end: "2026-06-07" },
    severity: "critical",
    explanation: "Критическое отклонение трудозатрат",
    recommendedActionKeys: ["create_corrective_action", "escalate"],
    status: "open",
    actionExecutionState: "not_executed",
    createdAt: "2026-06-08T09:01:00.000Z",
    updatedAt: "2026-06-08T09:01:00.000Z"
  };
}

function createEvaluation(id = "eval-kpi-schedule-variance-a-1"): KpiEvaluationDto {
  return {
    id,
    tenantId: "tenant-a",
    kpiDefinitionId: "kpi-schedule-variance-a",
    kpiDefinitionVersion: 1,
    formulaDefinitionId: "formula-schedule-variance-a-v1",
    formulaVersion: 1,
    thresholdRuleSetId: "threshold-schedule-variance-a-v1",
    thresholdRuleSetVersion: 1,
    entityType: "project",
    entityId: "project-alpha-a",
    period: { start: "2026-06-01", end: "2026-06-07" },
    evaluatedAt: "2026-06-08T09:00:00.000Z",
    value: -25,
    severity: "critical",
    matchedThresholdRuleId: "schedule-variance-critical",
    explanation: "Критическое отклонение трудозатрат",
    recommendedActionKeys: ["create_corrective_action", "escalate"],
    sourceTrace: [
      {
        tenantId: "tenant-a",
        bindingKey: "plannedWorkHours",
        value: 80,
        sourceEntityType: "project",
        sourceEntityId: "project-alpha-a",
        sourceField: "plannedWorkHours",
        observedAt: "2026-06-08T08:00:00.000Z"
      },
      {
        tenantId: "tenant-a",
        bindingKey: "actualWorkHours",
        value: 100,
        sourceEntityType: "project",
        sourceEntityId: "project-alpha-a",
        sourceField: "actualWorkHours",
        observedAt: "2026-06-08T08:00:00.000Z"
      }
    ],
    formulaTrace: ["binding:plannedWorkHours=80", "binding:actualWorkHours=100", "result:-25"],
    thresholdTrace: ["matched:schedule-variance-critical:critical"]
  };
}

function createAudit(): KpiDeviationAuditDto {
  return {
    events: [
      {
        id: "audit-evaluation",
        tenantId: "tenant-a",
        actorId: "project-manager-a",
        actionKey: "kpi.evaluation.run",
        target: { entityType: "project", entityId: "project-alpha-a" },
        result: "success",
        timestamp: "2026-06-08T09:03:00.000Z",
        correlationId: "kpi-evaluation-eval-kpi-schedule-variance-a-2"
      }
    ],
    actionExecutions: [
      {
        id: "action-evaluation",
        tenantId: "tenant-a",
        actorId: "project-manager-a",
        commandType: "kpi.evaluation.run",
        requiredPermission: "kpi.evaluate:execute",
        status: "succeeded",
        source: { entityType: "kpiDefinition", entityId: "kpi-schedule-variance-a" },
        target: { entityType: "project", entityId: "project-alpha-a" },
        before: null,
        after: { evaluation: { id: "eval-kpi-schedule-variance-a-2" } },
        timestamp: "2026-06-08T09:03:00.000Z",
        correlationId: "kpi-evaluation-eval-kpi-schedule-variance-a-2",
        trace: ["kpi_evaluation:permission kpi.evaluate:execute allowed"]
      }
    ]
  };
}

function createApiClient(signals: KpiSignalDto[] = [createSignal()]): KpiDeviationApiClient {
  let currentSignals = [...signals];
  let evaluation = createEvaluation();
  let audit: KpiDeviationAuditDto = { events: [], actionExecutions: [] };

  return {
    listSignals: vi.fn(async () => currentSignals),
    getSignalDetail: vi.fn(async (_testUser: string, signalId: string): Promise<KpiSignalDetailDto> => ({
      signal: currentSignals.find((signal) => signal.id === signalId) ?? createSignal(signalId),
      evaluation
    })),
    runEvaluation: vi.fn(async (): Promise<KpiEvaluationRunResultDto> => {
      evaluation = createEvaluation("eval-kpi-schedule-variance-a-2");
      currentSignals = [createSignal("signal-kpi-schedule-variance-a-2")];
      audit = createAudit();
      return {
        evaluation,
        signal: currentSignals[0],
        actionExecution: audit.actionExecutions[0]
      };
    }),
    getKpiAudit: vi.fn(async () => audit)
  };
}

function renderSurface(apiClient = createApiClient(), currentTenant = createCurrentTenant()) {
  render(
    withTestQueryClient(
      <KpiDeviationControlSurface apiClient={apiClient} currentTenant={currentTenant} testUser="project-manager-a" />
    )
  );
}

describe("KpiDeviationControlSurface", () => {
  it("loads KPI signals and opens the traceable deviation detail", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);

    const signalList = await screen.findByTestId("kpi-deviation-list");
    expect(within(signalList).getByText("Критическая")).toBeInTheDocument();
    expect(screen.getByTestId("kpi-deviation-primary-action")).toHaveTextContent("Открыть путь управления");
    expect(await screen.findByTestId("kpi-deviation-detail")).toHaveTextContent("result:-25");
    expect(screen.getByTestId("kpi-deviation-detail")).toHaveTextContent("plannedWorkHours");
    expect(screen.getByTestId("kpi-deviation-detail")).toHaveTextContent("eval-kpi-schedule-variance-a-1");
    expect(screen.getByTestId("kpi-deviation-detail")).toHaveTextContent("formula-schedule-variance-a-v1@1");
    expect(screen.getByTestId("kpi-deviation-detail")).toHaveTextContent("threshold-schedule-variance-a-v1@1");
    expect(screen.getByTestId("kpi-deviation-detail")).toHaveTextContent("project:project-alpha-a");
    expect(screen.getByTestId("kpi-deviation-detail")).toHaveTextContent("2026-06-08T08:00:00.000Z");
    expect(apiClient.getSignalDetail).toHaveBeenCalledWith("project-manager-a", "signal-kpi-schedule-variance-a");
  });

  it("renders loading, empty, and error states", async () => {
    const emptyClient = createApiClient([]);
    renderSurface(emptyClient);
    expect(await screen.findByTestId("kpi-deviation-empty")).toHaveTextContent("Нет KPI-отклонений");

    const errorClient = createApiClient();
    vi.mocked(errorClient.listSignals).mockRejectedValueOnce(new Error("KPI API недоступен"));
    renderSurface(errorClient);
    expect(await screen.findByTestId("kpi-deviation-error")).toHaveTextContent("KPI API недоступен");
  });

  it("runs governed evaluation, refetches signal detail, and shows audit evidence", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await screen.findByTestId("kpi-deviation-detail");

    fireEvent.click(screen.getByRole("button", { name: "Пересчитать KPI" }));

    await waitFor(() => expect(apiClient.runEvaluation).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(apiClient.listSignals).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId("kpi-deviation-result")).toHaveTextContent("kpi.evaluation.run");
    expect(screen.getByTestId("kpi-deviation-audit")).toHaveTextContent("kpi.evaluation.run");
  });

  it("does not show local command evidence when evaluation readback fails", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient);
    await screen.findByTestId("kpi-deviation-detail");
    vi.mocked(apiClient.listSignals).mockRejectedValueOnce(new Error("Readback недоступен"));

    fireEvent.click(screen.getByRole("button", { name: "Пересчитать KPI" }));

    expect(await screen.findByTestId("kpi-deviation-command-error")).toHaveTextContent("Readback недоступен");
    expect(screen.getByTestId("kpi-deviation-result")).toHaveTextContent("Команда еще не выполнялась");
  });

  it("does not show command evidence when audit readback misses the action execution", async () => {
    const apiClient = createApiClient();
    vi.mocked(apiClient.getKpiAudit).mockResolvedValue({ events: [], actionExecutions: [] });
    renderSurface(apiClient);
    await screen.findByTestId("kpi-deviation-detail");

    fireEvent.click(screen.getByRole("button", { name: "Пересчитать KPI" }));

    expect(await screen.findByTestId("kpi-deviation-command-error")).toHaveTextContent("audit/readback");
    expect(screen.getByTestId("kpi-deviation-result")).toHaveTextContent("Команда еще не выполнялась");
  });

  it("shows read-only permission state and does not run evaluation", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient, createCurrentTenant(["tenant.read", "kpi:read", "audit.read"]));
    await screen.findByTestId("kpi-deviation-detail");

    expect(screen.getByTestId("kpi-deviation-readonly")).toHaveTextContent("Пересчет недоступен");
    expect(screen.queryByRole("button", { name: "Пересчитать KPI" })).not.toBeInTheDocument();
    expect(apiClient.runEvaluation).not.toHaveBeenCalled();
  });

  it("does not run evaluation evidence flow without audit.read permission", async () => {
    const apiClient = createApiClient();
    renderSurface(apiClient, createCurrentTenant(["tenant.read", "kpi:read", "kpi.evaluate:execute"]));
    await screen.findByTestId("kpi-deviation-detail");

    fireEvent.click(screen.getByRole("button", { name: "Пересчитать KPI" }));

    expect(await screen.findByTestId("kpi-deviation-command-error")).toHaveTextContent("Аудит недоступен");
    expect(screen.getByTestId("kpi-deviation-result")).toHaveTextContent("Команда еще не выполнялась");
    expect(screen.getByTestId("kpi-deviation-audit")).toHaveTextContent("Аудит недоступен");
  });

  it("denies users without KPI read permission", () => {
    renderSurface(createApiClient(), createCurrentTenant(["tenant.read"]));

    expect(screen.getByTestId("kpi-deviation-denied")).toHaveTextContent("Нет доступа к KPI");
  });
});
