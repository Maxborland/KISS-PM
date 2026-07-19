"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ControlSignalStatus } from "@kiss-pm/domain";

import { DomainApiError } from "../../lib/domain-client";

import {
  createControlClient,
  mapControlError,
  type ActionApplyResponse,
  type ActionPreviewResponse,
  type ControlEvaluateResponse,
  type ControlReadModel,
  type ControlUiError,
  type CorrectiveActionCreateInput,
  type CorrectiveActionCreateResponse,
  type RetrospectiveView,
  type SignalStatusResponse
} from "./control-client";

export type ControlStatus = "loading" | "ready" | "error" | "forbidden";

export type ControlMutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ControlUiError };

export type RetrospectiveState =
  | { status: "loading" }
  | { status: "ready"; view: RetrospectiveView }
  | { status: "forbidden" }
  | { status: "error"; error: ControlUiError };

/**
 * Контур управления проектом: read-model (KPI/сигналы/corrective actions) +
 * мутации строго через серверные роуты controlRoutes. `enabled=false` (нет права
 * чтения) — сеть не трогаем, поверхность показывает forbidden сама.
 */
export function useControl(projectId: string, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const clientRef = useRef<ReturnType<typeof createControlClient> | null>(null);
  if (clientRef.current === null) clientRef.current = createControlClient();
  const client = clientRef.current;

  const [readModel, setReadModel] = useState<ControlReadModel | null>(null);
  const [status, setStatus] = useState<ControlStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [retrospective, setRetrospective] = useState<RetrospectiveState>({ status: "loading" });

  const reload = useCallback(async () => {
    setStatus((previous) => (previous === "ready" ? previous : "loading"));
    try {
      const model = await client.getReadModel(projectId);
      setReadModel(model);
      setStatus("ready");
      setError(null);
    } catch (e) {
      const mapped = mapControlError(e, "load_failed");
      setStatus(e instanceof DomainApiError && e.status === 403 ? "forbidden" : "error");
      setError(mapped.code);
    }
  }, [client, projectId]);

  useEffect(() => {
    if (!enabled) return;
    void reload();
  }, [enabled, reload]);

  const loadRetrospective = useCallback(async () => {
    setRetrospective({ status: "loading" });
    try {
      const view = await client.getRetrospective(projectId);
      setRetrospective({ status: "ready", view });
    } catch (e) {
      if (e instanceof DomainApiError && e.status === 403) {
        setRetrospective({ status: "forbidden" });
        return;
      }
      setRetrospective({ status: "error", error: mapControlError(e, "retrospective_failed") });
    }
  }, [client, projectId]);

  const guard = useCallback(
    async <T>(fallbackCode: string, run: () => Promise<T>): Promise<ControlMutationResult<T>> => {
      try {
        return { ok: true, data: await run() };
      } catch (e) {
        return { ok: false, error: mapControlError(e, fallbackCode) };
      }
    },
    []
  );

  const evaluate = useCallback(
    (): Promise<ControlMutationResult<ControlEvaluateResponse>> =>
      guard("evaluate_failed", () => client.evaluate(projectId)),
    [client, guard, projectId]
  );

  const previewAction = useCallback(
    (signalId: string, actionId: string): Promise<ControlMutationResult<ActionPreviewResponse>> =>
      guard("preview_failed", () => client.previewAction(projectId, signalId, actionId)),
    [client, guard, projectId]
  );

  const applyAction = useCallback(
    (
      signalId: string,
      actionId: string,
      clientPlanVersion: number
    ): Promise<ControlMutationResult<ActionApplyResponse>> =>
      guard("apply_failed", () => client.applyAction(projectId, signalId, actionId, clientPlanVersion)),
    [client, guard, projectId]
  );

  const setSignalStatus = useCallback(
    (
      signalId: string,
      nextStatus: ControlSignalStatus,
      acceptedRiskReason?: string
    ): Promise<ControlMutationResult<SignalStatusResponse>> =>
      guard("status_failed", () => client.setSignalStatus(projectId, signalId, nextStatus, acceptedRiskReason)),
    [client, guard, projectId]
  );

  const createCorrectiveAction = useCallback(
    (
      signalId: string,
      input: CorrectiveActionCreateInput
    ): Promise<ControlMutationResult<CorrectiveActionCreateResponse>> =>
      guard("corrective_failed", () => client.createCorrectiveAction(projectId, signalId, input)),
    [client, guard, projectId]
  );

  return {
    readModel,
    status,
    error,
    reload,
    retrospective,
    loadRetrospective,
    evaluate,
    previewAction,
    applyAction,
    setSignalStatus,
    createCorrectiveAction
  };
}
