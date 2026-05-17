import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ActionAuditPreview,
  ConfigurableColumnLayout,
  KPIStrip,
  OperationalDataGrid,
  OperationalSurfaceShell,
  RuntimeConfigPreview,
  SignalSummaryBar,
  type OperationalGridColumn,
  type OperationalGridRow
} from "./operationalSurfacePrimitives";

const columns: OperationalGridColumn[] = [
  { key: "project", label: "Проект", group: "Контекст", width: 220, sticky: "left" },
  { key: "signal", label: "Сигнал", group: "Контроль", width: 260 },
  { key: "severity", label: "Риск", group: "Контроль", width: 120 },
  { key: "owner", label: "Ответственный", group: "Исполнение", width: 180, visible: false }
];

const rows: OperationalGridRow[] = [
  {
    id: "row-critical",
    label: "Критический сигнал",
    severity: "critical",
    values: {
      project: "project-alpha-a",
      signal: "Отклонение сроков",
      severity: "Критично",
      owner: "РП"
    },
    actions: [
      { key: "preview", label: "Предпросмотр", onSelect: vi.fn() },
      { key: "apply", label: "Применить", disabledReason: "Сначала нужен preview", onSelect: vi.fn() }
    ]
  },
  {
    id: "row-watch",
    label: "Контрольный сигнал",
    severity: "attention",
    values: {
      project: "project-beta-a",
      signal: "Ресурсный риск",
      severity: "Внимание",
      owner: "Resource Manager"
    }
  }
];

describe("Release 2 operational surface primitives", () => {
  it("renders a governed surface shell with state, next action, audit result, and readback proof", () => {
    const onPrimaryAction = vi.fn();

    render(
      <OperationalSurfaceShell
        audit={
          <ActionAuditPreview
            actionExecutionId="action-r2-1"
            actorLabel="Администратор"
            auditEventId="audit-r2-1"
            readbackLabel="reload подтверждает обновленную проекцию"
            resultLabel="risk.accept: succeeded"
            targetLabel="signal-kpi-a"
          />
        }
        description="Данные -> сигнал -> действие -> audit/readback."
        freshnessLabel="обновлено 12:40"
        objectLabel="Портфель"
        onPrimaryAction={onPrimaryAction}
        primaryActionLabel="Разобрать сигнал"
        readbackLabel="Readback подтвержден"
        signal={<SignalSummaryBar highestSeverity="critical" requiresActionCount={2} summary="Есть критичные сигналы" />}
        state="ready"
        statusLabel="Готово к управляемому действию"
        title="Портфельный контроль"
      >
        <p>Операционная поверхность</p>
      </OperationalSurfaceShell>
    );

    expect(screen.getByTestId("operational-surface-shell")).toHaveTextContent("Портфельный контроль");
    expect(screen.getByTestId("operational-surface-state")).toHaveTextContent("Готово к управляемому действию");
    expect(screen.getByTestId("operational-surface-readback")).toHaveTextContent("Readback подтвержден");
    expect(screen.getByTestId("action-audit-preview")).toHaveTextContent("risk.accept: succeeded");

    fireEvent.click(screen.getByTestId("operational-surface-primary-action"));

    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });

  it("keeps permission-denied actions visible with an inline reason instead of a broken toolbar", () => {
    render(
      <OperationalSurfaceShell
        description="Только чтение"
        primaryActionDisabledReason="Нет права control.action:write"
        primaryActionLabel="Применить"
        state="readonly"
        statusLabel="Только чтение"
        title="Ресурсная матрица"
      >
        <span>Данные доступны только для просмотра</span>
      </OperationalSurfaceShell>
    );

    expect(screen.getByTestId("operational-surface-primary-action")).toBeDisabled();
    expect(screen.getByTestId("permission-denied-inline")).toHaveTextContent("Нет права control.action:write");
  });

  it("renders grouped configurable data grid columns, row actions, keyboard selection, and reset layout", () => {
    const onSelectRow = vi.fn();

    render(
      <OperationalDataGrid
        columns={columns}
        emptyLabel="Нет сигналов"
        onSelectRow={onSelectRow}
        rows={rows}
        selectedRowId="row-critical"
      />
    );

    expect(screen.getByTestId("operational-data-grid")).toHaveTextContent("Контекст");
    expect(screen.getByTestId("operational-data-grid")).toHaveTextContent("Контроль");
    const grid = screen.getByTestId("operational-data-grid");
    expect(grid).toHaveTextContent("project-alpha-a");
    expect(within(grid).queryByText("Ответственный")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Ответственный" }));
    expect(within(screen.getByTestId("operational-data-grid")).getByText("Ответственный")).toBeInTheDocument();

    const row = screen.getByTestId("grid-row-row-watch");
    row.focus();
    fireEvent.keyDown(row, { key: "Enter" });
    expect(onSelectRow).toHaveBeenCalledWith("row-watch");

    const applyButton = screen.getByRole("button", { name: "Применить" });
    expect(applyButton).toBeDisabled();
    expect(applyButton).toHaveAttribute("title", "Сначала нужен preview");

    fireEvent.click(screen.getByTestId("grid-reset-layout"));
    expect(within(screen.getByTestId("operational-data-grid")).queryByText("Ответственный")).not.toBeInTheDocument();
  });

  it("does not select the row when keyboard users activate a row action button", () => {
    const onSelectRow = vi.fn();
    const onPreview = vi.fn();

    render(
      <OperationalDataGrid
        columns={columns}
        emptyLabel="Нет сигналов"
        onSelectRow={onSelectRow}
        rows={[
          {
            ...rows[0]!,
            actions: [{ key: "preview", label: "Предпросмотр", onSelect: onPreview }]
          }
        ]}
        selectedRowId="row-critical"
      />
    );

    const previewButton = screen.getByRole("button", { name: "Предпросмотр" });
    previewButton.focus();
    fireEvent.keyDown(previewButton, { key: "Enter" });
    fireEvent.click(previewButton);

    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onSelectRow).not.toHaveBeenCalled();
  });

  it("renders grouped headers as contiguous runs when column groups repeat", () => {
    render(
      <OperationalDataGrid
        columns={[
          { key: "project", label: "Проект", group: "Контекст" },
          { key: "signal", label: "Сигнал", group: "Контроль" },
          { key: "owner", label: "Ответственный", group: "Контекст" }
        ]}
        emptyLabel="Нет сигналов"
        rows={[
          {
            id: "row-repeated-groups",
            label: "Сигнал",
            values: { project: "P-1", signal: "Риск", owner: "РП" }
          }
        ]}
      />
    );

    const groupHeaders = within(screen.getByTestId("operational-data-grid")).getAllByRole("columnheader", {
      name: "Контекст"
    });
    expect(groupHeaders).toHaveLength(2);
    expect(groupHeaders[0]).toHaveAttribute("colspan", "1");
    expect(groupHeaders[1]).toHaveAttribute("colspan", "1");
  });

  it("reconciles visible columns when the schema changes after runtime config readback", () => {
    const { rerender } = render(
      <OperationalDataGrid columns={columns} emptyLabel="Нет сигналов" rows={rows} selectedRowId="row-critical" />
    );

    const grid = screen.getByTestId("operational-data-grid");
    expect(within(grid).queryByText("Срок")).not.toBeInTheDocument();

    rerender(
      <OperationalDataGrid
        columns={[
          ...columns,
          { key: "deadline", label: "Срок", group: "Исполнение", width: 120 }
        ]}
        emptyLabel="Нет сигналов"
        rows={rows.map((row) => ({
          ...row,
          values: { ...row.values, deadline: "2026-06-10" }
        }))}
        selectedRowId="row-critical"
      />
    );

    expect(within(screen.getByTestId("operational-data-grid")).getByText("Срок")).toBeInTheDocument();
    expect(within(screen.getByTestId("operational-data-grid")).queryByText("Ответственный")).not.toBeInTheDocument();
  });

  it("exposes configurable column layout outside the grid for saved-view previews", () => {
    const onChange = vi.fn();
    const onReset = vi.fn();

    render(
      <ConfigurableColumnLayout
        columns={columns}
        onChange={onChange}
        onReset={onReset}
        visibleColumnKeys={["project", "signal"]}
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Риск" }));
    fireEvent.click(screen.getByRole("button", { name: "Сбросить макет" }));

    expect(onChange).toHaveBeenCalledWith(["project", "signal", "severity"]);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("renders KPI metrics with deltas, source help, severity, and requires-action summary", () => {
    const onNextAction = vi.fn();

    render(
      <>
        <KPIStrip
          metrics={[
            {
              id: "critical",
              deltaLabel: "+2 за период",
              helpText: "Сигналы считаются из control signal projection.",
              label: "Критичные",
              requiresAction: true,
              severity: "critical",
              sourceLabel: "KpiEvaluation",
              value: 2
            },
            {
              id: "capacity",
              deltaLabel: "-8 ч",
              helpText: "Свободная емкость по ресурсным buckets.",
              label: "Свободная емкость",
              severity: "attention",
              sourceLabel: "ResourceLoadBucket",
              value: "32 ч"
            }
          ]}
        />
        <SignalSummaryBar
          highestSeverity="critical"
          nextActionLabel="Открыть первый риск"
          onNextAction={onNextAction}
          requiresActionCount={2}
          summary="2 сигнала требуют решения"
        />
      </>
    );

    expect(screen.getByTestId("kpi-strip")).toHaveTextContent("KpiEvaluation");
    expect(screen.getByTestId("kpi-metric-critical")).toHaveTextContent("+2 за период");
    expect(screen.getByTestId("kpi-metric-critical")).toHaveTextContent("требует действия");
    expect(within(screen.getByTestId("signal-summary-bar")).getByText("2 сигнала требуют решения")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Открыть первый риск" }));

    expect(onNextAction).toHaveBeenCalledTimes(1);
  });

  it("renders runtime config preview with version delta, affected surfaces, blockers, and reload effect", () => {
    render(
      <RuntimeConfigPreview
        affectedSurfaces={["portfolio.control", "kpi.deviation.control"]}
        afterVersion="v2"
        beforeVersion="v1"
        blockers={["custom.risk_level is not visible on portfolio.control"]}
        previewId="preview-runtime-config-a"
        reloadEffectLabel="Reload shows saved view critical_portfolio on portfolio.control"
        summary="Runtime configuration will change only after publish command."
        warnings={["Existing user saved views keep their own column order."]}
      />
    );

    const preview = screen.getByTestId("runtime-config-preview");
    expect(preview).toHaveTextContent("preview-runtime-config-a");
    expect(preview).toHaveTextContent("v1 -> v2");
    expect(preview).toHaveTextContent("portfolio.control");
    expect(preview).toHaveTextContent("kpi.deviation.control");
    expect(preview).toHaveTextContent("custom.risk_level is not visible");
    expect(preview).toHaveTextContent("Existing user saved views");
    expect(preview).toHaveTextContent("Reload shows saved view");
  });
});
