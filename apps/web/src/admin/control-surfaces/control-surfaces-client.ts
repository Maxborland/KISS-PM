/* ============================================================
   Control-surfaces API client — тонкий типизированный клиент над боевыми
   ручками tenant control-surfaces (apps/api/src/controlSurfaceRoutes.ts):
     GET  /api/tenant/current/control-surfaces            (список, canReadControlSurfaces)
     GET  /api/tenant/current/control-surfaces/:id        (карточка + версии)
     POST /api/tenant/current/control-surfaces/:id/preview (валидация чернового определения)
     POST /api/tenant/current/control-surfaces/:id/publish (публикация, canPublishControlSurfaces)
     POST /api/tenant/current/control-surfaces/:id/rollback (откат к версии)

   Зеркало createAdminClient/createOrgStructureClient: тот же приём с инъекцией
   fetchImpl (contract-mock в тестах/сторибуке) и same-origin заголовками.
   Типы записей берём из @kiss-pm/domain (единый источник, без дрейфа).
   ============================================================ */

import type {
  ControlSurfaceDataSourceKey,
  ControlSurfaceEntityType,
  ControlSurfaceRecord,
  ControlSurfaceValidationResult,
  ControlSurfaceVersionRecord,
  ControlSurfaceViewType
} from "@kiss-pm/domain";

import { createRequestJson, type DomainClientOptions } from "../../lib/domain-client";

export type {
  ControlSurfaceRecord,
  ControlSurfaceVersionRecord,
  ControlSurfaceValidationResult
} from "@kiss-pm/domain";

export type ControlSurfacesClientOptions = DomainClientOptions;

// Компактная сводка предпросмотра (боевой preview-ответ): состав определения без полного рендера.
export type ControlSurfacePreview = {
  dataSource: ControlSurfaceDataSourceKey;
  entityType: ControlSurfaceEntityType;
  viewType: ControlSurfaceViewType;
  visibleFieldCount: number;
  actionCount: number;
};

export type ControlSurfaceListResponse = { surfaces: ControlSurfaceRecord[] };
export type ControlSurfaceDetailResponse = {
  surface: ControlSurfaceRecord;
  versions?: ControlSurfaceVersionRecord[];
};
export type ControlSurfacePreviewResponse = {
  validation: ControlSurfaceValidationResult;
  preview: ControlSurfacePreview;
};
export type ControlSurfacePublishResponse = {
  surface: ControlSurfaceRecord;
  version: ControlSurfaceVersionRecord;
  validation: ControlSurfaceValidationResult;
  auditEventId: string;
};
export type ControlSurfaceRollbackResponse = {
  surface: ControlSurfaceRecord;
  version: ControlSurfaceVersionRecord;
  auditEventId: string;
};

export function createControlSurfacesClient(options: ControlSurfacesClientOptions) {
  const requestJson = createRequestJson(options);
  const enc = encodeURIComponent;
  const base = "/api/tenant/current/control-surfaces";
  return {
    // Список поверхностей тенанта (includeArchived — показать архивные тоже).
    listControlSurfaces(includeArchived = false) {
      const query = includeArchived ? "?includeArchived=true" : "";
      return requestJson<ControlSurfaceListResponse>(`${base}${query}`);
    },
    // Карточка поверхности + история версий (для читателей builder-state).
    getControlSurface(surfaceId: string) {
      return requestJson<ControlSurfaceDetailResponse>(`${base}/${enc(surfaceId)}`);
    },
    // Предпросмотр чернового определения (валидация + сводка), пустое тело = хранимый черновик.
    previewControlSurface(surfaceId: string) {
      return requestJson<ControlSurfacePreviewResponse>(`${base}/${enc(surfaceId)}/preview`, {
        method: "POST",
        body: JSON.stringify({})
      });
    },
    // Публикация хранимого черновика (canPublishControlSurfaces). 409 при блокировке валидацией/архиве.
    publishControlSurface(surfaceId: string) {
      return requestJson<ControlSurfacePublishResponse>(`${base}/${enc(surfaceId)}/publish`, {
        method: "POST",
        body: JSON.stringify({})
      });
    },
    // Откат опубликованной поверхности к выбранной версии (canPublishControlSurfaces).
    rollbackControlSurface(surfaceId: string, version: number) {
      return requestJson<ControlSurfaceRollbackResponse>(`${base}/${enc(surfaceId)}/rollback`, {
        method: "POST",
        body: JSON.stringify({ version })
      });
    }
  };
}

export type ControlSurfacesClient = ReturnType<typeof createControlSurfacesClient>;
