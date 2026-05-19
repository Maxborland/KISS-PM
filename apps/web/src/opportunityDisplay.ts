import type { DealStage, Opportunity } from "./api";
import type { WorkspaceData } from "./workspaceData";

type OpportunityReferenceData = Pick<
  WorkspaceData,
  "clients" | "contacts" | "projectTypes"
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

function sortDealStages(dealStages: DealStage[]): DealStage[] {
  return [...dealStages].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
  );
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
    style: "currency",
    currency: "RUB"
  }).format(value);
}
