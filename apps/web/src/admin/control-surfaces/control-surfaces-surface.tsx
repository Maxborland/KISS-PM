"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { AdminFrame } from "@/admin/ui/admin-frame";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SurfaceState, surfaceStatusOf } from "@/components/domain/surface-state";
import { useAdminRuntime } from "@/admin/lib/admin-runtime";
import { makeRuError } from "@/lib/error-messages";
import { useControlSurfaces } from "./use-control-surfaces";
import type {
  ControlSurfaceDetailResponse,
  ControlSurfacePreview,
  ControlSurfacePreviewResponse,
  ControlSurfaceRecord,
  ControlSurfaceValidationResult
} from "./control-surfaces-client";

// RU-коды ошибок control-surfaces (зеркало controlSurfaceRoutes / доменной валидации).
const surfaceErr = makeRuError({
  control_surface_not_found: "Поверхность не найдена",
  control_surface_version_not_found: "Версия поверхности не найдена",
  control_surface_archived: "Поверхность в архиве — публикация и откат недоступны",
  control_surface_publish_blocked: "Публикация заблокирована: черновик не прошёл валидацию",
  control_surface_version_conflict: "Версия изменилась параллельно — обновите список и повторите",
  control_surface_invalid: "Некорректные данные запроса",
  persistence_not_configured: "Хранилище поверхностей не сконфигурировано на сервере"
}, "Не удалось выполнить действие");

const STATUS_LABEL: Record<ControlSurfaceRecord["status"], string> = {
  draft: "Черновик",
  published: "Опубликована",
  archived: "В архиве"
};

function StatusChip({ status }: { status: ControlSurfaceRecord["status"] }) {
  const label = STATUS_LABEL[status];
  if (status === "published") return <Chip variant="success">{label}</Chip>;
  if (status === "archived") {
    return (
      <span className="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--panel-strong)] px-1.5 py-0.5 text-[length:var(--text-xs)] font-medium text-[var(--muted-soft)]">
        {label}
      </span>
    );
  }
  return <Chip variant="info">{label}</Chip>;
}

// Ожидающие публикации правки: черновик отличается от опубликованного определения
// (или поверхность ещё ни разу не публиковалась). Версии-счётчики для этого не годятся —
// draftVersion всегда на шаг впереди как «слот» следующей публикации.
const hasPendingDraft = (surface: ControlSurfaceRecord): boolean => {
  if (surface.status === "archived") return false;
  if (surface.status === "draft") return true;
  return JSON.stringify(surface.draftDefinition) !== JSON.stringify(surface.publishedDefinition ?? null);
};

// Квитанция действия (публикация/откат): адресуемый auditEventId + итог для комплаенса.
type Receipt = { kind: "publish" | "rollback"; surfaceId: string; auditEventId: string; version: number };

/**
 * Admin «Контрол-поверхности» — операционная поверхность публикации/отката tenant
 * control-surfaces на боевом контракте controlSurfaceRoutes (createControlSurfacesClient +
 * in-memory contract-mock, swap = apiOrigin). Список → предпросмотр валидации черновика →
 * публикация с подтверждением → откат к версии; каждое действие даёт честную квитанцию.
 * Гейты прав — из RBAC роутов (canReadControlSurfaces / canPublishControlSurfaces).
 */
export function AdminControlSurfacesSurface() {
  const { live } = useAdminRuntime();
  const { surfaces, status, error, reload, includeArchived, setIncludeArchived, getDetail, preview, publish, rollback } =
    useControlSurfaces();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ControlSurfaceDetailResponse | null>(null);
  const [previewData, setPreviewData] = useState<ControlSurfacePreviewResponse | null>(null);
  const [detailStatus, setDetailStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);

  // Загрузка карточки+предпросмотра без сброса квитанции (чтобы обновить деталь после мутации).
  const loadDetail = useCallback(
    async (surfaceId: string) => {
      setDetailStatus("loading");
      setDetailError(null);
      const [detailResult, previewResult] = await Promise.all([getDetail(surfaceId), preview(surfaceId)]);
      if (!detailResult.ok) {
        setDetail(null);
        setPreviewData(null);
        setDetailStatus("error");
        setDetailError(detailResult.code);
        return;
      }
      setDetail(detailResult.data);
      setPreviewData(previewResult.ok ? previewResult.data : null);
      setDetailStatus("ready");
    },
    [getDetail, preview]
  );

  // Открытие поверхности пользователем — сбрасывает прежнюю квитанцию.
  const openSurface = useCallback(
    async (surfaceId: string) => {
      setSelectedId(surfaceId);
      setReceipt(null);
      await loadDetail(surfaceId);
    },
    [loadDetail]
  );

  // Обновлённый список (после мутации) может изменить выбранную запись — перечитываем деталь.
  const selected = surfaces.find((surface) => surface.id === selectedId) ?? null;
  useEffect(() => {
    if (selectedId && !surfaces.some((surface) => surface.id === selectedId) && surfaces.length > 0) {
      setSelectedId(null);
      setDetail(null);
      setPreviewData(null);
      setDetailStatus("idle");
    }
  }, [selectedId, surfaces]);

  const runPublish = useCallback(
    async (surfaceId: string) => {
      setBusy(true);
      const result = await publish(surfaceId);
      setBusy(false);
      if (!result.ok) {
        toast.error(surfaceErr(result.code));
        if (result.validation && surfaceId === selectedId) {
          setPreviewData((prev) => (prev ? { ...prev, validation: result.validation! } : prev));
        }
        return;
      }
      toast.success("Поверхность опубликована");
      setReceipt({ kind: "publish", surfaceId, auditEventId: result.data.auditEventId, version: result.data.version.version });
      if (surfaceId === selectedId) await loadDetail(surfaceId);
    },
    [publish, loadDetail, selectedId]
  );

  const runRollback = useCallback(
    async (surfaceId: string, version: number) => {
      setBusy(true);
      const result = await rollback(surfaceId, version);
      setBusy(false);
      if (!result.ok) {
        toast.error(surfaceErr(result.code));
        return;
      }
      toast.success(`Откат к версии ${version} выполнен`);
      setReceipt({ kind: "rollback", surfaceId, auditEventId: result.data.auditEventId, version: result.data.version.version });
      if (surfaceId === selectedId) await loadDetail(surfaceId);
    },
    [rollback, loadDetail, selectedId]
  );

  const surfaceStatus = surfaceStatusOf(status, surfaces.length > 0);

  return (
    <AdminFrame activeTab="Контрол-поверхности" subtitle="Публикация и откат панелей контроля рабочей области">
      {!live ? (
        <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          <span>Реальный контракт: GET/POST /api/tenant/current/control-surfaces/* (createControlSurfacesClient + in-memory contract-mock, swap = apiOrigin). Публикация/откат требуют право tenant.control_surfaces.publish.</span>
        </div>
      ) : null}

      <div className="mb-2 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="size-3.5 accent-[var(--accent)]"
          />
          Показывать архивные
        </label>
      </div>

      <SurfaceState
        status={surfaceStatus}
        error={error}
        onRetry={() => void reload()}
        errorFormat={(c) => surfaceErr(c)}
        empty={{ title: "Поверхностей пока нет", description: "Панели контроля создаются в конструкторе CRM; здесь их публикуют и откатывают." }}
      >
        <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
          <table className="w-full border-collapse text-[length:var(--text-sm)]" data-testid="control-surfaces-table">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
                <th className="px-3 py-2 font-semibold">Поверхность</th>
                <th className="px-3 py-2 font-semibold">Статус</th>
                <th className="px-3 py-2 font-semibold">Версия</th>
                <th className="px-3 py-2 font-semibold">Черновик</th>
                <th className="px-3 py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {surfaces.map((surface) => (
                <tr
                  key={surface.id}
                  className="v4-row border-b border-[var(--border-subtle)] last:border-0"
                  data-selected={surface.id === selectedId ? "true" : undefined}
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-[var(--text-strong)]">{surface.name}</div>
                    <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{surface.code}</div>
                  </td>
                  <td className="px-3 py-2"><StatusChip status={surface.status} /></td>
                  <td className="px-3 py-2 text-[var(--muted-strong)]">{surface.currentVersion > 0 ? `v${surface.currentVersion}` : "—"}</td>
                  <td className="px-3 py-2">
                    {hasPendingDraft(surface) ? (
                      <Chip variant="warning">Есть неопубликованные правки</Chip>
                    ) : (
                      <span className="text-[var(--muted-soft)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button type="button" size="sm" variant={surface.id === selectedId ? "secondary" : "ghost"} onClick={() => void openSurface(surface.id)}>
                      {surface.id === selectedId ? "Скрыть" : "Открыть"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedId ? (
          <ControlSurfaceDetailPanel
            surface={selected}
            detail={detail}
            previewData={previewData}
            detailStatus={detailStatus}
            detailError={detailError}
            receipt={receipt && receipt.surfaceId === selectedId ? receipt : null}
            busy={busy}
            onPublish={runPublish}
            onRollback={runRollback}
            onRetry={() => void openSurface(selectedId)}
          />
        ) : null}
      </SurfaceState>
    </AdminFrame>
  );
}

function ControlSurfaceDetailPanel({
  surface,
  detail,
  previewData,
  detailStatus,
  detailError,
  receipt,
  busy,
  onPublish,
  onRollback,
  onRetry
}: {
  surface: ControlSurfaceRecord | null;
  detail: ControlSurfaceDetailResponse | null;
  previewData: ControlSurfacePreviewResponse | null;
  detailStatus: "idle" | "loading" | "ready" | "error";
  detailError: string | null;
  receipt: Receipt | null;
  busy: boolean;
  onPublish: (surfaceId: string) => void | Promise<void>;
  onRollback: (surfaceId: string, version: number) => void | Promise<void>;
  onRetry: () => void;
}) {
  if (detailStatus === "loading") {
    return (
      <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] px-4 py-6 text-center text-[length:var(--text-sm)] text-[var(--muted-soft)]" data-testid="control-surface-detail">
        Загружаем поверхность…
      </div>
    );
  }
  if (detailStatus === "error" || !surface || !detail) {
    return (
      <div className="mt-4 flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--danger-muted)] bg-[var(--panel)] px-4 py-3 text-[length:var(--text-sm)] text-[var(--muted-strong)]" data-testid="control-surface-detail">
        <span>{surfaceErr(detailError ?? "control_surface_not_found")}</span>
        <Button type="button" size="sm" variant="ghost" onClick={onRetry}>Повторить</Button>
      </div>
    );
  }

  const validation = previewData?.validation;
  const pending = hasPendingDraft(surface);
  const canPublish = surface.status !== "archived" && pending && Boolean(validation?.canPublish);
  const versions = [...(detail.versions ?? [])].sort((a, b) => b.version - a.version);

  return (
    <div className="mt-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]" data-testid="control-surface-detail">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
        <div className="min-w-0">
          <div className="text-[length:var(--text-base)] font-semibold text-[var(--text-strong)]">{surface.name}</div>
          <div className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{surface.code} · {surface.id}</div>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip status={surface.status} />
          <ConfirmDialog
            title="Опубликовать черновик?"
            description={`Черновик поверхности «${surface.name}» станет активной версией v${surface.draftVersion}. Действие фиксируется в журнале аудита.`}
            confirmLabel="Опубликовать"
            destructive={false}
            onConfirm={() => onPublish(surface.id)}
          >
            <Button type="button" size="sm" variant="primary" disabled={!canPublish || busy} data-testid="control-surface-publish">
              Опубликовать
            </Button>
          </ConfirmDialog>
        </div>
      </div>

      <div className="px-4 py-3">
        {receipt ? (
          <div className="mb-3 rounded-[var(--radius-md)] border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--muted-strong)]" data-testid="control-surface-receipt">
            <span className="font-semibold text-[var(--text-strong)]">
              {receipt.kind === "publish" ? "Опубликовано" : "Откат выполнен"}: активная версия v{receipt.version}.
            </span>{" "}
            Квитанция аудита: <span className="v4-mono break-all">{receipt.auditEventId}</span>
          </div>
        ) : null}

        {/* Предпросмотр валидации черновика */}
        <ValidationSummary
          validation={validation}
          preview={previewData?.preview}
          archived={surface.status === "archived"}
          pending={pending}
        />

        {/* История версий + откат */}
        <div className="mt-4">
          <div className="mb-1 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">История версий</div>
          {versions.length === 0 ? (
            <p className="text-[length:var(--text-sm)] text-[var(--muted-soft)]">Поверхность ещё не публиковалась — версий нет.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-md)] border border-[var(--border-subtle)]" data-testid="control-surface-versions">
              {versions.map((version) => {
                const isCurrent = version.version === surface.currentVersion;
                return (
                  <li key={version.version} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0 text-[length:var(--text-sm)]">
                      <span className="font-medium text-[var(--text-strong)]">v{version.version}</span>
                      {isCurrent ? <Chip variant="success" className="ml-2">Активна</Chip> : null}
                      <span className="ml-2 text-[length:var(--text-xs)] text-[var(--muted-soft)]">{fmtDate(version.createdAt)}</span>
                    </div>
                    {surface.status !== "archived" && !isCurrent ? (
                      <ConfirmDialog
                        title={`Откатить к версии v${version.version}?`}
                        description={`Активной станет копия версии v${version.version} поверхности «${surface.name}». Действие фиксируется в журнале аудита.`}
                        confirmLabel="Откатить"
                        destructive={false}
                        onConfirm={() => onRollback(surface.id, version.version)}
                      >
                        <Button type="button" size="sm" variant="ghost" disabled={busy} data-testid={`control-surface-rollback-${version.version}`}>
                          Откатить сюда
                        </Button>
                      </ConfirmDialog>
                    ) : (
                      <span className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">{isCurrent ? "текущая" : "—"}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ValidationSummary({
  validation,
  preview,
  archived,
  pending
}: {
  validation: ControlSurfaceValidationResult | undefined;
  preview: ControlSurfacePreview | undefined;
  archived: boolean;
  pending: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-subtle)] px-3 py-2" data-testid="control-surface-preview">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Предпросмотр черновика</span>
        {archived ? (
          <span className="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--panel-strong)] px-1.5 py-0.5 text-[length:var(--text-xs)] font-medium text-[var(--muted-soft)]">
            Архив — публикация недоступна
          </span>
        ) : validation?.canPublish ? (
          <Chip variant="success">Готов к публикации</Chip>
        ) : (
          <Chip variant="warning">Есть замечания</Chip>
        )}
        {!archived && !pending ? (
          <span className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Черновик совпадает с опубликованной версией — публиковать нечего.</span>
        ) : null}
      </div>
      {preview ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span>Источник: {preview.dataSource}</span>
          <span>Сущность: {preview.entityType}</span>
          <span>Вид: {preview.viewType}</span>
          <span>Видимых полей: {preview.visibleFieldCount}</span>
          <span>Действий: {preview.actionCount}</span>
        </div>
      ) : null}
      {validation && validation.issues.length > 0 ? (
        <ul className="mt-2 space-y-1 text-[length:var(--text-xs)]">
          {validation.issues.map((issue) => (
            <li key={`${issue.code}-${issue.path}`} className="flex items-start gap-1.5">
              <span className={issue.severity === "error" ? "text-[var(--danger)]" : "text-[var(--warning)]"}>
                {issue.severity === "error" ? "Ошибка" : "Предупреждение"}
              </span>
              <span className="text-[var(--muted-strong)]">{issue.message}</span>
              <span className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{issue.path}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
};
