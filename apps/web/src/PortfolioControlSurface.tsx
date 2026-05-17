import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CurrentTenantDto } from "./phase2ApiClient";
import {
  ActionAuditPreview,
  KPIStrip,
  OperationalDataGrid,
  OperationalSurfaceShell,
  SignalSummaryBar,
  type OperationalGridColumn,
  type OperationalGridRow,
  type OperationalSeverity,
  type OperationalSurfaceState
} from "./operationalSurfacePrimitives";
import {
  controlSeverityLabel,
  type ControlSeverityDto,
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

function createInputForAction(
  action: PortfolioActionDefinitionDto,
  row: ControlSurfaceReadRowDto | undefined,
  currentTenant: CurrentTenantDto
): Record<string, unknown> {
  if (action.key === "accept_risk") {
    return {
      reason: "Контролируемый риск до перепланирования",
      expiresAt: "2026-06-30"
    };
  }

  if (action.key === "escalate") {
    return {
      reason: "Нужно решение управляющего комитета",
      escalationLevel: "steering_committee"
    };
  }

  if (action.key === "request_explanation") {
    return {
      reason: "Нужен комментарий по отклонению",
      requestedFrom: currentTenant.actor.id
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
  if (action.unavailableReason === "permission_denied") return `${action.label}: нет права`;
  if (action.unavailableReason === "configuration_disabled") return `${action.label}: отключено конфигурацией`;
  return `${action.label}: не рекомендовано`;
}

const portfolioGridColumns: OperationalGridColumn[] = [
  { key: "severity", label: "Риск", group: "Сигнал", sticky: "left", width: 120 },
  { key: "object", label: "Объект", group: "Сигнал", width: 240 },
  { key: "signal", label: "Сигнал", group: "Сигнал", width: 260 },
  { key: "project", label: "Проект", group: "Источник", width: 180 },
  { key: "source", label: "Источник", group: "Источник", width: 300 },
  { key: "nextAction", label: "Следующее действие", group: "Действие", width: 220 },
  { key: "readback", label: "Readback", group: "Действие", width: 190 }
];

function primaryRowAction(row: ControlSurfaceReadRowDto): ControlSurfaceReadActionDto | null {
  return row.actions.find((action) => action.available) ?? row.actions[0] ?? null;
}

function sourceRefsLine(row: ControlSurfaceReadRowDto): string {
  return row.sourceRefs.map((sourceRef) => `${sourceRef.entityType}:${sourceRef.entityId}`).join(" / ");
}

function gridSignalLabel(row: ControlSurfaceReadRowDto): string {
  if (row.entityType === "resource_overload") {
    const resourceName = rowStringField(row, "resourceName");
    return `${row.explanation} / ресурс: ${resourceName || row.entityId}`;
  }

  return row.explanation;
}

function PortfolioOperationalGrid({
  activeRowId,
  onSelectRow,
  rows
}: {
  activeRowId: string | null;
  onSelectRow: (rowId: string) => void;
  rows: ControlSurfaceReadRowDto[];
}) {
  const gridRows: OperationalGridRow[] = rows.map((row) => {
    const nextAction = primaryRowAction(row);

    return {
      id: row.id,
      label: row.label,
      severity: operationalSeverity(row.severity),
      values: {
        severity: controlSeverityLabel(row.severity),
        object: `${row.entityType}:${row.entityId}`,
        signal: gridSignalLabel(row),
        project: projectIdFromRow(row) ?? "не связан",
        source: sourceRefsLine(row),
        nextAction: nextAction ? actionLine(nextAction) : "нет действия",
        readback: "Preview/result/readback обязателен"
      },
      actions: []
    };
  });

  return (
    <OperationalDataGrid
      columns={portfolioGridColumns}
      emptyLabel="Нет контрольных сигналов. Портфельная поверхность покажет KPI и ресурсные риски после появления данных."
      rows={gridRows}
      selectedRowId={activeRowId}
      onSelectRow={onSelectRow}
    />
  );
}

function PortfolioNextActionContract({
  action,
  definition,
  row
}: {
  action: ControlSurfaceReadActionDto | null;
  definition: PortfolioActionDefinitionDto | null;
  row: ControlSurfaceReadRowDto | null;
}) {
  if (row === null || action === null) {
    return (
      <section className="phase2-panel portfolio-next-action-contract" data-testid="portfolio-control-next-action">
        <h3>Следующее действие</h3>
        <p>Нет выбранного контрольного сигнала.</p>
      </section>
    );
  }

  return (
    <section className="phase2-panel portfolio-next-action-contract" data-testid="portfolio-control-next-action">
      <h3>Следующее действие</h3>
      <div className="compact-list">
        <span>Объект: {row.entityType}:{row.entityId}</span>
        <span>Следующее действие: {action.label}</span>
        <span>Право: {definition?.requiredPermission ?? (action.available ? "определяется action definition" : actionLine(action))}</span>
        <span>Источник: {sourceRefsLine(row) || "нет"}</span>
        <span>{action.dryRunRequired ? "Dry-run preview обязателен" : "Preview/result/readback обязателен"}</span>
      </div>
    </section>
  );
}

function latestAction(audit: PortfolioControlAuditDto): string {
  const actionExecution = audit.actionExecutions.at(-1);
  if (!actionExecution) return "Нет action evidence";
  const target = actionExecution.target ?? actionExecution.source;
  return `${actionExecution.commandType}: ${actionExecution.status} / ${actionExecution.requiredPermission} / ${target.entityId}`;
}

function operationalSeverity(severity: ControlSeverityDto | undefined): OperationalSeverity {
  if (severity === "critical" || severity === "warning" || severity === "attention") return severity;
  return "ok";
}

const severityRank: Record<OperationalSeverity, number> = {
  ok: 0,
  attention: 1,
  warning: 2,
  critical: 3
};

function mostSevereRow(rows: ControlSurfaceReadRowDto[], excludedRowId?: string | null): ControlSurfaceReadRowDto | null {
  return rows
    .filter((row) => row.id !== excludedRowId && row.severity !== "none")
    .reduce<ControlSurfaceReadRowDto | null>((currentHighest, row) => {
      if (currentHighest === null) return row;
      return severityRank[operationalSeverity(row.severity)] > severityRank[operationalSeverity(currentHighest.severity)]
        ? row
        : currentHighest;
    }, null);
}

function operationalState({
  activeRow,
  canReadSurface,
  commandError,
  isError,
  isFetching,
  lastResult,
  rows
}: {
  activeRow: ControlSurfaceReadRowDto | null;
  canReadSurface: boolean;
  commandError: string;
  isError: boolean;
  isFetching: boolean;
  lastResult: string | null;
  rows: ControlSurfaceReadRowDto[];
}): OperationalSurfaceState {
  if (!canReadSurface) return "permission_denied";
  if (isError) return "error";
  if (commandError) return "apply_failed";
  if (lastResult) return "applied";
  if (isFetching && rows.length === 0) return "loading";
  if (rows.length === 0) return "empty";
  if (!activeRow) return "empty";
  return "ready";
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
        input: createInputForAction(actionDefinition, row, currentTenant)
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
  const highestRiskRow = mostSevereRow(rows);
  const nextRiskRow = mostSevereRow(rows, activeRow?.id) ?? highestRiskRow;

  if (!canReadSurface) {
    return (
      <section className="portfolio-control-surface" data-testid="portfolio-control-denied" id="portfolio-control">
        <OperationalSurfaceShell
          description="Портфельные сигналы скрыты политикой доступа."
          primaryActionDisabledReason="Нет права control.surface:read"
          primaryActionLabel="Открыть поверхность"
          state="permission_denied"
          statusLabel="Доступ закрыт"
          title="Портфельный контроль"
        >
          <span>Пользователь видит причину запрета вместо пустой или сломанной панели.</span>
        </OperationalSurfaceShell>
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
      <OperationalSurfaceShell
        audit={
          <section className="phase2-panel" data-testid="portfolio-control-audit">
            <h3>Action evidence</h3>
            {canReadAudit && audit.actionExecutions.at(-1) ? (
              <ActionAuditPreview
                actionExecutionId={audit.actionExecutions.at(-1)?.id ?? "unknown"}
                actorLabel={audit.actionExecutions.at(-1)?.actorId}
                readbackLabel="Audit/readback projection refreshed"
                resultLabel={latestAction(audit)}
                targetLabel={(audit.actionExecutions.at(-1)?.target ?? audit.actionExecutions.at(-1)?.source)?.entityId}
              />
            ) : (
              <p>{canReadAudit ? latestAction(audit) : "Аудит недоступен"}</p>
            )}
          </section>
        }
        description="Единая поверхность для KPI-сигналов, ресурсных конфликтов и управляемых действий."
        freshnessLabel={view ? `surface v${view.surface.version} / ${view.surface.updatedAt}` : "Поверхность загружается"}
        objectLabel="ControlSurface"
        readbackLabel={
          lastResult ? "Readback подтвержден после управляемой команды" : "Reload/readback обязателен после mutation"
        }
        signal={
          <SignalSummaryBar
            disabledReason={activeRow ? undefined : "Нет выбранного контрольного сигнала"}
            highestSeverity={operationalSeverity(highestRiskRow?.severity)}
            nextActionLabel="Открыть следующий риск"
            onNextAction={() => {
              if (nextRiskRow) selectRow(nextRiskRow.id);
            }}
            requiresActionCount={rows.filter((row) => row.severity !== "none").length}
            summary={
              rows.length > 0
                ? `${rows.length} сигналов в портфельной поверхности`
                : "Нет контрольных сигналов для действия"
            }
          />
        }
        state={operationalState({
          activeRow,
          canReadSurface,
          commandError,
          isError: viewQuery.isError,
          isFetching: viewQuery.isFetching,
          lastResult,
          rows
        })}
        statusLabel={displayStatus}
        summary={
          <KPIStrip
            metrics={(view?.widgets ?? []).map((widget) => ({
              id: widget.key,
              label: widget.label,
              requiresAction: widget.severity === "critical" || widget.severity === "warning",
              severity: operationalSeverity(widget.severity),
              sourceLabel: widget.widgetType,
              value: widget.value
            }))}
          />
        }
        title="Портфельный контроль"
        toolbar={
          <p className="status-pill" data-testid="portfolio-control-status">
            {displayStatus}
          </p>
        }
      >
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
          <div className="portfolio-widget-grid" aria-label="Legacy portfolio widget ids">
            {(view?.widgets ?? []).map((widget) => (
              <div className="portfolio-widget" data-testid={`portfolio-control-widget-${widget.key}`} key={widget.key}>
                <span>{widget.label}</span>
                <strong>{widget.value}</strong>
              </div>
            ))}
          </div>
          <PortfolioOperationalGrid
            activeRowId={activeRow?.id ?? null}
            rows={rows}
            onSelectRow={selectRow}
          />
          <RowList activeRowId={activeRow?.id ?? null} onSelectRow={selectRow} rows={rows} />
        </section>

        <section className="phase2-panel portfolio-action-panel" data-testid="portfolio-control-action-panel">
          <PortfolioNextActionContract action={activeAction} definition={activeDefinition} row={activeRow} />
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
        </section>
        </div>
      </OperationalSurfaceShell>
    </section>
  );
}
