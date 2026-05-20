import type { DealStage, Opportunity } from "./api";
import type { WorkspaceData } from "./workspaceData";

type OpportunityReferenceData = Pick<
  WorkspaceData,
  "clients" | "contacts" | "positions" | "projectTypes"
>;

export function getOpportunityClientLabel(
  data: OpportunityReferenceData,
  opportunity: Opportunity
): string {
  return (
    data.clients.find((client) => client.id === opportunity.clientId)?.name ??
    opportunity.clientName ??
    "Клиент не задан"
  );
}

export function getOpportunityContactLabel(
  data: OpportunityReferenceData,
  opportunity: Opportunity
): string {
  const contact = data.contacts.find((item) => item.id === opportunity.primaryContactId);
  if (!contact) return opportunity.contactName || "Контакт не задан";

  return [contact.name, contact.email, contact.phone].filter(Boolean).join(" · ");
}

export function getOpportunityRelationshipLabel(
  data: OpportunityReferenceData,
  opportunity: Opportunity
): string {
  const clientLabel = getOpportunityClientLabel(data, opportunity);
  const hasContact = Boolean(opportunity.primaryContactId || opportunity.contactName);
  if (!hasContact) return clientLabel;

  return `${clientLabel} · ${getOpportunityContactLabel(data, opportunity)}`;
}

export function getOpportunityProjectTypeLabel(
  data: OpportunityReferenceData,
  opportunity: Opportunity
): string {
  return (
    data.projectTypes.find((item) => item.id === opportunity.projectTypeId)?.name ??
    opportunity.projectType
  );
}

export function buildKanbanStages(
  dealStages: DealStage[],
  opportunities: Opportunity[]
): DealStage[] {
  const referencedStageIds = new Set(
    opportunities
      .map((opportunity) => opportunity.stageId)
      .filter((stageId): stageId is string => Boolean(stageId))
  );

  return sortDealStages(
    dealStages.filter(
      (stage) => stage.status === "active" || referencedStageIds.has(stage.id)
    )
  );
}

export function getOpportunityStageOptions(
  dealStages: DealStage[],
  opportunity: Opportunity
): DealStage[] {
  return sortDealStages(
    dealStages.filter(
      (stage) => stage.status === "active" || stage.id === opportunity.stageId
    )
  );
}

export type OpportunityStageTimelineItem = {
  id: string;
  isArchived: boolean;
  isCurrent: boolean;
  isReached: boolean;
  label: string;
};

export function buildOpportunityStageTimeline(
  dealStages: DealStage[],
  opportunity: Opportunity
): OpportunityStageTimelineItem[] {
  const stages = getOpportunityStageOptions(dealStages, opportunity);
  const currentIndex = stages.findIndex((stage) => stage.id === opportunity.stageId);
  const reachedIndex = currentIndex === -1 ? 0 : currentIndex;

  return stages.map((stage, index) => ({
    id: stage.id,
    isArchived: stage.status === "archived",
    isCurrent: stage.id === opportunity.stageId,
    isReached: index <= reachedIndex,
    label: stage.status === "archived" ? `${stage.name} · архив` : stage.name
  }));
}

export type OpportunityStageMoveCheck = {
  canManageOpportunities: boolean;
  dealStages: DealStage[];
  isPending: boolean;
  opportunity: Opportunity;
  targetStageId: string;
};

export function canMoveOpportunityToStage(input: OpportunityStageMoveCheck): boolean {
  return getOpportunityStageMoveBlocker(input) === null;
}

export function getOpportunityStageMoveBlocker(
  input: OpportunityStageMoveCheck
): string | null {
  if (!input.canManageOpportunities) {
    return "Нужно право tenant.opportunities.manage";
  }
  if (input.isPending) {
    return "Дождитесь завершения текущего действия";
  }
  if (isFinalOpportunity(input.opportunity)) {
    return "Этап завершенной сделки нельзя менять";
  }
  if (input.targetStageId === input.opportunity.stageId) {
    return "Сделка уже на этом этапе";
  }

  const targetStage = input.dealStages.find((stage) => stage.id === input.targetStageId);
  if (!targetStage) {
    return "Этап сделки не найден";
  }
  if (targetStage.status !== "active") {
    return "Переносить можно только в активный этап";
  }

  return null;
}

export function getOpportunityStageLabel(
  dealStages: DealStage[],
  opportunity: Opportunity
): string {
  const stage = dealStages.find((item) => item.id === opportunity.stageId);
  if (!stage) return opportunity.stageId ?? "Без этапа";
  return stage.status === "archived" ? `${stage.name} · архив` : stage.name;
}

export function isArchivedOpportunityStage(
  dealStages: DealStage[],
  opportunity: Opportunity
): boolean {
  return dealStages.find((item) => item.id === opportunity.stageId)?.status === "archived";
}

export function formatOpportunityEconomics(opportunity: Opportunity): {
  contractValueLabel: string;
  plannedHourlyRateLabel: string;
  plannedHoursLabel: string;
} {
  return {
    contractValueLabel: formatMoney(opportunity.contractValue),
    plannedHourlyRateLabel: `${formatMoney(opportunity.plannedHourlyRate)}/ч`,
    plannedHoursLabel: `${opportunity.plannedHours} ч`
  };
}

export type OpportunityKanbanCardViewModel = {
  clientLabel: string;
  contactLabel: string;
  contractValueLabel: string;
  demandLabel: string;
  feasibilityLabel: string;
  feasibilityTone: "success" | "muted";
  periodLabel: string;
  plannedHourlyRateLabel: string;
  plannedHoursLabel: string;
};

export function buildOpportunityKanbanCardViewModel(
  data: OpportunityReferenceData,
  opportunity: Opportunity
): OpportunityKanbanCardViewModel {
  const economics = formatOpportunityEconomics(opportunity);

  return {
    clientLabel: getOpportunityClientLabel(data, opportunity),
    contactLabel: getOpportunityContactLabel(data, opportunity),
    contractValueLabel: economics.contractValueLabel,
    demandLabel: formatOpportunityDemand(data, opportunity),
    feasibilityLabel: getOpportunityFeasibilityLabel(opportunity.feasibilityStatus),
    feasibilityTone: opportunity.feasibilityStatus === "ok" ? "success" : "muted",
    periodLabel: `${formatDateOnly(opportunity.plannedStart)} -> ${formatDateOnly(opportunity.plannedFinish)}`,
    plannedHourlyRateLabel: economics.plannedHourlyRateLabel,
    plannedHoursLabel: economics.plannedHoursLabel
  };
}

export function getOpportunityFeasibilityLabel(
  status: Opportunity["feasibilityStatus"]
): string {
  if (status === "ok") return "Достаточно ресурса";
  if (status === "warning") return "Есть предупреждения";
  if (status === "conflict") return "Конфликт ресурса";
  if (status === "blocked") return "Заблокировано";
  return "Не проверено";
}

function sortDealStages(dealStages: DealStage[]): DealStage[] {
  return [...dealStages].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
  );
}

function isFinalOpportunity(opportunity: Opportunity): boolean {
  return opportunity.status === "won_closed" || opportunity.status === "lost_rejected";
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "RUB"
  }).format(value);
}

function formatOpportunityDemand(
  data: Pick<WorkspaceData, "positions">,
  opportunity: Opportunity
): string {
  if (opportunity.demand.length === 0) return "Потребность не задана";

  return opportunity.demand
    .map((line) => {
      const positionName =
        data.positions.find((position) => position.id === line.positionId)?.name ??
        line.positionId;
      return `${positionName}: ${line.requiredHours} ч`;
    })
    .join(", ");
}

function formatDateOnly(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
    year: "numeric"
  }).format(new Date(value));
}
