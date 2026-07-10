"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlanningCommand } from "@kiss-pm/domain";
import {
  PlanningApiError,
  type PlanningPreviewResponse,
  type PlanningReadModel
} from "@kiss-pm/planning-client";

import { createDeliveryPlanningClient, type CommitMetaView, type CommitsView } from "./planning-client";
import { usePlanningPreviewGate } from "./planning-preview-gate";
import { usePlanningRuntime } from "./planning-runtime";

export type { CommitMetaView, CommitsView };

// "forbidden" — 403 при загрузке read-model (нет права на проект). В моке теоретичен
// (бэкенд отдаёт 200 для демо-сессии), но проводка позволяет поверхностям показывать
// единый ForbiddenState через <SurfaceState>, а не «ошибку» с кнопкой повтора.
export type PlanningStatus = "loading" | "ready" | "error" | "forbidden";

export type ValidationHit = { message: string; entityId?: string };
export type ApplyBatchOptions = { idempotencyKey?: string };

export type ApplyResult =
  | { ok: true; changed: string[]; planVersion: number }
  | { ok: false; conflict: boolean; message: string; issues?: ValidationHit[] };

export type ScenarioPreviewResult =
  | { ok: true; proposals: Array<Record<string, unknown>>; expiresAt: string }
  | { ok: false; conflict: boolean; message: string };
export type ScenarioApplyResult =
  | { ok: true; planVersion: number; scenarioRunId: string }
  | { ok: false; conflict: boolean; code?: string; message: string };
/**
 * Работает через настоящий @kiss-pm/planning-client. Транспорт —
 * contract-mock (createMockPlanningFetch), отдельный на каждый монтаж
 * (изолированное состояние сессии). Переключение на боевой API = смена
 * apiOrigin и удаление fetchImpl.
 */
export function usePlanning(projectId: string) {
  const { live } = usePlanningRuntime();
  const { requestConfirmation } = usePlanningPreviewGate();
  // Единый шов: решение mock/live принимается ОДИН раз при конструировании клиента (createDeliveryPlanningClient),
  // а не переветвляется в каждом read-пути. Команды, журнал коммитов и справочник ресурсов идут через него.
  const clientRef = useRef<ReturnType<typeof createDeliveryPlanningClient> | null>(null);
  if (clientRef.current === null) clientRef.current = createDeliveryPlanningClient(live);
  const client = clientRef.current;

  const [readModel, setReadModel] = useState<PlanningReadModel | null>(null);
  const [status, setStatus] = useState<PlanningStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  // Последний применённый этой сессией apply: команды + read-model ДО него + версия ПОСЛЕ.
  // Держим before в памяти клиента, т.к. audit.beforeState (только счётчики) недостаточен для отката.
  const lastApplyRef = useRef<{ afterVersion: number; commands: PlanningCommand[]; before: PlanningReadModel } | null>(null);

  const load = useCallback(async () => {
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
  }, [client, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const preview = useCallback(
    async (command: PlanningCommand): Promise<PlanningPreviewResponse | null> => {
      if (!readModel) return null;
      return client.previewCommand(projectId, { command, clientPlanVersion: readModel.planVersion });
    },
    [client, projectId, readModel]
  );

  const apply = useCallback(
    async (command: PlanningCommand): Promise<ApplyResult> => {
      if (!readModel) return { ok: false, conflict: false, message: "no_read_model" };
      try {
        const previewResult = await client.previewCommand(projectId, {
          command,
          clientPlanVersion: readModel.planVersion
        });
        const confirmed = await requestConfirmation({
          commands: [command],
          preview: previewResult
        });
        if (!confirmed) {
          return { ok: false, conflict: false, message: "preview_cancelled" };
        }
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
    [client, projectId, readModel, load, requestConfirmation]
  );

  const applyBatch = useCallback(
    async (commands: PlanningCommand[], options?: ApplyBatchOptions): Promise<ApplyResult> => {
      if (!readModel || commands.length === 0) return { ok: false, conflict: false, message: "empty_batch" };
      try {
        const previewResult = await client.previewCommandBatch(projectId, {
          commands,
          clientPlanVersion: readModel.planVersion
        });
        const confirmed = await requestConfirmation({ commands, preview: previewResult });
        if (!confirmed) {
          return { ok: false, conflict: false, message: "preview_cancelled" };
        }
        const res = await client.applyCommandBatch(projectId, {
          commands,
          clientPlanVersion: readModel.planVersion,
          ...(options?.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {})
        });
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
    [client, projectId, readModel, load, requestConfirmation]
  );

  // BUG-PROJ-24: откат последнего обратимого коммита через серверный revert-last
  // (работает из истории /commits, не зависит от in-session lastApplyRef).
  const revertLast = useCallback(async (): Promise<ApplyResult> => {
    if (!client) return { ok: false, conflict: false, message: "no_client" };
    try {
      const res = await client.revertLast(projectId);
      setReadModel(res.readModel);
      return { ok: true, changed: res.applied.changedTaskIds, planVersion: res.newPlanVersion };
    } catch (e) {
      if (e instanceof PlanningApiError && e.code === "nothing_to_revert") {
        return { ok: false, conflict: false, message: "nothing_to_revert" };
      }
      if (e instanceof PlanningApiError && e.code === "plan_version_conflict") {
        await load();
        return { ok: false, conflict: true, message: "plan_version_conflict" };
      }
      return { ok: false, conflict: false, message: e instanceof Error ? e.message : "revert_failed" };
    }
  }, [client, projectId, load]);

  const previewScenarios = useCallback(
    async (target: Record<string, unknown>): Promise<ScenarioPreviewResult> => {
      if (!readModel) return { ok: false, conflict: false, message: "no_read_model" };
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
    [client, projectId, readModel, load, requestConfirmation]
  );

  const applyScenario = useCallback(
    async (scenarioId: string, acceptedRiskReason?: string): Promise<ScenarioApplyResult> => {
      if (!readModel) return { ok: false, conflict: false, message: "no_read_model" };
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
    [client, projectId, readModel, load, requestConfirmation]
  );

  // журнал коммитов сессии — через единый шов клиента (mock /planning/commits vs live audit-events).
  // lastApplyRef.current даёт live-адаптеру данные отката последнего применённого этой сессией коммита.
  const loadCommits = useCallback((): Promise<CommitsView> => {
    return client.getCommits(projectId, lastApplyRef.current);
  }, [client, projectId]);

  return { client, readModel, setReadModel, status, error, reload: load, preview, apply, applyBatch, revertLast, previewScenarios, applyScenario, loadCommits };
}
