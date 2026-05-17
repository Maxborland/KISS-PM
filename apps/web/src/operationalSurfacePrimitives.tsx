import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type OperationalSeverity = "ok" | "attention" | "warning" | "critical";

export type OperationalSurfaceState =
  | "loading"
  | "fetching"
  | "empty"
  | "ready"
  | "stale"
  | "readonly"
  | "permission_denied"
  | "error"
  | "preview"
  | "applied"
  | "apply_failed";

export type OperationalGridColumn = {
  key: string;
  label: string;
  group?: string;
  width?: number;
  visible?: boolean;
  sticky?: "left" | "right";
};

export type OperationalGridAction = {
  key: string;
  label: string;
  disabledReason?: string;
  onSelect?: () => void;
};

export type OperationalGridRow = {
  id: string;
  label: string;
  severity?: OperationalSeverity;
  values: Record<string, ReactNode>;
  actions?: OperationalGridAction[];
};

export type KpiMetric = {
  id: string;
  label: string;
  value: ReactNode;
  severity?: OperationalSeverity;
  deltaLabel?: string;
  helpText?: string;
  sourceLabel?: string;
  requiresAction?: boolean;
};

const severityLabels: Record<OperationalSeverity, string> = {
  ok: "Норма",
  attention: "Внимание",
  warning: "Риск",
  critical: "Критично"
};

function severityClass(severity: OperationalSeverity | undefined): string {
  return `severity-${severity ?? "ok"}`;
}

function defaultVisibleKeys(columns: OperationalGridColumn[]): string[] {
  return columns.filter((column) => column.visible !== false).map((column) => column.key);
}

function orderedUnique(values: string[], allowed: Set<string>): string[] {
  return values.filter((value, index) => allowed.has(value) && values.indexOf(value) === index);
}

function sameStringList(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => right[index] === value);
}

export function OperationalSurfaceShell({
  actionPanel,
  audit,
  children,
  description,
  detail,
  freshnessLabel,
  objectLabel,
  onPrimaryAction,
  primaryActionDisabledReason,
  primaryActionLabel,
  readbackLabel,
  signal,
  state,
  statusLabel,
  summary,
  title,
  toolbar
}: {
  actionPanel?: ReactNode;
  audit?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  detail?: ReactNode;
  freshnessLabel?: string;
  objectLabel?: string;
  onPrimaryAction?: () => void;
  primaryActionDisabledReason?: string;
  primaryActionLabel?: string;
  readbackLabel?: string;
  signal?: ReactNode;
  state: OperationalSurfaceState;
  statusLabel: string;
  summary?: ReactNode;
  title: string;
  toolbar?: ReactNode;
}) {
  const primaryDisabled = Boolean(primaryActionDisabledReason);

  return (
    <section className={`operational-surface-shell state-${state}`} data-testid="operational-surface-shell">
      <div className="operational-surface-header">
        <div>
          {objectLabel ? <span className="operational-object-label">{objectLabel}</span> : null}
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <div className="operational-surface-status-stack">
          <span className="status-pill" data-testid="operational-surface-state">
            {statusLabel}
          </span>
          {freshnessLabel ? <span className="operational-muted">{freshnessLabel}</span> : null}
        </div>
      </div>

      {signal ? <div className="operational-surface-signal">{signal}</div> : null}

      <div className="operational-surface-toolbar">
        {toolbar}
        {primaryActionLabel ? (
          <button
            data-testid="operational-surface-primary-action"
            disabled={primaryDisabled}
            onClick={onPrimaryAction}
            title={primaryActionDisabledReason}
            type="button"
          >
            {primaryActionLabel}
          </button>
        ) : null}
      </div>

      {primaryActionDisabledReason ? (
        <PermissionDeniedInline actionLabel={primaryActionLabel ?? "Действие"} reason={primaryActionDisabledReason} />
      ) : null}

      {summary ? <div className="operational-surface-summary">{summary}</div> : null}

      <div className="operational-surface-body">
        <div>{children}</div>
        {detail ? <aside>{detail}</aside> : null}
      </div>

      {actionPanel ? <div className="operational-surface-action-panel">{actionPanel}</div> : null}

      <div className="operational-surface-footer">
        {readbackLabel ? (
          <span data-testid="operational-surface-readback" className="operational-readback">
            {readbackLabel}
          </span>
        ) : null}
        {audit}
      </div>
    </section>
  );
}

export function PermissionDeniedInline({ actionLabel, reason }: { actionLabel: string; reason: string }) {
  return (
    <p className="readonly-notice operational-permission-denied" data-testid="permission-denied-inline">
      {actionLabel}: {reason}
    </p>
  );
}

export function ActionAuditPreview({
  actionExecutionId,
  actorLabel,
  auditEventId,
  readbackLabel,
  resultLabel,
  targetLabel
}: {
  actionExecutionId: string;
  actorLabel?: string;
  auditEventId?: string;
  readbackLabel?: string;
  resultLabel: string;
  targetLabel?: string;
}) {
  return (
    <section className="action-audit-preview" data-testid="action-audit-preview">
      <strong>{resultLabel}</strong>
      <span>ActionExecution: {actionExecutionId}</span>
      {auditEventId ? <span>AuditEvent: {auditEventId}</span> : null}
      {actorLabel ? <span>Актор: {actorLabel}</span> : null}
      {targetLabel ? <span>Объект: {targetLabel}</span> : null}
      {readbackLabel ? <span>{readbackLabel}</span> : null}
    </section>
  );
}

export function KPIStrip({ metrics }: { metrics: KpiMetric[] }) {
  return (
    <div className="kpi-strip" data-testid="kpi-strip">
      {metrics.map((metric) => (
        <section
          className={`kpi-strip-metric ${severityClass(metric.severity)} ${metric.requiresAction ? "requires-action" : ""}`}
          data-testid={`kpi-metric-${metric.id}`}
          key={metric.id}
          title={metric.helpText}
        >
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          {metric.deltaLabel ? <small>{metric.deltaLabel}</small> : null}
          {metric.sourceLabel ? <small>{metric.sourceLabel}</small> : null}
          {metric.requiresAction ? <small>требует действия</small> : null}
        </section>
      ))}
    </div>
  );
}

export function SignalSummaryBar({
  disabledReason,
  highestSeverity = "ok",
  nextActionLabel,
  onNextAction,
  requiresActionCount,
  summary
}: {
  disabledReason?: string;
  highestSeverity?: OperationalSeverity;
  nextActionLabel?: string;
  onNextAction?: () => void;
  requiresActionCount: number;
  summary: string;
}) {
  return (
    <section className={`signal-summary-bar ${severityClass(highestSeverity)}`} data-testid="signal-summary-bar">
      <div>
        <strong>{summary}</strong>
        <span>
          {severityLabels[highestSeverity]} / требует действия: {requiresActionCount}
        </span>
      </div>
      {nextActionLabel ? (
        <button disabled={Boolean(disabledReason)} onClick={onNextAction} title={disabledReason} type="button">
          {nextActionLabel}
        </button>
      ) : null}
    </section>
  );
}

export function ConfigurableColumnLayout({
  columns,
  onChange,
  onReset,
  visibleColumnKeys
}: {
  columns: OperationalGridColumn[];
  onChange: (visibleColumnKeys: string[]) => void;
  onReset: () => void;
  visibleColumnKeys: string[];
}) {
  const allowedKeys = new Set(columns.map((column) => column.key));
  const normalizedVisibleKeys = orderedUnique(visibleColumnKeys, allowedKeys);

  function toggleColumn(columnKey: string) {
    const nextKeys = normalizedVisibleKeys.includes(columnKey)
      ? normalizedVisibleKeys.filter((key) => key !== columnKey)
      : [...normalizedVisibleKeys, columnKey];
    onChange(nextKeys);
  }

  return (
    <section className="configurable-column-layout" data-testid="configurable-column-layout">
      <div className="operational-section-heading">
        <strong>Колонки</strong>
        <button onClick={onReset} type="button">
          Сбросить макет
        </button>
      </div>
      <div className="column-layout-options">
        {columns.map((column) => (
          <label key={column.key}>
            <input
              checked={normalizedVisibleKeys.includes(column.key)}
              onChange={() => toggleColumn(column.key)}
              type="checkbox"
            />
            {column.label}
          </label>
        ))}
      </div>
    </section>
  );
}

export function OperationalDataGrid({
  columns,
  emptyLabel,
  onSelectRow,
  rows,
  selectedRowId
}: {
  columns: OperationalGridColumn[];
  emptyLabel: string;
  onSelectRow?: (rowId: string) => void;
  rows: OperationalGridRow[];
  selectedRowId?: string | null;
}) {
  const [visibleColumnKeys, setVisibleColumnKeys] = useState(() => defaultVisibleKeys(columns));
  const previousColumnKeysRef = useRef(new Set(columns.map((column) => column.key)));
  const allowedKeys = useMemo(() => new Set(columns.map((column) => column.key)), [columns]);
  const visibleColumns = columns.filter((column) => visibleColumnKeys.includes(column.key));
  const groupRuns = visibleColumns.reduce<Array<{ group: string; span: number }>>((runs, column) => {
    const group = column.group ?? "Данные";
    const currentRun = runs.at(-1);
    if (currentRun?.group === group) {
      currentRun.span += 1;
    } else {
      runs.push({ group, span: 1 });
    }
    return runs;
  }, []);

  useEffect(() => {
    const previousColumnKeys = previousColumnKeysRef.current;
    const nextAllowedKeys = new Set(columns.map((column) => column.key));
    const newDefaultVisibleKeys = columns
      .filter((column) => !previousColumnKeys.has(column.key) && column.visible !== false)
      .map((column) => column.key);

    setVisibleColumnKeys((currentKeys) => {
      const nextKeys = orderedUnique([...currentKeys, ...newDefaultVisibleKeys], nextAllowedKeys);
      return sameStringList(currentKeys, nextKeys) ? currentKeys : nextKeys;
    });
    previousColumnKeysRef.current = nextAllowedKeys;
  }, [columns]);

  function resetLayout() {
    setVisibleColumnKeys(defaultVisibleKeys(columns));
  }

  function updateVisibleKeys(nextKeys: string[]) {
    setVisibleColumnKeys(orderedUnique(nextKeys, allowedKeys));
  }

  if (rows.length === 0) {
    return <p className="readonly-notice">{emptyLabel}</p>;
  }

  return (
    <section className="operational-data-grid-shell">
      <ConfigurableColumnLayout
        columns={columns}
        onChange={updateVisibleKeys}
        onReset={resetLayout}
        visibleColumnKeys={visibleColumnKeys}
      />
      <button className="secondary-button" data-testid="grid-reset-layout" onClick={resetLayout} type="button">
        Сбросить макет
      </button>
      <div className="operational-data-grid-scroll">
        <table className="operational-data-grid" data-testid="operational-data-grid">
          <thead>
            <tr>
              {groupRuns.map((run, index) => (
                <th colSpan={run.span} key={`${run.group}-${index}`}>
                  {run.group}
                </th>
              ))}
              <th rowSpan={2}>Действия</th>
            </tr>
            <tr>
              {visibleColumns.map((column) => (
                <th
                  className={column.sticky ? `sticky-${column.sticky}` : undefined}
                  key={column.key}
                  style={column.width ? { minWidth: column.width } : undefined}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                className={`${row.id === selectedRowId ? "active" : ""} ${severityClass(row.severity)}`}
                data-testid={`grid-row-${row.id}`}
                key={row.id}
                onClick={() => onSelectRow?.(row.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectRow?.(row.id);
                  }
                }}
                tabIndex={0}
              >
                {visibleColumns.map((column) => (
                  <td className={column.sticky ? `sticky-${column.sticky}` : undefined} key={column.key}>
                    {row.values[column.key] ?? "нет"}
                  </td>
                ))}
                <td>
                  <div className="grid-row-actions">
                    {(row.actions ?? []).map((action) => (
                      <button
                        disabled={Boolean(action.disabledReason)}
                        key={action.key}
                        onClick={(event) => {
                          event.stopPropagation();
                          action.onSelect?.();
                        }}
                        title={action.disabledReason}
                        type="button"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
