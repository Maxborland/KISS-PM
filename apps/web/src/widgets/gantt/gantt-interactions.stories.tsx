import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "@storybook/test";

import { GANTT_MOCK, Gantt, GanttInteractive } from "./gantt";
import { InteractiveHarness, mockWith } from "./gantt-story-harness";
import { ganttStoryMetaBase, ganttStoryId } from "./gantt-story-meta";

const meta: Meta<typeof GanttInteractive> = {
  ...ganttStoryMetaBase,
  title: "Widgets/Gantt/Interactions",
};
export default meta;


type Story = StoryObj<typeof GanttInteractive> & { id?: string };

export const CellEditing: Story = {
  id: ganttStoryId("CellEditing"),
  name: "Редактирование ячейки",
  render: () => (
    <InteractiveHarness
      data={mockWith({ selectedRowId: "t-2-2" })}
      onMount={(c) => c.startEdit("t-2-2", "name")}
    />
  )
};

export const ValidationError: Story = {
  id: ganttStoryId("ValidationError"),
  name: "Ошибка валидации",
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
  id: ganttStoryId("DragMoveTask"),
  name: "Перемещение задачи",
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
  id: ganttStoryId("ResizeDuration"),
  name: "Изменение длительности",
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
  id: ganttStoryId("DependencyCreate"),
  name: "Создание связи",
  render: () => (
    <Gantt
      data={GANTT_MOCK}
      interactionMode="interactive"
      link={{ fromId: "t-2-2", fromEndpoint: "finish", pointerX: 420, pointerY: 120 }}
    />
  )
};

export const DependencySelected: Story = {
  id: ganttStoryId("DependencySelected"),
  name: "Выбранная связь",
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
  id: ganttStoryId("InspectorOpen"),
  name: "Инспектор открыт",
  render: () => (
    <GanttInteractive
      initialData={mockWith({ selectedRowId: "t-2-2" })}
      showTaskDetailsDrawer
      showApplyBar={false}
    />
  )
};

export const RightDetailsDrawerAnimated: Story = {
  id: ganttStoryId("RightDetailsDrawerAnimated"),
  name: "Анимация боковой панели",
  render: () => (
    <GanttInteractive
      initialData={mockWith({ selectedRowId: "t-2-2" })}
      showTaskDetailsDrawer
      showApplyBar={false}
    />
  )
};

export const ContextMenuActions: Story = {
  id: ganttStoryId("ContextMenuActions"),
  name: "Контекстное меню",
  render: () => (
    <GanttInteractive initialData={mockWith({ selectedRowId: "t-2-1" })} showApplyBar={false} />
  )
};

export const CellRangeSelection: Story = {
  id: ganttStoryId("CellRangeSelection"),
  name: "Выбор диапазона ячеек",
  render: () => <GanttInteractive initialData={GANTT_MOCK} showApplyBar={false} />
};

export const CopyPasteCells: Story = {
  id: ganttStoryId("CopyPasteCells"),
  name: "Копирование и вставка",
  render: () => <GanttInteractive initialData={GANTT_MOCK} showApplyBar={false} />
};

export const RowDragAndDrop: Story = {
  id: ganttStoryId("RowDragAndDrop"),
  name: "Перетаскивание строки",
  render: () => <GanttInteractive initialData={GANTT_MOCK} showApplyBar={false} />
};

export const DatePickerEditing: Story = {
  id: ganttStoryId("DatePickerEditing"),
  name: "Выбор даты",
  render: () => (
    <GanttInteractive initialData={mockWith({ selectedRowId: "t-2-2" })} showApplyBar={false} />
  )
};

export const ResourcePicker: Story = {
  id: ganttStoryId("ResourcePicker"),
  name: "Выбор ресурса",
  render: () => (
    <GanttInteractive initialData={mockWith({ selectedRowId: "t-2-2" })} showApplyBar={false} />
  )
};

export const DependencyTypesAndLag: Story = {
  id: ganttStoryId("DependencyTypesAndLag"),
  name: "Типы связей и лаг",
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

export const OpenTaskCardAction: Story = {
  id: ganttStoryId("OpenTaskCardAction"),
  name: "Открытие карточки задачи",
  render: () => (
    <GanttInteractive
      initialData={mockWith({ selectedRowId: "t-2-2" })}
      showTaskDetailsDrawer
      showApplyBar={false}
      onOpenTaskCard={(id) => {
        window.alert(`Открыть карточку задачи: ${id} → экран «Задачи»`);
      }}
    />
  )
};
