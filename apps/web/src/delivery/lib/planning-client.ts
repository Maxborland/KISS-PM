import type { PlanningCommand } from "@kiss-pm/domain";
import { createPlanningApiClient, type PlanningReadModel } from "@kiss-pm/planning-client";

import { createRequestJson } from "../../lib/domain-client";

import { createMockPlanningFetch, RESOURCES, type Resource } from "./mock-planning-backend";

// ── Журнал коммитов (PM-as-code) ──────────────────────────────────────────────
export type CommitMetaView = { version: number; actionType: string; summary: string; changedTaskIds: string[]; auditEventId: string; at: string; revertible: boolean };
export type CommitsView = { commits: CommitMetaView[]; latestRevert: { auditEventId: string; commands: PlanningCommand[]; before: PlanningReadModel } | null };

// Последний применённый этой сессией apply: команды + read-model ДО него + версия ПОСЛЕ.
// Держим в памяти хука (audit.beforeState — только счётчики, для отката недостаточен), передаём
// в getCommits, чтобы live-адаптер знал, какой из исторических коммитов ещё обратим.
export type LastApply = { afterVersion: number; commands: PlanningCommand[]; before: PlanningReadModel } | null;

// Боевой журнал = GET /api/tenant/current/audit-events. afterState даёт версию/изменённые задачи;
// beforeState — только счётчики (не полный read-model), поэтому откат в live недоступен (revertible=false).
type PlanningAuditEvent = {
  id: string;
  actionType: string;
  sourceWorkflow: string | null;
  input?: { command?: { type?: string } };
  afterState: { planVersion: number; changedTaskIds?: string[] };
  createdAt: string;
};
const PLAN_COMMAND_SUMMARY: Record<string, string> = {
  "task.create": "Создана задача",
  "task.update_identity": "Изменено название задачи",
  "task.update_schedule": "Сдвинуты сроки задачи",
  "task.update_work_model": "Изменена трудоёмкость",
  "task.update_status": "Изменён статус задачи",
  "task.update_progress": "Обновлён прогресс",
  "task.move_wbs": "Перемещена в WBS",
  "task.delete_or_archive": "Задача архивирована",
  "dependency.upsert": "Добавлена связь",
  "dependency.delete": "Снята связь",
  "assignment.upsert": "Назначен ресурс",
  "assignment.delete": "Снято назначение",
  "baseline.capture": "Зафиксирован базовый план",
  "risk.accept_overload": "Принят перегруз"
};

// Боевой справочник пользователей рабочего пространства (GET /api/workspace/users).
type ApiUser = { id: string; name: string; positionId?: string | null; positionName?: string | null };

/**
 * Единый шов планировочного транспорта. Решение mock/live принимается ОДИН раз здесь
 * (при конструировании), а не переветвляется в каждом хуке:
 * - планировочные команды (getPlanReadModel/preview/apply/...) — как раньше: mock fetchImpl
 *   (contract-mock, изолированная сессия на монтаж) vs боевой клиент без fetchImpl → fetch на /api/*;
 * - getCommits — журнал версий: mock /planning/commits vs live /api/tenant/current/audit-events;
 * - getResourceDirectory — справочник ресурсов: mock RESOURCES vs live /api/workspace/users.
 * Разница в обратимости коммитов и в форме справочника — деталь адаптера, наружу форма единая.
 */
export function createDeliveryPlanningClient(live: boolean) {
  // mock: единый contract-mock fetch на клиент — им пользуются и команды, и getCommits, поэтому
  // журнал отражает применённые этой сессией правки. live: боевой клиент без fetchImpl → глобальный fetch.
  const mockFetch = live ? null : createMockPlanningFetch();
  const base = live
    ? createPlanningApiClient({ apiOrigin: "" })
    : createPlanningApiClient({ apiOrigin: "", fetchImpl: mockFetch! });
  // Живые вне-planning вызовы (audit-events, users) — через общий транспорт,
  // политика cookie прежняя (same-origin).
  const requestJson = createRequestJson({ apiOrigin: "", credentials: "same-origin" });

  // ── getCommits ──────────────────────────────────────────────────────────────
  const getCommitsMock = async (_projectId: string, _lastApply: LastApply): Promise<CommitsView> => {
    // contract-mock /planning/commits (с откатом latestRevert из сессии мока)
    const res = await mockFetch!("/planning/commits");
    return (await res.json()) as CommitsView;
  };
  const getCommitsLive = async (projectId: string, lastApply: LastApply): Promise<CommitsView> => {
    // live: GET /api/tenant/current/audit-events — planning-события проекта. Откат доступен ТОЛЬКО
    // для последнего применённого этой сессией коммита (before read-model держим в памяти хука —
    // audit.beforeState недостаточен). Произвольный исторический откат — будущая серверная задача.
    const body = await requestJson<{ auditEvents: PlanningAuditEvent[] }>(
      `/api/tenant/current/audit-events?projectId=${encodeURIComponent(projectId)}`
    ).catch(() => {
      throw new Error("audit_events_failed");
    });
    const last = lastApply;
    const commits: CommitMetaView[] = body.auditEvents
      .filter((event) => event.sourceWorkflow === "planning" && event.afterState?.planVersion != null)
      .map((event) => ({
        version: event.afterState.planVersion,
        actionType: event.actionType,
        summary: (event.input?.command?.type && PLAN_COMMAND_SUMMARY[event.input.command.type]) || event.actionType,
        changedTaskIds: event.afterState.changedTaskIds ?? [],
        auditEventId: event.id,
        at: event.createdAt,
        revertible: last != null && event.afterState.planVersion === last.afterVersion
      }))
      .sort((left, right) => right.version - left.version);
    const latestRevert =
      last != null && commits[0] != null && commits[0].version === last.afterVersion
        ? { auditEventId: commits[0].auditEventId, commands: last.commands, before: last.before }
        : null;
    return { commits, latestRevert };
  };

  // ── getResourceDirectory ──────────────────────────────────────────────────────
  // mock (Storybook): статический RESOURCES — его id совпадают с мок-назначениями плана;
  // live (прод-route): GET /api/workspace/users — id = реальные resourceId назначений read-model.
  const resourceDirectorySeedMock = (): Resource[] => RESOURCES;
  const resourceDirectorySeedLive = (): Resource[] => [];
  const getResourceDirectoryMock = async (): Promise<Resource[]> => RESOURCES;
  const getResourceDirectoryLive = async (): Promise<Resource[]> => {
    try {
      const payload = await requestJson<{ users?: ApiUser[] }>("/api/workspace/users");
      return (payload.users ?? []).map<Resource>((u) => ({
        id: u.id,
        name: u.name,
        positionId: u.positionId ?? "",
        positionName: u.positionName ?? "",
        // группировка по позиции — реальное поле; оргдерево (направление/отдел) ждёт сидов
        teamId: u.positionId ?? "team",
        teamName: u.positionName ?? "Команда проекта",
        // ponytail: дефолт рабочего дня 8ч; реальная ёмкость — из календаря ресурса, если понадобится
        capacityMinPerDay: 480
      }));
    } catch {
      return [];
    }
  };

  return {
    ...base,
    getCommits: live ? getCommitsLive : getCommitsMock,
    // синхронный старт справочника (mock отдаёт RESOURCES сразу, без кадра пустоты — как раньше)
    resourceDirectorySeed: live ? resourceDirectorySeedLive : resourceDirectorySeedMock,
    getResourceDirectory: live ? getResourceDirectoryLive : getResourceDirectoryMock
  };
}
