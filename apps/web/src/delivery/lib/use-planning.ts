"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlanningCommand } from "@kiss-pm/domain";
import {
  createPlanningApiClient,
  PlanningApiError,
  type PlanningPreviewResponse,
  type PlanningReadModel
} from "@kiss-pm/planning-client";

import { createMockPlanningFetch } from "./mock-planning-backend";

export type PlanningStatus = "loading" | "ready" | "error";

export type ValidationHit = { message: string; entityId?: string };
export type ApplyResult =
  | { ok: true; changed: string[]; planVersion: number }
  | { ok: false; conflict: boolean; message: string; issues?: ValidationHit[] };

/**
 * Работает через настоящий @kiss-pm/planning-client. Транспорт —
 * contract-mock (createMockPlanningFetch), отдельный на каждый монтаж
 * (изолированное состояние сессии). Переключение на боевой API = смена
 * apiOrigin и удаление fetchImpl.
 */
export function usePlanning(projectId: string) {
  const clientRef = useRef<ReturnType<typeof createPlanningApiClient> | null>(null);
  if (clientRef.current === null) {
    clientRef.current = createPlanningApiClient({ apiOrigin: "", fetchImpl: createMockPlanningFetch() });
  }
  const client = clientRef.current;

  const [readModel, setReadModel] = useState<PlanningReadModel | null>(null);
  const [status, setStatus] = useState<PlanningStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const rm = await client.getPlanReadModel(projectId);
      setReadModel(rm);
      setStatus("ready");
      setError(null);
    } catch (e) {
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
        const res = await client.applyCommand(projectId, { command, clientPlanVersion: readModel.planVersion });
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
      if (!readModel || commands.length === 0) return { ok: false, conflict: false, message: "empty_batch" };
      try {
        const res = await client.applyCommandBatch(projectId, { commands, clientPlanVersion: readModel.planVersion });
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

  return { client, readModel, setReadModel, status, error, reload: load, preview, apply, applyBatch };
}
