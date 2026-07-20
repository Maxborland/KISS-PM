"use client";

import { useCallback, useState } from "react";

import { DomainApiError } from "../../lib/domain-client";
import { useDomainClient } from "../../lib/use-domain-client";
import { useResource, type LoadStatus } from "../../lib/use-resource";
import { useAdminRuntime } from "../lib/admin-runtime";
import {
  createControlSurfacesClient,
  type ControlSurfaceDetailResponse,
  type ControlSurfacePreviewResponse,
  type ControlSurfacePublishResponse,
  type ControlSurfaceRecord,
  type ControlSurfaceRollbackResponse,
  type ControlSurfaceValidationResult
} from "./control-surfaces-client";
import { createMockControlSurfacesFetch } from "./mock-control-surfaces-backend";

export type ControlSurfacesLoadStatus = LoadStatus;

// Результат действия: успех с данными или честная ошибка с кодом (+валидация при блокировке публикации).
export type ControlSurfaceActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; validation?: ControlSurfaceValidationResult };

function toActionError(error: unknown): { ok: false; code: string; validation?: ControlSurfaceValidationResult } {
  if (error instanceof DomainApiError) {
    const validation = (error.body as { validation?: ControlSurfaceValidationResult }).validation;
    return validation ? { ok: false, code: error.code, validation } : { ok: false, code: error.code };
  }
  return { ok: false, code: error instanceof Error ? error.message : "action_failed" };
}

/**
 * Хук admin «Контрол-поверхности». Транспорт по AdminRuntime (live → боевой
 * createControlSurfacesClient на /api/*, mock → contract-mock fetchImpl). Список
 * поверхностей + операции preview/publish/rollback: каждая возвращает честный
 * результат (успех+квитанция или код ошибки), список переигрывается после мутаций.
 */
export function useControlSurfaces() {
  const { live } = useAdminRuntime();
  const client = useDomainClient(live, createControlSurfacesClient, createMockControlSurfacesFetch);

  const [includeArchived, setIncludeArchived] = useState(false);
  const loader = useCallback(
    async () => (await client.listControlSurfaces(includeArchived)).surfaces,
    [client, includeArchived]
  );
  const { data, status, error, reload } = useResource<ControlSurfaceRecord[]>(loader);

  const getDetail = useCallback(
    async (surfaceId: string): Promise<ControlSurfaceActionResult<ControlSurfaceDetailResponse>> => {
      try {
        return { ok: true, data: await client.getControlSurface(surfaceId) };
      } catch (e) {
        return toActionError(e);
      }
    },
    [client]
  );

  const preview = useCallback(
    async (surfaceId: string): Promise<ControlSurfaceActionResult<ControlSurfacePreviewResponse>> => {
      try {
        return { ok: true, data: await client.previewControlSurface(surfaceId) };
      } catch (e) {
        return toActionError(e);
      }
    },
    [client]
  );

  const publish = useCallback(
    async (surfaceId: string): Promise<ControlSurfaceActionResult<ControlSurfacePublishResponse>> => {
      try {
        const data = await client.publishControlSurface(surfaceId);
        await reload();
        return { ok: true, data };
      } catch (e) {
        return toActionError(e);
      }
    },
    [client, reload]
  );

  const rollback = useCallback(
    async (surfaceId: string, version: number): Promise<ControlSurfaceActionResult<ControlSurfaceRollbackResponse>> => {
      try {
        const data = await client.rollbackControlSurface(surfaceId, version);
        await reload();
        return { ok: true, data };
      } catch (e) {
        return toActionError(e);
      }
    },
    [client, reload]
  );

  return {
    surfaces: data ?? [],
    status,
    error,
    reload,
    includeArchived,
    setIncludeArchived,
    getDetail,
    preview,
    publish,
    rollback
  };
}
