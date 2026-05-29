import type { DealStage, Opportunity, Task, TaskStatusCategory } from "@/lib/api-types";
import type { FunnelDeal, FunnelStage } from "@/widgets/funnel/types";
import type { TaskKanbanItem } from "@/widgets/kanban";

import type { FixtureBundle } from "./fixture-bundle";
import { formatDate, formatRub } from "./format";
import { clientName } from "./crm";
import { userAvatar, userName } from "./users";

const TASK_PRIORITY_LABEL: Record<Task["priority"], string> = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий",
  critical: "Критичный"
};

function taskCategoryToColumnId(category: TaskStatusCategory): "new" | "in_progress" | "review" | "done" {
  return category === "waiting" ? "new" : category;
}

export type TaskKanbanCardModel = TaskKanbanItem<"new" | "in_progress" | "review" | "done">;

export function buildTaskKanbanCards(tasks: Task[]): TaskKanbanCardModel[] {
  return tasks.map((task) => ({
    id: task.id,
    columnId: taskCategoryToColumnId(task.statusCategory),
    title: task.title,
    priority: task.priority,
    priorityLabel: TASK_PRIORITY_LABEL[task.priority],
    meta: [
      { label: task.statusName },
      { label: `Проект: ${task.projectId}` },
      { label: `Постановщик: ${userName(task.requesterUserId)}` }
    ],
    assignees: task.participants.map((participant) => userAvatar(participant.userId)),
    comments: task.id === "MDS-39" ? 13 : task.id === "MDS-2" ? 7 : 2,
    date: formatDate(task.plannedFinish),
    progress: task.progress,
    plannedWork: task.plannedWork,
    actualWork: task.actualWork,
    requiresAcceptance: task.requiresAcceptance,
    ownerName: userName(task.ownerUserId),
    requesterName: userName(task.requesterUserId),
    statusName: task.statusName,
    highlight: task.priority === "critical"
  }));
}

export type EntityCatalogKind = "clients" | "contacts" | "products";

export function buildFunnelStagesFromDealStages(dealStages: DealStage[]): FunnelStage[] {
  return dealStages
    .filter((stage) => stage.status === "active")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((stage) => ({ id: stage.id, title: stage.name }));
}

export function buildFunnelStages(fixtures: FixtureBundle): FunnelStage[] {
  return buildFunnelStagesFromDealStages(fixtures.dealStages);
}

export function buildFunnelDeals(opportunities: Opportunity[]): FunnelDeal[] {
  return opportunities.map((opportunity) => ({
    ...opportunity,
    client: opportunity.clientName,
    amount: formatRub(opportunity.contractValue),
    stage: opportunity.stageId ?? "lead",
    owner: userAvatar(opportunity.ownerUserId)
  }));
}

type EntityRow = Record<string, unknown> & { name: string; code: string };

export function buildEntityCopy(
  kind: EntityCatalogKind,
  fixtures: FixtureBundle
): { title: string; lead: string; cols: string[]; rows: EntityRow[] } {
  switch (kind) {
    case "clients":
      return {
        title: "Клиенты",
        lead: "Справочник клиентов арендатора.",
        cols: ["Клиент", "Статус", "Описание", "Создан", "Обновлён"],
        rows: fixtures.clients.map((client) => ({
          ...client,
          name: client.name,
          code: client.id
        }))
      };
    case "contacts":
      return {
        title: "Контакты",
        lead: "Контактные лица и связи с CRM.",
        cols: ["Контакт", "Компания", "Должность", "Контакты", "Статус"],
        rows: fixtures.contacts.map((contact) => ({
          ...contact,
          name: contact.name,
          code: contact.id,
          company: clientName(contact.clientId)
        }))
      };
    case "products":
      return {
        title: "Продукты",
        lead: "Каталог продуктов для сделок и проектов.",
        cols: ["Продукт", "SKU / тип", "Ед.", "Цена", "Статус"],
        rows: fixtures.products.map((product) => ({
          ...product,
          name: product.name,
          code: product.sku ?? product.id
        }))
      };
  }
}
