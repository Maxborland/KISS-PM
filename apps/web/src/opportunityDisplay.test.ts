import { describe, expect, test } from "vitest";

import type { DealStage, Opportunity } from "./api";
import {
  buildOpportunityKanbanCardViewModel,
  buildKanbanStages,
  canMoveOpportunityToStage,
  formatOpportunityEconomics,
  getOpportunityClientLabel,
  getOpportunityContactLabel,
  getOpportunityProjectTypeLabel,
  getOpportunityStageMoveBlocker,
  getOpportunityStageOptions
} from "./opportunityDisplay";
import type { WorkspaceData } from "./workspaceData";

const baseOpportunity: Opportunity = {
  id: "deal-1",
  tenantId: "tenant-1",
  clientId: "client-1",
  primaryContactId: "contact-1",
  projectTypeId: "project-type-1",
  stageId: "stage-archived",
  clientName: "Старый клиент",
  contactName: "Старый контакт",
  title: "Сделка",
  projectType: "Старый тип",
  description: null,
  plannedStart: "2026-06-01",
  plannedFinish: "2026-06-30",
  contractValue: 1_000_000,
  plannedHourlyRate: 5_000,
  plannedHours: 200,
  probability: 50,
  status: "intake",
  templateId: null,
  feasibilityStatus: null,
  feasibilityResult: null,
  feasibilityCheckedAt: null,
  createdAt: "2026-05-19T00:00:00.000Z",
  updatedAt: "2026-05-19T00:00:00.000Z",
  demand: [],
  customFieldValues: {}
};

const stages: DealStage[] = [
  {
    id: "stage-active",
    tenantId: "tenant-1",
    name: "Новый",
    sortOrder: 10,
    status: "active",
    createdAt: "2026-05-19T00:00:00.000Z",
    updatedAt: "2026-05-19T00:00:00.000Z"
  },
  {
    id: "stage-archived",
    tenantId: "tenant-1",
    name: "Архивный этап",
    sortOrder: 20,
    status: "archived",
    createdAt: "2026-05-19T00:00:00.000Z",
    updatedAt: "2026-05-19T00:00:00.000Z"
  },
  {
    id: "stage-unused-archived",
    tenantId: "tenant-1",
    name: "Старый архив",
    sortOrder: 30,
    status: "archived",
    createdAt: "2026-05-19T00:00:00.000Z",
    updatedAt: "2026-05-19T00:00:00.000Z"
  }
];

const data = {
  clients: [
    {
      id: "client-1",
      tenantId: "tenant-1",
      name: "Обновленный клиент",
      description: null,
      status: "active",
      createdAt: "2026-05-19T00:00:00.000Z",
      updatedAt: "2026-05-19T00:00:00.000Z"
    }
  ],
  contacts: [
    {
      id: "contact-1",
      tenantId: "tenant-1",
      clientId: "client-1",
      name: "Обновленный контакт",
      email: "updated@example.test",
      phone: null,
      telegram: null,
      role: null,
      status: "active",
      createdAt: "2026-05-19T00:00:00.000Z",
      updatedAt: "2026-05-19T00:00:00.000Z"
    }
  ],
  projectTypes: [
    {
      id: "project-type-1",
      tenantId: "tenant-1",
      name: "Обновленный тип",
      description: null,
      status: "active",
      createdAt: "2026-05-19T00:00:00.000Z",
      updatedAt: "2026-05-19T00:00:00.000Z"
    }
  ],
  positions: [
    {
      id: "position-engineer",
      tenantId: "tenant-1",
      name: "Инженер",
      description: null,
      status: "active",
      createdAt: "2026-05-19T00:00:00.000Z",
      updatedAt: "2026-05-19T00:00:00.000Z"
    }
  ]
} as unknown as WorkspaceData;

describe("opportunity display helpers", () => {
  test("resolves current reference labels instead of stale opportunity snapshots", () => {
    expect(getOpportunityClientLabel(data, baseOpportunity)).toBe("Обновленный клиент");
    expect(getOpportunityContactLabel(data, baseOpportunity)).toBe(
      "Обновленный контакт · updated@example.test"
    );
    expect(getOpportunityProjectTypeLabel(data, baseOpportunity)).toBe("Обновленный тип");
  });

  test("keeps referenced archived stages visible in Kanban without exposing unrelated archived stages", () => {
    const kanbanStages = buildKanbanStages(stages, [baseOpportunity]);

    expect(kanbanStages.map((stage) => stage.id)).toEqual([
      "stage-active",
      "stage-archived"
    ]);
  });

  test("limits stage select options to active stages plus the opportunity current archived stage", () => {
    expect(getOpportunityStageOptions(stages, baseOpportunity).map((stage) => stage.id)).toEqual([
      "stage-active",
      "stage-archived"
    ]);
    expect(
      getOpportunityStageOptions(stages, {
        ...baseOpportunity,
        id: "deal-2",
        stageId: "stage-active"
      }).map((stage) => stage.id)
    ).toEqual(["stage-active"]);
  });

  test("formats deal economics as separate value, hourly norm and required hours", () => {
    expect(formatOpportunityEconomics(baseOpportunity)).toEqual({
      contractValueLabel: "1 000 000 ₽",
      plannedHourlyRateLabel: "5 000 ₽/ч",
      plannedHoursLabel: "200 ч"
    });
  });

  test("builds a CRM-rich Kanban card view model from deal references and intake facts", () => {
    expect(
      buildOpportunityKanbanCardViewModel(data, {
        ...baseOpportunity,
        demand: [{ positionId: "position-engineer", requiredHours: 120 }],
        feasibilityStatus: "warning",
        plannedStart: "2026-07-01",
        plannedFinish: "2026-07-31"
      })
    ).toEqual({
      clientLabel: "Обновленный клиент",
      contactLabel: "Обновленный контакт · updated@example.test",
      contractValueLabel: "1 000 000 ₽",
      demandLabel: "Инженер: 120 ч",
      feasibilityLabel: "Есть предупреждения",
      feasibilityTone: "muted",
      periodLabel: "01.07.2026 -> 31.07.2026",
      plannedHourlyRateLabel: "5 000 ₽/ч",
      plannedHoursLabel: "200 ч"
    });
  });

  test("allows moving a non-final opportunity to an active target stage", () => {
    expect(
      canMoveOpportunityToStage({
        canManageOpportunities: true,
        dealStages: stages,
        isPending: false,
        opportunity: baseOpportunity,
        targetStageId: "stage-active"
      })
    ).toBe(true);
  });

  test("explains why stage movement is disabled", () => {
    expect(
      getOpportunityStageMoveBlocker({
        canManageOpportunities: false,
        dealStages: stages,
        isPending: false,
        opportunity: baseOpportunity,
        targetStageId: "stage-active"
      })
    ).toBe("Нужно право tenant.opportunities.manage");

    expect(
      getOpportunityStageMoveBlocker({
        canManageOpportunities: true,
        dealStages: stages,
        isPending: true,
        opportunity: baseOpportunity,
        targetStageId: "stage-active"
      })
    ).toBe("Дождитесь завершения текущего действия");

    expect(
      getOpportunityStageMoveBlocker({
        canManageOpportunities: true,
        dealStages: stages,
        isPending: false,
        opportunity: { ...baseOpportunity, status: "won_closed" },
        targetStageId: "stage-active"
      })
    ).toBe("Этап завершенной сделки нельзя менять");

    expect(
      getOpportunityStageMoveBlocker({
        canManageOpportunities: true,
        dealStages: stages,
        isPending: false,
        opportunity: baseOpportunity,
        targetStageId: "stage-unused-archived"
      })
    ).toBe("Переносить можно только в активный этап");

    expect(
      getOpportunityStageMoveBlocker({
        canManageOpportunities: true,
        dealStages: stages,
        isPending: false,
        opportunity: baseOpportunity,
        targetStageId: "stage-archived"
      })
    ).toBe("Сделка уже на этом этапе");
  });
});
