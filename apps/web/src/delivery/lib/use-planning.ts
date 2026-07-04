"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlanningCommand } from "@kiss-pm/domain";
import {
  createPlanningApiClient,
  PlanningApiError,
  type PlanningPreviewResponse,
  type PlanningReadModel
} from "@kiss-pm/planning-client";

import { usePlanningRuntime } from "./planning-runtime";

// "forbidden" — 403 при загрузке read-model (нет права на проект). В моке теоретичен
// (бэкенд отдаёт 200 для демо-сессии), но проводка позволяет поверхностям показывать
// единый ForbiddenState через <SurfaceState>, а не «ошибку» с кнопкой повтора.
export type PlanningStatus = "loading" | "ready" | "error" | "forbidden";

export type ValidationHit = { message: string; entityId?: string };
export type ApplyResult =
  | { ok: true; changed: string[]; planVersion: number }
  | { ok: false; conflict: boolean; message: string; issues?: ValidationHit[] };

export type ScenarioPreviewResult =
  | { ok: true; proposals: Array<Record<string, unknown>>; expiresAt: string }
  | { ok: false; conflict: boolean; message: string };
export type ScenarioApplyResult =
  | { ok: true; planVersion: number; scenarioRunId: string }
  | { ok: false; conflict: boolean; code?: string; message: string };
export type CommitMetaView = { version: number; actionType: string; summary: string; changedTaskIds: string[]; auditEventId: string; at: string; revertible: boolean };
export type CommitsView = { commits: CommitMetaView[]; latestRevert: { auditEventId: string; commands: PlanningCommand[]; before: PlanningReadModel } | null };

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
type PlanningClient = ReturnType<typeof createPlanningApiClient>;

/**
 * Работает через настоящий @kiss-pm/planning-client. Product runtime ходит только в live API;
 * Storybook/demo передают contract-mock fetchImpl извне, чтобы production hook не импортировал mock backend.
 */
export function usePlanning(projectId: string) {
  const { live, fetchImpl } = usePlanningRuntime();
  const mockFetch = live ? null : fetchImpl;
  const client = useMemo<PlanningClient | null>(() => {
    if (!live && !mockFetch) return null;
    return mockFetch
      ? createPlanningApiClient({ apiOrigin: "", fetchImpl: mockFetch })
      : createPlanningApiClient({ apiOrigin: "" });
  }, [live, mockFetch]);

  const [readModel, setReadModel] = useState<PlanningReadModel | null>(null);
  const [status, setStatus] = useState<PlanningStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  // Последний применённый этой сессией apply: команды + read-model ДО него + версия ПОСЛЕ.
  // Держим before в памяти клиента, т.к. audit.beforeState (только счётчики) недостаточен для отката.
  const lastApplyRef = useRef<{ afterVersion: number; commands: PlanningCommand[]; before: PlanningReadModel } | null>(null);

  useEffect(() => {
    setStatus("loading");
    setError(null);
    setReadModel(null);
    lastApplyRef.current = null;
  }, [live, mockFetch, projectId]);

  const load = useCallback(async () => {
    if (!client) {
      setStatus("error");
      setError(live ? "planning_client_not_configured" : "planning_mock_transport_not_configured");
      return;
    }
    setStatus("loading");
    try {
      const rm = await client.getPlanReadModel(projectId);
      setReadModel(rm);
      setStatus("ready");
      setError(null);
    } catch (e) {
      // 403 → forbidden (нет права на проект): отдельный статус, не «ошибка загрузки».
      if (e instanceof PlanningApiError && e.status === 403) {
        setStatus("forbidden");
        setError(e.code || "forbidden");
        return;
      }
      setStatus("error");
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [client, live, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const preview = useCallback(
    async (command: PlanningCommand): Promise<PlanningPreviewResponse | null> => {
      if (!client || !readModel) return null;
      return client.previewCommand(projectId, { command, clientPlanVersion: readModel.planVersion });
    },
    [client, projectId, readModel]
  );

  const apply = useCallback(
    async (command: PlanningCommand): Promise<ApplyResult> => {
      if (!client || !readModel) return { ok: false, conflict: false, message: "no_read_model" };
      try {
        const res = await client.applyCommand(projectId, { command, clientPlanVersion: readModel.planVersion });
        lastApplyRef.current = { afterVersion: res.newPlanVersion, commands: [command], before: readModel };
        setReadModel(res.readModel);
        return { ok: true, changed: res.applied.changedTaskIds, planVersion: res.newPlanVersion };
      } catch (e) {
        if (e instanceof PlanningApiError && e.code === "plan_version_conflict") {
          await load();
          return { ok: false, conflict: true, message: "plan_version_conflict" };
        }
        let issues: ValidationHit[] | undefined;
        if (e instanceof PlanningApiError && Array.isArray(e.body.validationIssues)) {
          issues = (e.body.validationIssues as Array<{ message?: string; entity?: { id?: string } | null }>).map((v) => ({
            message: String(v.message ?? "Ошибка валидации"),
            ...(v.entity?.id ? { entityId: v.entity.id } : {})
          }));
        }
        return { ok: false, conflict: false, message: e instanceof Error ? e.message : "apply_failed", ...(issues ? { issues } : {}) };
      }
    },
    [client, projectId, readModel, load]
  );

  const applyBatch = useCallback(
    async (commands: PlanningCommand[]): Promise<ApplyResult> => {
      if (!client || !readModel || commands.length === 0) return { ok: false, conflict: false, message: "empty_batch" };
      try {
        const res = await client.applyCommandBatch(projectId, { commands, clientPlanVersion: readModel.planVersion });
        lastApplyRef.current = { afterVersion: res.newPlanVersion, commands, before: readModel };
        setReadModel(res.readModel);
        return { ok: true, changed: res.applied.changedTaskIds, planVersion: res.newPlanVersion };
      } catch (e) {
        if (e instanceof PlanningApiError && e.code === "plan_version_conflict") {
          await load();
          return { ok: false, conflict: true, message: "plan_version_conflict" };
        }
        let issues: ValidationHit[] | undefined;
        if (e instanceof PlanningApiError && Array.isArray(e.body.validationIssues)) {
          issues = (e.body.validationIssues as Array<{ message?: string; entity?: { id?: string } | null }>).map((v) => ({
            message: String(v.message ?? "Ошибка валидации"),
            ...(v.entity?.id ? { entityId: v.entity.id } : {})
          }));
        }
        return { ok: false, conflict: false, message: e instanceof Error ? e.message : "apply_failed", ...(issues ? { issues } : {}) };
      }
    },
    [client, projectId, readModel, load]
  );

  const previewScenarios = useCallback(
    async (target: Record<string, unknown>): Promise<ScenarioPreviewResult> => {
      if (!client || !readModel) return { ok: false, conflict: false, message: "no_read_model" };
      try {
        const res = await client.previewScenarios(projectId, { target, clientPlanVersion: readModel.planVersion });
        return { ok: true, proposals: res.proposals, expiresAt: res.expiresAt };
      } catch (e) {
        if (e instanceof PlanningApiError && e.code === "plan_version_conflict") {
          await load();
          return { ok: false, conflict: true, message: "plan_version_conflict" };
        }
        return { ok: false, conflict: false, message: e instanceof Error ? e.message : "preview_failed" };
      }
    },
    [client, projectId, readModel, load]
  );

  const applyScenario = useCallback(
    async (scenarioId: string, acceptedRiskReason?: string): Promise<ScenarioApplyResult> => {
      if (!client || !readModel) return { ok: false, conflict: false, message: "no_read_model" };
      try {
        const res = await client.applyScenario(projectId, scenarioId, { clientPlanVersion: readModel.planVersion, ...(acceptedRiskReason ? { acceptedRiskReason } : {}) });
        setReadModel(res.readModel);
        return { ok: true, planVersion: res.newPlanVersion, scenarioRunId: res.scenarioRunId };
      } catch (e) {
        if (e instanceof PlanningApiError && e.code === "plan_version_conflict") {
          await load();
          return { ok: false, conflict: true, message: "plan_version_conflict" };
        }
        const code = e instanceof PlanningApiError ? e.code : undefined;
        return { ok: false, conflict: false, ...(code ? { code } : {}), message: e instanceof Error ? e.message : "apply_scenario_failed" };
      }
    },
    [client, projectId, readModel, load]
  );

  // журнал коммитов сессии — МОК-маршрут поверхности (бьём в fetchImpl напрямую). На боевом API
  // история берётся отдельным fetchProjectAuditEvents → /api/tenant/current/audit-events (другой путь,
  // не участвует в «смене apiOrigin» как планировочные команды) — при интеграции вынести в метод клиента.
  const loadCommits = useCallback(async (): Promise<CommitsView> => {
    // mock: contract-mock /planning/commits (с откатом latestRevert). live: журнал из audit-events.
    if (!live) {
      if (!mockFetch) return { commits: [], latestRevert: null };
      const res = await mockFetch("/planning/commits");
      return (await res.json()) as CommitsView;
    }
    // live: GET /api/tenant/current/audit-events — planning-события проекта. Откат доступен ТОЛЬКО
    // для последнего применённого этой сессией коммита (before read-model держим в памяти клиента —
    // audit.beforeState недостаточен). Произвольный исторический откат — будущая серверная задача.
    const res = await fetch(`/api/tenant/current/audit-events?projectId=${encodeURIComponent(projectId)}`, { credentials: "same-origin" });
    if (!res.ok) throw new Error("audit_events_failed");
    const body = (await res.json()) as { auditEvents: PlanningAuditEvent[] };
    const last = lastApplyRef.current;
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
  }, [live, mockFetch, projectId]);

  return { client, readModel, setReadModel, status, error, reload: load, preview, apply, applyBatch, previewScenarios, applyScenario, loadCommits };
}
