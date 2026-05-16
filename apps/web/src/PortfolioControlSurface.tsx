import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CurrentTenantDto } from "./phase2ApiClient";
import {
  controlSeverityLabel,
  type ControlSurfaceReadActionDto,
  type ControlSurfaceReadModelDto,
  type ControlSurfaceReadRowDto,
  type PortfolioActionDefinitionDto,
  type PortfolioActionPreviewDto,
  type PortfolioControlApiClient,
  type PortfolioControlAuditDto
} from "./portfolioControlApiClient";

type PortfolioControlSurfaceProps = {
  apiClient: PortfolioControlApiClient;
  currentTenant: CurrentTenantDto;
  testUser: string;
  surfaceId?: string;
  onOpenGanttProject?: (projectId: string) => void;
};

const portfolioQueryKeys = {
  view: (testUser: string, surfaceId: string) => ["portfolio-control", testUser, surfaceId, "view"] as const,
  actions: (testUser: string, surfaceId: string) => ["portfolio-control", testUser, surfaceId, "actions"] as const,
  audit: (testUser: string, canReadAudit: boolean) => ["portfolio-control", testUser, "audit", { canReadAudit }] as const
};

function hasPermission(currentTenant: CurrentTenantDto, permissionKey: string): boolean {
  return currentTenant.permissions.includes(permissionKey);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Не удалось выполнить действие";
}

function stringifyRecord(value: Record<string, unknown> | null): string {
  if (value === null) return "нет";
  return Object.entries(value)
    .map(([key, entry]) => `${key}: ${typeof entry === "object" ? JSON.stringify(entry) : String(entry)}`)
    .join(" / ");
}

function projectIdFromRow(row: ControlSurfaceReadRowDto): string | null {
  const projectRef = row.sourceRefs.find((sourceRef) => sourceRef.entityType === "project");
  if (projectRef) return projectRef.entityId;
  const projectField = row.fieldValues.project_label;
  return typeof projectField === "string" && projectField.length > 0 ? projectField : null;
}

function actionDefinitionForSlot(
  actions: PortfolioActionDefinitionDto[],
  slot: ControlSurfaceReadActionDto
): PortfolioActionDefinitionDto | null {
  return actions.find((action) => action.key === slot.actionDefinitionKey || action.id === slot.actionDefinitionKey) ?? null;
}

function rowStringField(row: ControlSurfaceReadRowDto | undefined, key: string): string {
  const value = row?.fieldValues[key];
  return typeof value === "string" ? value : "";
}

function createInputForAction(action: PortfolioActionDefinitionDto, row?: ControlSurfaceReadRowDto): Record<string, unknown> {
  if (action.key === "accept_risk") {
    return {
      reason: "Контролируемый риск до перепланирования",
      expiresAt: "2026-06-30"
    };
  }

  if (action.key === "reassign_resource") {
    return {
      assignmentId: rowStringField(row, "primary_assignment_id"),
      targetResourceProfileId: rowStringField(row, "suggested_resource_profile_id"),
      reason: "Снять перегрузку через управляемое переназначение"
    };
  }

  if (action.key === "shift_work") {
    return {
      assignmentId: rowStringField(row, "primary_assignment_id"),
      shiftDays: 7,
      reason: "Снять перегрузку через управляемый сдвиг"
    };
  }

  if (action.key === "split_work") {
    return {
      assignmentId: rowStringField(row, "primary_assignment_id"),
      splitHours: 6,
      reason: "Снять перегрузку через разделение работы"
    };
  }

  if (action.key === "accept_resource_overload") {
    return {
      reason: "Принять ресурсный риск до перепланирования"
    };
  }

  if (action.key === "create_corrective_action") {
    return {
      title: "Корректирующее действие по контрольному сигналу",
      dueDate: "2026-06-12"
    };
  }

  return Object.fromEntries(action.inputSchema.fields.map((field) => [field.key, field.valueType === "number" ? 0 : field.label]));
}

function actionLine(action: ControlSurfaceReadActionDto): string {
  if (action.available) return `${action.label}${action.dryRunRequired ? " / dry-run" : ""}`;
  return `${action.label}: ${action.unavailableReason === "permission_denied" ? "нет права" : "не рекомендовано"}`;
}

function latestAction(audit: PortfolioControlAuditDto): string {
  const actionExecution = audit.actionExecutions.at(-1);
  if (!actionExecution) return "Нет action evidence";
  const target = actionExecution.target ?? actionExecution.source;
  return `${actionExecution.commandType}: ${actionExecution.status} / ${actionExecution.requiredPermission} / ${target.entityId}`;
}

function RowList({
  activeRowId,
  onSelectRow,
  rows
}: {
  activeRowId: string | null;
  onSelectRow(rowId: string): void;
  rows: ControlSurfaceReadRowDto[];
}) {
  if (rows.length === 0) {
    return (
      <div className="compact-list" data-testid="portfolio-control-empty">
        Нет контрольных сигналов. Портфельная поверхность покажет KPI и ресурсные риски после появления данных.
      </div>
    );
  }

  return (
    <div className="compact-list portfolio-row-list" data-testid="portfolio-control-row-list">
      {rows.map((row) => (
        <button
          className={`kpi-signal-card portfolio-control-row ${row.id === activeRowId ? "active" : ""}`}
          key={row.id}
          onClick={() => onSelectRow(row.id)}
          type="button"
        >
          <strong>{controlSeverityLabel(row.severity)}</strong>
          <span>{row.fieldValues.project_label ?? row.entityId}</span>
          <span>{row.explanation}</span>
          <span>{row.entityType}:{row.entityId}</span>
        </button>
      ))}
    </div>
  );
}

function DetailPanel({
  onOpenGanttProject,
  row
}: {
  onOpenGanttProject?: (projectId: string) => void;
  row: ControlSurfaceReadRowDto;
}) {
  const projectId = projectIdFromRow(row);
  const ganttDrilldown = row.drilldowns.find((drilldown) => drilldown.key === "open_project_gantt");
  return (
    <section className="phase2-panel portfolio-detail-panel" data-testid="portfolio-control-detail">
      <div className="surface-heading compact">
        <div>
          <h3>Контрольный сигнал</h3>
          <p>{row.id}</p>
        </div>
        <span className={`signal-severity-badge severity-${row.severity === "attention" ? "watch" : row.severity}`}>
          {controlSeverityLabel(row.severity)}
        </span>
      </div>
      <dl className="compact-facts">
        <div>
          <dt>Объект</dt>
          <dd>{row.entityType}:{row.entityId}</dd>
        </div>
        <div>
          <dt>Проект</dt>
          <dd>{projectId ?? "не связан"}</dd>
        </div>
        <div>
          <dt>Сигнал</dt>
          <dd>{row.fieldValues.signal_label ?? row.label}</dd>
        </div>
        <div>
          <dt>Источник</dt>
          <dd>{row.sourceRefs.map((sourceRef) => `${sourceRef.entityType}:${sourceRef.entityId}`).join(" / ")}</dd>
        </div>
      </dl>
      {ganttDrilldown?.available && projectId ? (
        <button className="secondary-button" type="button" onClick={() => onOpenGanttProject?.(projectId)}>
          Открыть Гантт
        </button>
      ) : (
        <p className="readonly-notice">Переход в Гантт недоступен политикой доступа.</p>
      )}
    </section>
  );
}

export function PortfolioControlSurface({
  apiClient,
  currentTenant,
  onOpenGanttProject,
  surfaceId = "portfolio-control",
  testUser
}: PortfolioControlSurfaceProps) {
  const queryClient = useQueryClient();
  const canReadSurface = hasPermission(currentTenant, "control.surface:read");
  const canReadAudit = hasPermission(currentTenant, "audit.read");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedActionKey, setSelectedActionKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<PortfolioActionPreviewDto | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [commandError, setCommandError] = useState("");
  const [status, setStatus] = useState("Загрузка портфельного контроля");

  const viewQuery = useQuery<ControlSurfaceReadModelDto>({
    queryKey: portfolioQueryKeys.view(testUser, surfaceId),
    queryFn: () => apiClient.getSurfaceView(testUser, surfaceId),
    enabled: canReadSurface,
    retry: false
  });
  const actionsQuery = useQuery<PortfolioActionDefinitionDto[]>({
    queryKey: portfolioQueryKeys.actions(testUser, surfaceId),
    queryFn: () => apiClient.listSurfaceActions(testUser, surfaceId),
    enabled: canReadSurface,
    retry: false
  });
  const auditQuery = useQuery<PortfolioControlAuditDto>({
    queryKey: portfolioQueryKeys.audit(testUser, canReadAudit),
    queryFn: () => apiClient.getControlAudit(testUser),
    enabled: canReadSurface && canReadAudit,
    retry: false
  });
  const previewMutation = useMutation({
    mutationFn: ({
      actionDefinition,
      row
    }: {
      actionDefinition: PortfolioActionDefinitionDto;
      row: ControlSurfaceReadRowDto;
    }) =>
      apiClient.previewAction(testUser, actionDefinition.id, {
        target: {
          surfaceId: viewQuery.data?.surface.id ?? surfaceId,
          surfaceKey: viewQuery.data?.surface.key ?? "portfolio.control",
          rowId: row.id,
          entityType: row.entityType,
          entityId: row.entityId
        },
        input: createInputForAction(actionDefinition, row)
      })
  });
  const executeMutation = useMutation({
    mutationFn: ({ actionDefinition, previewId }: { actionDefinition: PortfolioActionDefinitionDto; previewId: string }) =>
      apiClient.executeAction(testUser, actionDefinition.id, { previewId })
  });

  const view = viewQuery.data;
  const rows = view?.rows ?? [];
  const activeRow = rows.find((row) => row.id === (selectedRowId ?? rows[0]?.id)) ?? null;
  const availableActions = activeRow?.actions.filter((action) => action.available) ?? [];
  const allActions = actionsQuery.data ?? [];
  const activeAction =
    availableActions.find((action) => action.key === selectedActionKey) ?? availableActions[0] ?? activeRow?.actions[0] ?? null;
  const activeDefinition = activeAction ? actionDefinitionForSlot(allActions, activeAction) : null;
  const selectedActionAvailable = Boolean(activeAction?.available && activeDefinition);
  const displayStatus = viewQuery.isFetching && !view ? "Загрузка портфельного контроля" : status;
  const audit = auditQuery.data ?? { events: [], actionExecutions: [] };

  if (!canReadSurface) {
    return (
      <section className="portfolio-control-surface" data-testid="portfolio-control-denied" id="portfolio-control">
        <div className="surface-heading">
          <div>
            <h2>Портфельный контроль</h2>
            <p>Нет доступа к контрольным поверхностям. Портфельные сигналы скрыты политикой доступа.</p>
          </div>
          <p className="status-pill">Доступ закрыт</p>
        </div>
      </section>
    );
  }

  async function refetchReadback(nextStatus: string): Promise<string | null> {
    try {
      await viewQuery.refetch({ throwOnError: true });
      if (canReadAudit) {
        await auditQuery.refetch({ throwOnError: true });
      }
      setStatus(nextStatus);
      return null;
    } catch (error) {
      const message = getErrorMessage(error);
      setStatus("Readback не подтвержден");
      return message;
    }
  }

  async function previewAction() {
    if (!activeRow || !activeDefinition || !selectedActionAvailable) return;
    setCommandError("");
    setLastResult(null);
    setStatus("Готовим dry-run preview");
    try {
      const nextPreview = await previewMutation.mutateAsync({ actionDefinition: activeDefinition, row: activeRow });
      setPreview(nextPreview);
      setStatus("Preview готов: no mutation");
    } catch (error) {
      setCommandError(getErrorMessage(error));
      setPreview(null);
      setStatus("Preview не выполнен");
    }
  }

  async function applyPreview() {
    if (!activeDefinition || !preview) return;
    setCommandError("");
    setStatus("Выполняем управляемую команду");
    try {
      const result = await executeMutation.mutateAsync({ actionDefinition: activeDefinition, previewId: preview.id });
      await viewQuery.refetch({ throwOnError: true });
      if (canReadAudit) {
        const auditReadback = await apiClient.getControlAudit(testUser);
        const verifiedAction = auditReadback.actionExecutions.find(
          (actionExecution) => actionExecution.correlationId === result.result.correlationId
        );
        if (!verifiedAction) {
          throw new Error("Команда выполнена, но audit/readback не подтвердил action evidence");
        }
        queryClient.setQueryData(portfolioQueryKeys.audit(testUser, canReadAudit), auditReadback);
        setLastResult(`${verifiedAction.commandType}: ${verifiedAction.status}`);
      } else {
        setLastResult(`${result.result.commandType}: ${result.result.status} / audit.read недоступен`);
      }
      setPreview(null);
      setStatus(canReadAudit ? "Команда применена и подтверждена readback" : "Команда применена, аудит скрыт правами");
    } catch (error) {
      const executionError = getErrorMessage(error);
      setLastResult(null);
      const readbackError = await refetchReadback("Команда не применена, readback обновлен");
      setCommandError(readbackError ? `${executionError}; readback: ${readbackError}` : executionError);
    }
  }

  function selectRow(rowId: string) {
    setSelectedRowId(rowId);
    setSelectedActionKey(null);
    setPreview(null);
    setLastResult(null);
    setCommandError("");
  }

  return (
    <section className="portfolio-control-surface" data-testid="portfolio-control-surface" id="portfolio-control">
      <div className="surface-heading">
        <div>
          <h2>Портфельный контроль</h2>
          <p>Единая поверхность для KPI-сигналов, ресурсных конфликтов и управляемых действий.</p>
        </div>
        <p className="status-pill" data-testid="portfolio-control-status">
          {displayStatus}
        </p>
      </div>

      {viewQuery.isError ? (
        <p className="readonly-notice" data-testid="portfolio-control-error">
          {getErrorMessage(viewQuery.error)}
        </p>
      ) : null}

      {actionsQuery.isError ? (
        <p className="readonly-notice" data-testid="portfolio-control-actions-error">
          {getErrorMessage(actionsQuery.error)}
        </p>
      ) : null}

      {auditQuery.isError ? (
        <p className="readonly-notice" data-testid="portfolio-control-audit-error">
          {getErrorMessage(auditQuery.error)}
        </p>
      ) : null}

      <div className="portfolio-control-layout">
        <section className="phase2-panel portfolio-overview-panel">
          <div className="surface-heading compact">
            <div>
              <h3>{view?.surface.label ?? "Контроль портфеля"}</h3>
              <p>{view ? `${view.surface.key}@${view.surface.version}` : "Поверхность загружается"}</p>
            </div>
          </div>
          <div className="portfolio-widget-grid">
            {(view?.widgets ?? []).map((widget) => (
              <div className="portfolio-widget" data-testid={`portfolio-control-widget-${widget.key}`} key={widget.key}>
                <span>{widget.label}</span>
                <strong>{widget.value}</strong>
              </div>
            ))}
          </div>
          <RowList activeRowId={activeRow?.id ?? null} onSelectRow={selectRow} rows={rows} />
        </section>

        <section className="phase2-panel portfolio-action-panel" data-testid="portfolio-control-action-panel">
          {activeRow ? <DetailPanel onOpenGanttProject={onOpenGanttProject} row={activeRow} /> : null}

          {activeRow ? (
            <>
              <div className="compact-list">
                {activeRow.actions.map((action) =>
                  action.available ? (
                    <button
                      className={action.key === activeAction?.key ? "" : "secondary-button"}
                      key={action.key}
                      onClick={() => {
                        setSelectedActionKey(action.key);
                        setPreview(null);
                        setLastResult(null);
                        setCommandError("");
                      }}
                      type="button"
                    >
                      {action.label}
                    </button>
                  ) : (
                    <span key={action.key}>{actionLine(action)}</span>
                  )
                )}
              </div>

              {availableActions.length === 0 ? (
                <p className="readonly-notice" data-testid="portfolio-control-readonly">
                  Действия недоступны: backend policy не выдал доступных команд для этого пользователя.
                </p>
              ) : null}

              {activeAction && activeDefinition ? (
                <section className="preview-panel phase2-panel">
                  <h3>Следующее управляемое действие</h3>
                  <p>
                    {activeDefinition.label} / {activeDefinition.commandType} /{" "}
                    {activeDefinition.requiredPermission}
                  </p>
                  <div className="button-row">
                    {selectedActionAvailable ? (
                      <button disabled={previewMutation.isPending || executeMutation.isPending} onClick={() => void previewAction()} type="button">
                        Предпросмотр
                      </button>
                    ) : null}
                    {preview && selectedActionAvailable ? (
                      <button disabled={executeMutation.isPending} onClick={() => void applyPreview()} type="button">
                        Применить после preview
                      </button>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {preview ? (
                <section className="phase2-panel preview-panel" data-testid="portfolio-control-preview">
                  <h3>Dry-run preview</h3>
                  <p>{preview.id} / no mutation / {preview.commandType}</p>
                  <dl className="compact-facts">
                    <div>
                      <dt>До</dt>
                      <dd>{stringifyRecord(preview.before)}</dd>
                    </div>
                    <div>
                      <dt>После</dt>
                      <dd>{stringifyRecord(preview.after)}</dd>
                    </div>
                    <div>
                      <dt>State version</dt>
                      <dd>{preview.stateVersion}</dd>
                    </div>
                    <div>
                      <dt>Право</dt>
                      <dd>{preview.requiredPermission}</dd>
                    </div>
                  </dl>
                </section>
              ) : null}
            </>
          ) : null}

          <p data-testid="portfolio-control-command-error">{commandError || "Ошибок нет"}</p>
          <p data-testid="portfolio-control-result">{lastResult ?? "Команда еще не применялась"}</p>
          <section className="phase2-panel" data-testid="portfolio-control-audit">
            <h3>Action evidence</h3>
            <p>{canReadAudit ? latestAction(audit) : "Аудит недоступен"}</p>
          </section>
        </section>
      </div>
    </section>
  );
}
