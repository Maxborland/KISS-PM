"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlanningCommand, ScenarioProposal } from "@kiss-pm/domain";
import {
  PlanningApiError,
  type PlanningPreviewResponse,
  type PlanningReadModel
} from "@kiss-pm/planning-client";

import { createDeliveryPlanningClient, type CommitMetaView, type CommitsView } from "./planning-client";
import { createClientId } from "./client-id";
import { mapPlanningError } from "./project-chrome";
import { usePlanningPreviewGate } from "./planning-preview-gate";
import { usePlanningRuntime } from "./planning-runtime";

export type { CommitMetaView, CommitsView };

// "forbidden" — 403 при загрузке read-model (нет права на проект). В моке теоретичен
// (бэкенд отдаёт 200 для демо-сессии), но проводка позволяет поверхностям показывать
// единый ForbiddenState через <SurfaceState>, а не «ошибку» с кнопкой повтора.
export type PlanningStatus = "loading" | "ready" | "error" | "forbidden";

export type ValidationHit = { message: string; entityId?: string };
export type ApplyBatchOptions = { idempotencyKey?: string };
type PendingPlanningWrite = { signature: string; idempotencyKey: string };

export type ApplyResult =
  | { ok: true; changed: string[]; planVersion: number }
  | { ok: false; conflict: boolean; code?: string; message: string; issues?: ValidationHit[] };

export type ScenarioPreviewResult =
  | { ok: true; proposals: ScenarioProposal[]; planVersion: number; expiresAt: string }
  | { ok: false; conflict: boolean; code?: string; message: string };
export type ScenarioApplyResult =
  | { ok: true; planVersion: number; scenarioRunId: string; auditEventId: string }
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
  const applyRequestRef = useRef<PendingPlanningWrite | null>(null);
  const applyBatchRequestRef = useRef<PendingPlanningWrite | null>(null);
  const revertRequestRef = useRef<{ targetCommitId: string; clientPlanVersion: number; idempotencyKey: string } | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const rm = await client.getPlanReadModel(projectId);
      setReadModel(rm);
      setStatus("ready");
      setError(null);
    } catch (e) {
      const mappedError = mapPlanningError(e, "load_failed");
      // 403 → forbidden (нет права на проект): отдельный статус, не «ошибка загрузки».
      if (e instanceof PlanningApiError && e.status === 403) {
        setStatus("forbidden");
        setError(mappedError.code);
        return;
      }
      setStatus("error");
      setError(mappedError.code);
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
        const signature = planningWriteSignature(readModel.planVersion, [command]);
        const request = resolvePlanningWriteRequest(
          applyRequestRef.current,
          signature,
          "planning-apply"
        );
        applyRequestRef.current = request;
        const res = await client.applyCommand(projectId, {
          command,
          clientPlanVersion: readModel.planVersion,
          idempotencyKey: request.idempotencyKey
        });
        if (applyRequestRef.current?.idempotencyKey === request.idempotencyKey) {
          applyRequestRef.current = null;
        }
        lastApplyRef.current = { afterVersion: res.newPlanVersion, commands: [command], before: readModel };
        setReadModel(res.readModel);
        return { ok: true, changed: res.applied.changedTaskIds, planVersion: res.newPlanVersion };
      } catch (e) {
        if (e instanceof PlanningApiError && e.code === "plan_version_conflict") {
          await load();
          const mappedError = mapPlanningError(e);
          return { ok: false, conflict: true, code: mappedError.code, message: mappedError.message };
        }
        const mappedError = mapPlanningError(e, "apply_failed");
        let issues: ValidationHit[] | undefined;
        if (e instanceof PlanningApiError && Array.isArray(e.body.validationIssues)) {
          issues = (e.body.validationIssues as Array<{ message?: string; entity?: { id?: string } | null }>).map((v) => ({
            message: String(v.message ?? "Ошибка валидации"),
            ...(v.entity?.id ? { entityId: v.entity.id } : {})
          }));
        }
        return { ok: false, conflict: false, code: mappedError.code, message: mappedError.message, ...(issues ? { issues } : {}) };
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
        const signature = planningWriteSignature(readModel.planVersion, commands);
        const request = options?.idempotencyKey
          ? { signature, idempotencyKey: options.idempotencyKey }
          : resolvePlanningWriteRequest(
              applyBatchRequestRef.current,
              signature,
              "planning-batch"
            );
        applyBatchRequestRef.current = request;
        const res = await client.applyCommandBatch(projectId, {
          commands,
          clientPlanVersion: readModel.planVersion,
          idempotencyKey: request.idempotencyKey
        });
        if (applyBatchRequestRef.current?.idempotencyKey === request.idempotencyKey) {
          applyBatchRequestRef.current = null;
        }
        lastApplyRef.current = { afterVersion: res.newPlanVersion, commands, before: readModel };
        setReadModel(res.readModel);
        return { ok: true, changed: res.applied.changedTaskIds, planVersion: res.newPlanVersion };
      } catch (e) {
        if (e instanceof PlanningApiError && e.code === "plan_version_conflict") {
          await load();
          const mappedError = mapPlanningError(e);
          return { ok: false, conflict: true, code: mappedError.code, message: mappedError.message };
        }
        const mappedError = mapPlanningError(e, "apply_failed");
        let issues: ValidationHit[] | undefined;
        if (e instanceof PlanningApiError && Array.isArray(e.body.validationIssues)) {
          issues = (e.body.validationIssues as Array<{ message?: string; entity?: { id?: string } | null }>).map((v) => ({
            message: String(v.message ?? "Ошибка валидации"),
            ...(v.entity?.id ? { entityId: v.entity.id } : {})
          }));
        }
        return { ok: false, conflict: false, code: mappedError.code, message: mappedError.message, ...(issues ? { issues } : {}) };
      }
    },
    [client, projectId, readModel, load, requestConfirmation]
  );

  // Read-only батч-превью БЕЗ гейта подтверждения: детализация последствий для панелей
  // сравнения (сценарии показывают задачи с датами до→после). План не мутирует.
  const previewBatch = useCallback(
    async (commands: PlanningCommand[]): Promise<PlanningPreviewResponse | null> => {
      if (!readModel || commands.length === 0) return null;
      return client.previewCommandBatch(projectId, { commands, clientPlanVersion: readModel.planVersion });
    },
    [client, projectId, readModel]
  );

  // BUG-PROJ-24: откат последнего обратимого коммита через серверный revert-last
  // (работает из истории /commits, не зависит от in-session lastApplyRef).
  const revertLast = useCallback(async (targetCommitId: string): Promise<ApplyResult> => {
    if (!client) return { ok: false, conflict: false, message: "no_client" };
    if (!readModel) return { ok: false, conflict: false, message: "no_read_model" };
    const current = revertRequestRef.current;
    const request = current?.targetCommitId === targetCommitId && current.clientPlanVersion === readModel.planVersion
      ? current
      : {
          targetCommitId,
          clientPlanVersion: readModel.planVersion,
          idempotencyKey: createClientId("planning-revert")
        };
    revertRequestRef.current = request;
    try {
      const res = await client.revertLast(projectId, request);
      revertRequestRef.current = null;
      setReadModel(res.readModel);
      return { ok: true, changed: res.applied.changedTaskIds, planVersion: res.newPlanVersion };
    } catch (e) {
      if (e instanceof PlanningApiError && e.code === "plan_version_conflict") {
        await load();
        const mappedError = mapPlanningError(e);
        return { ok: false, conflict: true, code: mappedError.code, message: mappedError.message };
      }
      const mappedError = mapPlanningError(e, "revert_failed");
      return { ok: false, conflict: false, code: mappedError.code, message: mappedError.message };
    }
  }, [client, projectId, readModel, load]);
  const previewScenarios = useCallback(
    async (target: Record<string, unknown>): Promise<ScenarioPreviewResult> => {
      if (!readModel) return { ok: false, conflict: false, message: "no_read_model" };
      try {
        const res = await client.previewScenarios(projectId, { target, clientPlanVersion: readModel.planVersion });
        return { ok: true, proposals: res.proposals, planVersion: res.planVersion, expiresAt: res.expiresAt };
      } catch (e) {
        if (e instanceof PlanningApiError && e.code === "plan_version_conflict") {
          await load();
          const mappedError = mapPlanningError(e);
          return { ok: false, conflict: true, code: mappedError.code, message: mappedError.message };
        }
        const mappedError = mapPlanningError(e, "preview_failed");
        return { ok: false, conflict: false, code: mappedError.code, message: mappedError.message };
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
        // auditEventId — квитанция применения: по ней success-состояние сценариев ссылается на вкладку «Коммиты».
        return { ok: true, planVersion: res.newPlanVersion, scenarioRunId: res.scenarioRunId, auditEventId: res.auditEventId };
      } catch (e) {
        if (e instanceof PlanningApiError && e.code === "plan_version_conflict") {
          await load();
          const mappedError = mapPlanningError(e);
          return { ok: false, conflict: true, code: mappedError.code, message: mappedError.message };
        }
        const mappedError = mapPlanningError(e, "apply_scenario_failed");
        return { ok: false, conflict: false, code: mappedError.code, message: mappedError.message };
      }
    },
    [client, projectId, readModel, load, requestConfirmation]
  );

  // журнал коммитов сессии — через единый шов клиента (mock /planning/commits vs live audit-events).
  // lastApplyRef.current даёт live-адаптеру данные отката последнего применённого этой сессией коммита.
  const loadCommits = useCallback((): Promise<CommitsView> => {
    return client.getCommits(projectId, lastApplyRef.current);
  }, [client, projectId]);

  return { client, readModel, setReadModel, status, error, reload: load, preview, previewBatch, apply, applyBatch, revertLast, previewScenarios, applyScenario, loadCommits };
}
function planningWriteSignature(planVersion: number, commands: readonly PlanningCommand[]): string {
  return JSON.stringify({ planVersion, commands });
}

function resolvePlanningWriteRequest(
  pending: PendingPlanningWrite | null,
  signature: string,
  prefix: string
): PendingPlanningWrite {
  return pending?.signature === signature
    ? pending
    : { signature, idempotencyKey: createClientId(prefix) };
}
