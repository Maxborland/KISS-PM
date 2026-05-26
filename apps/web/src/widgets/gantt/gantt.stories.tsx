import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "@storybook/test";
import { useEffect } from "react";

import { GanttApplyBar } from "./gantt-apply-bar";
import { patchGanttData } from "./gantt-data-patch";
import { TaskDetailsDrawer } from "./task-details-drawer";
import { GANTT_MOCK, Gantt, GanttInteractive, useGanttController } from "./gantt";
import type { GanttData, GanttInteractiveProps, GanttPreviewState } from "./types";

const meta: Meta<typeof GanttInteractive> = {
  title: "Widgets/Gantt",
  component: GanttInteractive,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Фронтенд-контракт Ганта: mock-данные и локальное состояние, без серверного планировщика."
      }
    }
  },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof GanttInteractive>;

function mockWith(patch: import("./gantt-data-patch").GanttDataPatch): GanttData {
  return patchGanttData(GANTT_MOCK, patch);
}

function InteractiveHarness({
  data = GANTT_MOCK,
  previewState,
  previewMessage,
  flags,
  showInspector = true,
  showApplyBar = true,
  onMount
}: {
  data?: GanttData;
  previewState?: GanttPreviewState;
  previewMessage?: string;
  flags?: GanttInteractiveProps["initialFlags"];
  showInspector?: boolean;
  showApplyBar?: boolean;
  onMount?: (api: ReturnType<typeof useGanttController>) => void;
}) {
  const controller = useGanttController({
    initialData: data,
    ...(previewState !== undefined ? { initialPreviewState: previewState } : {}),
    ...(flags !== undefined ? { initialFlags: flags } : {})
  });

  useEffect(() => {
    if (onMount) onMount(controller);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- story seed once
  }, []);

  const {
    displayData,
    state,
    selectedRow,
    rowsVisible,
    selectRow,
    toggleRowCollapse,
    closeTaskDetails,
    commitField,
    updateDependency,
    startEdit,
    setEditDraft,
    commitEdit,
    cancelEdit,
    startDrag,
    moveDrag,
    endDrag,
    completeLink,
    dispatch
  } = controller;

  const dirty = state.history.past.length > 0;

  return (
    <div
      className="gantt2__shell gantt2__shell--drawer-open"
      style={{ padding: 12, minHeight: "80vh", background: "var(--bg)" }}
    >
      <div className="gantt2__main">
      <Gantt
        data={displayData}
        interactionMode="interactive"
        previewState={state.previewState}
        {...(state.previewMessage ? { previewMessage: state.previewMessage } : {})}
        showDependencies={state.flags.showDependencies}
        showBaseline={state.flags.showBaseline}
        showCriticalPath={state.flags.showCriticalPath}
        edit={state.edit}
        focus={state.focus}
        drag={state.drag}
        link={state.link}
        {...(state.schedulingHint ? { schedulingHint: state.schedulingHint } : {})}
        onRowClick={selectRow}
        onCellFocus={(cell) => dispatch({ type: "patch", patch: { focus: cell } })}
        onStartEdit={(rowId, field) => startEdit(rowId, field)}
        onEditDraft={setEditDraft}
        onCommitEdit={commitEdit}
        onCancelEdit={cancelEdit}
        onToggleCollapse={toggleRowCollapse}
        onChartPointerDown={(rowId, kind, clientX, rect, dayW) => startDrag(rowId, kind, clientX, rect, dayW)}
        onChartPointerMove={(clientX) => moveDrag(clientX, 28)}
        onChartPointerUp={endDrag}
        onLinkStart={(rowId, endpoint, x, y) =>
          dispatch({
            type: "patch",
            patch: { link: { fromId: rowId, fromEndpoint: endpoint, pointerX: x, pointerY: y } }
          })
        }
        onLinkMove={(x, y) => {
          if (!state.link) return;
          dispatch({ type: "patch", patch: { link: { ...state.link, pointerX: x, pointerY: y } } });
        }}
        onLinkComplete={(toId, toEndpoint) => completeLink(toId, toEndpoint)}
        onDependencySelect={(id) =>
          dispatch({
            type: "patch",
            patch: { data: patchGanttData(state.data, { selectedDependencyId: id, selectedRowId: null }) }
          })
        }
        onKeyNavigate={(dir) => {
          const ids = rowsVisible.map((r) => r.id);
          const index = state.data.selectedRowId ? ids.indexOf(state.data.selectedRowId) : -1;
          const next = dir === "down" ? Math.min(index + 1, ids.length - 1) : Math.max(index - 1, 0);
          selectRow(ids[next] ?? ids[0]);
        }}
      />
      {showApplyBar ? (
        <GanttApplyBar
          state={state.previewState}
          message={state.previewMessage ?? "Mock preview/apply — серверный пересчёт не вызывается"}
          {...(state.schedulingHint ? { schedulingHint: state.schedulingHint } : {})}
        />
      ) : null}
      </div>
      {showInspector ? (
        <TaskDetailsDrawer
          open
          row={selectedRow}
          dependencies={state.data.dependencies ?? []}
          dirty={dirty}
          onClose={closeTaskDetails}
          onCommitField={commitField}
          onUpdateDependency={updateDependency}
        />
      ) : null}
    </div>
  );
}

export const ReadOnly: Story = {
  name: "ReadOnly",
  render: () => (
    <div style={{ padding: 12, background: "var(--bg)" }}>
      <Gantt data={mockWith({ selectedRowId: "t-2-2" })} interactionMode="readonly" />
    </div>
  )
};

export const CellEditing: Story = {
  name: "CellEditing",
  render: () => (
    <InteractiveHarness
      data={mockWith({ selectedRowId: "t-2-2" })}
      onMount={(c) => c.startEdit("t-2-2", "name")}
    />
  )
};

export const ValidationError: Story = {
  name: "ValidationError",
  render: () => (
    <Gantt
      data={GANTT_MOCK}
      interactionMode="interactive"
      edit={{ rowId: "t-2-2", field: "duration", draft: "-2", error: "Длительность не может быть отрицательной" }}
      focus={{ rowId: "t-2-2", field: "duration" }}
    />
  )
};

export const DragMoveTask: Story = {
  name: "DragMoveTask",
  render: () => (
    <Gantt
      data={mockWith({ selectedRowId: "t-2-2" })}
      interactionMode="interactive"
      drag={{
        kind: "move",
        rowId: "t-2-2",
        pointerStartX: 0,
        originStartDay: 14,
        originDuration: 6,
        originProgress: 0.55,
        previewStartDay: 16,
        previewDuration: 6,
        previewProgress: 0.55
      }}
      schedulingHint="Пересчёт зависимых задач — только preview (scheduling engine pending)"
    />
  )
};

export const ResizeDuration: Story = {
  name: "ResizeDuration",
  render: () => (
    <Gantt
      data={mockWith({ selectedRowId: "t-2-4" })}
      interactionMode="interactive"
      drag={{
        kind: "resize-end",
        rowId: "t-2-4",
        pointerStartX: 0,
        originStartDay: 18,
        originDuration: 5,
        originProgress: 0.15,
        previewStartDay: 18,
        previewDuration: 8,
        previewProgress: 0.15
      }}
    />
  )
};

export const DependencyCreate: Story = {
  name: "DependencyCreate",
  render: () => (
    <Gantt
      data={GANTT_MOCK}
      interactionMode="interactive"
      link={{ fromId: "t-2-2", fromEndpoint: "finish", pointerX: 420, pointerY: 120 }}
    />
  )
};

export const DependencySelected: Story = {
  name: "DependencySelected",
  render: () => (
    <Gantt
      data={mockWith({
        selectedDependencyId: GANTT_MOCK.dependencies?.[0]?.id ?? null,
        selectedRowId: null
      })}
      interactionMode="interactive"
    />
  )
};

export const InspectorOpen: Story = {
  name: "InspectorOpen",
  render: () => (
    <GanttInteractive
      initialData={mockWith({ selectedRowId: "t-2-2" })}
      showTaskDetailsDrawer
      showApplyBar={false}
    />
  )
};

export const CollapsedSummaryRows: Story = {
  name: "CollapsedSummaryRows",
  render: () => {
    const rows = GANTT_MOCK.rows.map((r) =>
      r.id === "root" || r.id === "p-1" ? { ...r, collapsed: true, collapsible: true } : r
    );
    return <GanttInteractive initialData={{ ...GANTT_MOCK, rows }} showApplyBar={false} />;
  }
};

export const PreviewPending: Story = {
  name: "PreviewPending",
  render: () => (
    <GanttInteractive
      initialData={GANTT_MOCK}
      initialPreviewState="preview-pending"
      showInspector={false}
    />
  )
};

export const PreviewReady: Story = {
  name: "PreviewReady",
  render: () => (
    <GanttInteractive
      initialData={GANTT_MOCK}
      initialPreviewState="preview-ready"
      showInspector={false}
    />
  )
};

export const ErrorState: Story = {
  name: "ErrorState",
  render: () => (
    <GanttInteractive
      initialData={GANTT_MOCK}
      initialPreviewState="error"
      showInspector={false}
    />
  )
};

export const ConflictState: Story = {
  name: "ConflictState",
  render: () => (
    <GanttInteractive
      initialData={GANTT_MOCK}
      initialPreviewState="conflict"
      showInspector={false}
    />
  )
};

export const BaselineAndCriticalPath: Story = {
  name: "BaselineAndCriticalPath",
  render: () => (
    <GanttInteractive
      initialData={mockWith({ selectedRowId: "t-2-2" })}
      initialFlags={{ showBaseline: true, showCriticalPath: true, showDependencies: true }}
      showApplyBar={false}
    />
  )
};

export const RightDetailsDrawerAnimated: Story = {
  name: "RightDetailsDrawerAnimated",
  render: () => (
    <GanttInteractive
      initialData={mockWith({ selectedRowId: "t-2-2" })}
      showTaskDetailsDrawer
      showApplyBar={false}
    />
  )
};

export const ContextMenuActions: Story = {
  name: "ContextMenuActions",
  render: () => (
    <GanttInteractive initialData={mockWith({ selectedRowId: "t-2-1" })} showApplyBar={false} />
  )
};

export const CellRangeSelection: Story = {
  name: "CellRangeSelection",
  render: () => <GanttInteractive initialData={GANTT_MOCK} showApplyBar={false} />
};

export const CopyPasteCells: Story = {
  name: "CopyPasteCells",
  render: () => <GanttInteractive initialData={GANTT_MOCK} showApplyBar={false} />
};

export const RowDragAndDrop: Story = {
  name: "RowDragAndDrop",
  render: () => <GanttInteractive initialData={GANTT_MOCK} showApplyBar={false} />
};

export const DatePickerEditing: Story = {
  name: "DatePickerEditing",
  render: () => (
    <GanttInteractive initialData={mockWith({ selectedRowId: "t-2-2" })} showApplyBar={false} />
  )
};

export const ResourcePicker: Story = {
  name: "ResourcePicker",
  render: () => (
    <GanttInteractive initialData={mockWith({ selectedRowId: "t-2-2" })} showApplyBar={false} />
  )
};

export const DependencyTypesAndLag: Story = {
  name: "DependencyTypesAndLag",
  render: () => (
    <GanttInteractive
      initialData={mockWith({
        selectedRowId: "t-2-3",
        dependencies: [
          ...(GANTT_MOCK.dependencies ?? []),
          { id: "demo-ss", fromId: "t-2-1", toId: "t-2-2", type: "SS" },
          { id: "demo-ff", fromId: "t-2-3", toId: "t-2-4", type: "FF" },
          { id: "demo-sf", fromId: "t-2-2", toId: "t-2-4", type: "SF", lagDays: 2 }
        ]
      })}
      initialFlags={{ showDependencies: true }}
      showApplyBar={false}
    />
  )
};

/** Выбранная связь FS: подсветка пути и полос задач (контракт Phase 6). */
export const DependencyGeometrySelected: Story = {
  name: "DependencyGeometrySelected",
  render: () => (
    <GanttInteractive
      initialData={mockWith({ selectedDependencyId: "d6", selectedRowId: "t-2-2" })}
      initialFlags={{ showDependencies: true }}
      showApplyBar={false}
    />
  ),
  play: async ({ canvasElement }) => {
    const shell = canvasElement.querySelector(".gantt2");
    expect(shell?.classList.contains("gantt2--dependency-selected")).toBe(true);
    const selectedPath = canvasElement.querySelector(".gdep__path--selected");
    expect(selectedPath).toBeTruthy();
    const selectedBar = canvasElement.querySelector('[data-gantt-bar-selected="true"]');
    expect(selectedBar).toBeTruthy();
  }
};

export const DrawerOverlayNoReflow: Story = {
  name: "DrawerOverlayNoReflow",
  render: () => (
    <GanttInteractive
      initialData={mockWith({ selectedRowId: "t-2-2" })}
      showTaskDetailsDrawer
      showApplyBar={false}
    />
  )
};

export const EffortDurationLinkedFields: Story = {
  name: "EffortDurationLinkedFields",
  render: () => (
    <GanttInteractive initialData={mockWith({ selectedRowId: "t-2-2" })} showApplyBar={false} />
  )
};

export const PlanningIssuesAndOverloads: Story = {
  name: "PlanningIssuesAndOverloads",
  render: () => {
    const rows = GANTT_MOCK.rows.map((r) =>
      r.id === "t-2-2"
        ? { ...r, scheduleState: "overdue" as const, assignee: { initials: "ИИ", color: "c1" as const } }
        : r.id === "t-1-1"
          ? { ...r, assignee: { initials: "ИИ", color: "c1" as const }, startDay: 8, durationDays: 10 }
          : r
    );
    return <GanttInteractive initialData={{ ...GANTT_MOCK, rows }} showApplyBar={false} />;
  }
};

export const ColumnResizeAndReorder: Story = {
  name: "ColumnResizeAndReorder",
  render: () => <GanttInteractive initialData={GANTT_MOCK} showApplyBar={false} />
};

export const OpenTaskCardAction: Story = {
  name: "OpenTaskCardAction",
  render: () => (
    <GanttInteractive
      initialData={mockWith({ selectedRowId: "t-2-2" })}
      showTaskDetailsDrawer
      showApplyBar={false}
      onOpenTaskCard={(id) => {
        window.alert(`onOpenTaskCard: ${id} → Views/Screens/03-task-card`);
      }}
    />
  )
};

export const BarClickDoesNotOpenDrawer: Story = {
  name: "BarClickDoesNotOpenDrawer",
  render: () => <GanttInteractive initialData={GANTT_MOCK} showApplyBar={false} />
};

export const BarMoveResizeProgress: Story = {
  name: "BarMoveResizeProgress",
  render: () => (
    <GanttInteractive
      initialData={mockWith({ selectedRowId: "t-2-2" })}
      initialFlags={{ showDependencies: true }}
      showApplyBar={false}
    />
  )
};

export const DependencyEndpointHandles: Story = {
  name: "DependencyEndpointHandles",
  render: () => (
    <GanttInteractive
      initialData={mockWith({ selectedRowId: "t-2-2" })}
      initialFlags={{ showDependencies: true }}
      showApplyBar={false}
    />
  )
};

export const DependencyCreationValidation: Story = {
  name: "DependencyCreationValidation",
  render: () => <GanttInteractive initialData={GANTT_MOCK} showApplyBar />
};

export const PlanningIssueStyling: Story = {
  name: "PlanningIssueStyling",
  render: () => {
    const rows = GANTT_MOCK.rows.map((r) =>
      r.id === "t-2-2"
        ? { ...r, scheduleState: "overdue" as const, assignee: { initials: "ИИ", color: "c1" as const } }
        : r.id === "t-1-1"
          ? { ...r, assignee: { initials: "ИИ", color: "c1" as const }, startDay: 8, durationDays: 10 }
          : r
    );
    return <GanttInteractive initialData={{ ...GANTT_MOCK, rows }} showApplyBar={false} />;
  }
};

export const DrawerVisualCorrection: Story = {
  name: "Коррекция drawer",
  render: () => (
    <div>
      <p className="storybook-story-lead">Визуальная проверка правого drawer без reflow сетки</p>
      <GanttInteractive
        initialData={mockWith({ selectedRowId: "t-2-2" })}
        showTaskDetailsDrawer
        showApplyBar={false}
      />
    </div>
  )
};
