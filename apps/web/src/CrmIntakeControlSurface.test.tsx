import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CrmIntakeControlSurface } from "./CrmIntakeControlSurface";
import type { CrmIntakeApiClient, FeasibilityBundleDto, OpportunityDto, ProjectDraftDto } from "./crmIntakeApiClient";
import type { CurrentTenantDto } from "./phase2ApiClient";
import { withTestQueryClient } from "./testQueryClient";

const seedOpportunity: OpportunityDto = {
  id: "opportunity-seed-ready",
  tenantId: "tenant-a",
  title: "Внедрение портала АКМЕ",
  stageSystemKey: "qualified",
  accountId: "account-opportunity-seed-ready",
  contactIds: ["contact-opportunity-seed-ready"],
  plannedStartDate: "2026-06-01",
  desiredFinishDate: "2026-06-30",
  expectedValue: { amount: 1500000, currency: "RUB" },
  probability: 0.75,
  categoryKey: "implementation",
  typologyKey: "integration_heavy",
  scopeHints: [
    { key: "integrations_count", label: "Количество интеграций", value: 3 },
    { key: "modules_count", label: "Количество модулей", value: 5 }
  ],
  customFieldRefs: [],
  source: { type: "manual" },
  createdAt: "2026-05-14T20:40:00.000Z"
};

const newOpportunity: OpportunityDto = {
  ...seedOpportunity,
  id: "opportunity-tenant-a-2",
  title: "Внедрение клиентского портала",
  accountId: "account-tenant-a-2",
  contactIds: ["contact-opportunity-tenant-a-2-1"]
};

const feasibilityBundle: FeasibilityBundleDto = {
  correlationId: "corr-feasibility-opportunity-seed-ready",
  templateMatch: {
    matched: true,
    confidence: 0.9,
    template: {
      id: "process-template-integrations-tenant-a",
      key: "implementation.integration_heavy",
      label: "Внедрение с интеграциями",
      version: 2
    },
    blockers: [],
    assumptions: [{ code: "integration_delivery", message: "Учтены интеграционные работы." }]
  },
  demandEstimate: {
    totalPlannedWorkHours: 204,
    scenario: { key: "baseline", label: "Базовый сценарий" },
    formula: { key: "phase3.template_scope_linear", version: 1, label: "Базовая оценка" },
    confidence: 0.84,
    stageRoleDemands: [
      {
        stageKey: "initiation",
        stageLabel: "Инициация",
        roleKey: "project_manager",
        roleLabel: "Руководитель проекта",
        plannedWorkHours: 64
      },
      {
        stageKey: "delivery",
        stageLabel: "Поставка",
        roleKey: "solution_architect",
        roleLabel: "Архитектор решения",
        plannedWorkHours: 140
      }
    ]
  },
  feasibility: {
    tenantId: "tenant-a",
    opportunityId: "opportunity-seed-ready",
    expectedWindow: { startDate: "2026-06-01", endDate: "2026-06-30" },
    status: "fit",
    severity: "none",
    roleResults: [
      {
        roleKey: "project_manager",
        roleLabel: "Руководитель проекта",
        demandedHours: 64,
        capacityHours: 80,
        committedHours: 0,
        conflictingReservedHours: 0,
        availableHours: 80,
        gapHours: 0,
        severity: "none",
        conflictingReservationIds: []
      }
    ],
    blockers: [],
    conflictingReservations: [],
    assumptions: [{ code: "seeded_capacity_window", message: "Seeded capacity." }],
    trace: ["capacity_feasibility:status:fit"]
  }
};

const projectDraft: ProjectDraftDto = {
  id: "project-draft-opportunity-seed-ready",
  tenantId: "tenant-a",
  title: "Внедрение портала АКМЕ",
  status: "draft",
  sourceOpportunity: {
    type: "crm_opportunity",
    opportunityId: "opportunity-seed-ready",
    title: "Внедрение портала АКМЕ",
    accountId: "account-opportunity-seed-ready",
    contactIds: ["contact-opportunity-seed-ready"],
    plannedStartDate: "2026-06-01",
    desiredFinishDate: "2026-06-30"
  },
  processTemplate: {
    templateId: "process-template-integrations-tenant-a",
    key: "implementation.integration_heavy",
    label: "Внедрение с интеграциями",
    version: 2,
    matchConfidence: 0.9,
    assumptions: [{ code: "integration_delivery", message: "Учтены интеграционные работы." }]
  },
  demand: {
    totalPlannedWorkHours: 204,
    scenarioKey: "baseline",
    scenarioLabel: "Базовый сценарий",
    formulaKey: "phase3.template_scope_linear",
    formulaVersion: 1,
    confidence: 0.84,
    stageRoleDemands: []
  },
  feasibility: {
    status: "fit",
    severity: "none",
    expectedWindow: { startDate: "2026-06-01", endDate: "2026-06-30" },
    blockerCodes: []
  },
  createdBy: "project-manager-a",
  createdAt: "2026-05-14T20:40:00.000Z",
  correlationId: "corr-project-draft-opportunity-seed-ready"
};

function createCurrentTenant(permissionOverrides?: string[]): CurrentTenantDto {
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
    permissions:
      permissionOverrides ?? [
        "tenant.read",
        "crm.opportunity.read",
        "crm.opportunity.write",
        "crm.readiness.run",
        "crm.feasibility.run",
        "project_draft.create",
        "project_draft.read",
        "audit.read"
      ]
  };
}

function createApiClient(): CrmIntakeApiClient {
  return {
    listOpportunities: vi.fn(async () => [seedOpportunity]),
    createOpportunity: vi.fn(async () => newOpportunity),
    runReadiness: vi.fn(async () => ({
      correlationId: "corr-readiness-opportunity-seed-ready",
      readiness: {
        ready: true,
        nextAction: "run_feasibility",
        blockers: [],
        trace: ["readiness:ready"]
      }
    })),
    runFeasibility: vi.fn(async () => feasibilityBundle),
    createProjectDraft: vi.fn(async () => ({
      correlationId: "corr-project-draft-opportunity-seed-ready",
      projectDraft,
      actionExecution: {
        id: "action-corr-project-draft-opportunity-seed-ready",
        actorId: "project-manager-a",
        commandType: "project_draft.create_from_opportunity",
        requiredPermission: "project_draft.create",
        status: "succeeded",
        source: { entityType: "opportunity", entityId: "opportunity-seed-ready" },
        target: { entityType: "projectDraft", entityId: projectDraft.id },
        trace: ["action:project_draft:created"]
      }
    })),
    getProjectDraft: vi.fn(async () => {
      throw Object.assign(new Error("Объект не найден"), { code: "not_found" });
    }),
    listOpportunityAuditEvents: vi.fn(async () => [])
  };
}

describe("CRM Intake Control surface", () => {
  it("drives the guided intake loop through real client actions", async () => {
    const apiClient = createApiClient();
    let projectDraftCreated = false;
    vi.mocked(apiClient.listOpportunities).mockResolvedValueOnce([seedOpportunity]).mockResolvedValueOnce([
      seedOpportunity,
      newOpportunity
    ]);
    vi.mocked(apiClient.createProjectDraft).mockImplementationOnce(async () => {
      projectDraftCreated = true;
      return {
        correlationId: "corr-project-draft-opportunity-seed-ready",
        projectDraft,
        actionExecution: {
          id: "action-corr-project-draft-opportunity-seed-ready",
          actorId: "project-manager-a",
          commandType: "project_draft.create_from_opportunity",
          requiredPermission: "project_draft.create",
          status: "succeeded",
          source: { entityType: "opportunity", entityId: "opportunity-seed-ready" },
          target: { entityType: "projectDraft", entityId: projectDraft.id },
          trace: ["action:project_draft:created"]
        }
      };
    });
    vi.mocked(apiClient.listOpportunityAuditEvents).mockImplementation(async () =>
      projectDraftCreated
        ? [
            {
              id: "audit-project-draft",
              tenantId: "tenant-a",
              actorId: "project-manager-a",
              actionKey: "project_draft.create_from_opportunity",
              target: { entityType: "opportunity", entityId: "opportunity-seed-ready" },
              result: "success",
              timestamp: "2026-05-14T20:40:00.000Z",
              correlationId: "corr-project-draft-opportunity-seed-ready"
            }
          ]
        : []
    );

    render(withTestQueryClient(
      <CrmIntakeControlSurface apiClient={apiClient} currentTenant={createCurrentTenant()} testUser="project-manager-a" />
    ));

    expect(await screen.findByTestId("crm-intake-surface")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("opportunity-list")).toHaveTextContent("Внедрение портала АКМЕ");
    });

    fireEvent.click(screen.getByRole("button", { name: "Создать возможность" }));
    await waitFor(() => {
      expect(apiClient.createOpportunity).toHaveBeenCalledWith(
        "project-manager-a",
        expect.objectContaining({
          title: "Внедрение клиентского портала",
          categoryKey: "implementation",
          typologyKey: "integration_heavy"
        })
      );
    });
    expect(await screen.findByTestId("crm-intake-status")).toHaveTextContent("Возможность создана");
    expect(screen.getByTestId("selected-opportunity-title")).toHaveTextContent("Внедрение клиентского портала");

    fireEvent.click(within(screen.getByTestId("opportunity-list")).getByRole("button", { name: /Внедрение портала АКМЕ/ }));
    fireEvent.click(screen.getByRole("button", { name: "Проверить готовность" }));
    await waitFor(() => {
      expect(screen.getByTestId("readiness-next-action")).toHaveTextContent("Запустить оценку реализуемости");
    });
    expect(screen.getByTestId("readiness-blockers")).toHaveTextContent("Блокеров нет");

    fireEvent.click(screen.getByRole("button", { name: "Рассчитать реализуемость" }));
    expect(await screen.findByTestId("feasibility-status")).toHaveTextContent("fit / none");
    expect(screen.getByTestId("demand-summary")).toHaveTextContent("Архитектор решения");
    expect(screen.getByTestId("capacity-summary")).toHaveTextContent("Руководитель проекта");

    fireEvent.click(screen.getByRole("button", { name: "Создать проектный черновик" }));
    expect(await screen.findByTestId("project-draft-result")).toHaveTextContent("project-draft-opportunity-seed-ready");
    await waitFor(() => {
      expect(screen.getByTestId("opportunity-audit-events")).toHaveTextContent("project_draft.create_from_opportunity");
    });
  });

  it("shows readiness blockers for an incomplete opportunity", async () => {
    const apiClient = createApiClient();
    vi.mocked(apiClient.runReadiness).mockResolvedValueOnce({
      correlationId: "corr-readiness-opportunity-seed-ready",
      readiness: {
        ready: false,
        nextAction: "complete_intake",
        blockers: [
          {
            code: "missing_account",
            severity: "warning",
            message: "Укажите клиента или явно отметьте, что клиент пока неизвестен.",
            fieldRefs: ["account"]
          }
        ],
        trace: ["readiness:blocker:missing_account"]
      }
    });

    render(withTestQueryClient(
      <CrmIntakeControlSurface apiClient={apiClient} currentTenant={createCurrentTenant()} testUser="project-manager-a" />
    ));

    await waitFor(() => {
      expect(screen.getByTestId("opportunity-list")).toHaveTextContent("Внедрение портала АКМЕ");
    });
    fireEvent.click(screen.getByRole("button", { name: "Проверить готовность" }));

    expect(await screen.findByTestId("readiness-next-action")).toHaveTextContent("Заполнить недостающие данные");
    expect(screen.getByTestId("readiness-blockers")).toHaveTextContent("missing_account");
  });

  it("proves project-draft denial through the API response instead of hiding the action only", async () => {
    const apiClient = createApiClient();
    vi.mocked(apiClient.createProjectDraft).mockRejectedValueOnce(
      Object.assign(new Error("Доступ запрещен"), { code: "permission_denied" })
    );

    render(withTestQueryClient(
      <CrmIntakeControlSurface
        apiClient={apiClient}
        currentTenant={createCurrentTenant(["tenant.read", "crm.opportunity.read", "project_draft.read"])}
        testUser="readonly-observer-a"
      />
    ));

    await waitFor(() => {
      expect(screen.getByTestId("opportunity-list")).toHaveTextContent("Внедрение портала АКМЕ");
    });
    fireEvent.click(screen.getByRole("button", { name: "Проверить запрет создания черновика" }));

    expect(await screen.findByTestId("crm-intake-status")).toHaveTextContent("Доступ запрещен");
    expect(apiClient.createProjectDraft).toHaveBeenCalledWith("readonly-observer-a", "opportunity-seed-ready");
  });

  it("does not present command response as confirmed audit readback", async () => {
    const apiClient = createApiClient();
    vi.mocked(apiClient.listOpportunityAuditEvents).mockRejectedValue(
      Object.assign(new Error("Доступ запрещен"), { code: "permission_denied" })
    );

    render(withTestQueryClient(
      <CrmIntakeControlSurface apiClient={apiClient} currentTenant={createCurrentTenant()} testUser="project-manager-a" />
    ));

    await waitFor(() => {
      expect(screen.getByTestId("opportunity-list")).toHaveTextContent("Внедрение портала АКМЕ");
    });
    fireEvent.click(screen.getByRole("button", { name: "Создать проектный черновик" }));

    expect(await screen.findByTestId("project-draft-result")).toHaveTextContent("project-draft-opportunity-seed-ready");
    expect(screen.getByTestId("opportunity-audit-events")).toHaveTextContent("Аудит не подтвержден");
    expect(screen.getByTestId("opportunity-audit-events")).not.toHaveTextContent("project_draft.create_from_opportunity");
  });
});
