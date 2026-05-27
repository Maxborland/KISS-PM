import type { Meta, StoryObj } from "@storybook/react";

import { GANTT_MOCK, Gantt, GanttInteractive } from "./gantt";
import { InteractiveHarness, mockWith } from "./gantt-story-harness";
import { ganttStoryMetaBase, ganttStoryId } from "./gantt-story-meta";

const meta: Meta<typeof GanttInteractive> = {
  ...ganttStoryMetaBase,
  title: "Widgets/Gantt/Showcase",
};
export default meta;


type Story = StoryObj<typeof GanttInteractive> & { id?: string };

export const ReadOnly: Story = {
  id: ganttStoryId("ReadOnly"),
  name: "Только чтение",
  render: () => (
    <div className="gantt-story-shell">
      <Gantt data={mockWith({ selectedRowId: "t-2-2" })} interactionMode="readonly" />
    </div>
  )
};

export const CollapsedSummaryRows: Story = {
  id: ganttStoryId("CollapsedSummaryRows"),
  name: "Свернутые сводные строки",
  render: () => {
    const rows = GANTT_MOCK.rows.map((r) =>
      r.id === "root" || r.id === "p-1" ? { ...r, collapsed: true, collapsible: true } : r
    );
    return <GanttInteractive initialData={{ ...GANTT_MOCK, rows }} showApplyBar={false} />;
  }
};

export const PreviewPending: Story = {
  id: ganttStoryId("PreviewPending"),
  name: "Превью · ожидание",
  render: () => (
    <GanttInteractive
      initialData={GANTT_MOCK}
      initialPreviewState="preview-pending"
      showInspector={false}
    />
  )
};

export const PreviewReady: Story = {
  id: ganttStoryId("PreviewReady"),
  name: "Обзор с инспектором",
  parameters: {
    docs: {
      description: {
        story: "Полная витрина Ганта: таблица, шкала, связи, выбранная задача и правый инспектор."
      }
    }
  },
  render: () => (
    <InteractiveHarness
      data={mockWith({ selectedRowId: "t-2-2" })}
      previewState="preview-ready"
      showInspector
    />
  )
};

export const ErrorState: Story = {
  id: ganttStoryId("ErrorState"),
  name: "Ошибка",
  render: () => (
    <GanttInteractive
      initialData={GANTT_MOCK}
      initialPreviewState="error"
      showInspector={false}
    />
  )
};

export const ConflictState: Story = {
  id: ganttStoryId("ConflictState"),
  name: "Конфликт",
  render: () => (
    <GanttInteractive
      initialData={GANTT_MOCK}
      initialPreviewState="conflict"
      showInspector={false}
    />
  )
};

export const BaselineAndCriticalPath: Story = {
  id: ganttStoryId("BaselineAndCriticalPath"),
  name: "Базовый план и критический путь",
  render: () => (
    <InteractiveHarness
      data={mockWith({ selectedRowId: "t-2-2" })}
      flags={{ showBaseline: true, showCriticalPath: true, showDependencies: true }}
      showApplyBar={false}
    />
  )
};
