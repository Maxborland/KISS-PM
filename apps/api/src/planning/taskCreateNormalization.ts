import type { PlanningCommand } from "@kiss-pm/domain";

import type { PlanningReadDataPort } from "../apiDataPorts";
// Новая задача всегда стартует в начальном статусе тенанта (категория "new").
// Клиент не обязан знать реальные id статусов (в моке и live они разные) — если
// присланный statusId не активен в тенанте, подставляем начальный. BUG-PROJ-01
// (UI слал несуществующий "todo" → 409 planning_command_invalid).
export async function normalizeTaskCreateStatus(
  dataSource: PlanningReadDataPort,
  tenantId: string,
  command: PlanningCommand
): Promise<PlanningCommand> {
  if (command.type !== "task.create" || !dataSource.listTaskStatuses) return command;
  const active = (await dataSource.listTaskStatuses(tenantId)).filter((s) => s.status === "active");
  if (active.some((s) => s.id === command.payload.statusId)) return command;
  const initial =
    active.find((s) => s.category === "new") ??
    [...active].sort((a, b) => a.sortOrder - b.sortOrder)[0];
  if (!initial) return command;
  return { ...command, payload: { ...command.payload, statusId: initial.id } };
}
