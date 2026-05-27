import { useEffect } from "react";

import { GanttApplyBar } from "./gantt-apply-bar";
import { patchGanttData, type GanttDataPatch } from "./gantt-data-patch";
import { TaskDetailsDrawer } from "./task-details-drawer";
import { GANTT_MOCK, Gantt, useGanttController } from "./gantt";
import type { GanttData, GanttInteractiveProps, GanttPreviewState } from "./types";

export function mockWith(patch: GanttDataPatch): GanttData {
  return patchGanttData(GANTT_MOCK, patch);
}

export function InteractiveHarness({
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
    onMount?.(controller);
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
    <div className="gantt2__shell gantt2__shell--drawer-open gantt-story-shell">
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
          onChartPointerDown={(rowId, kind, clientX, rect, dayW) =>
            startDrag(rowId, kind, clientX, rect, dayW)
          }
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
