import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "@storybook/test";

import { GANTT_MOCK, Gantt, GanttInteractive } from "./gantt";
import { InteractiveHarness, mockWith } from "./gantt-story-harness";
import { ganttStoryMetaBase, ganttStoryId } from "./gantt-story-meta";

const meta: Meta<typeof GanttInteractive> = {
  ...ganttStoryMetaBase,
  title: "Widgets/Gantt/Regression",
};
export default meta;


type Story = StoryObj<typeof GanttInteractive> & { id?: string };

export const DependencyGeometrySelected: Story = {
  id: ganttStoryId("DependencyGeometrySelected"),
  name: "Геометрия выбранной связи",
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
  id: ganttStoryId("DrawerOverlayNoReflow"),
  name: "Боковая панель без сдвига сетки",
  render: () => (
    <GanttInteractive
      initialData={mockWith({ selectedRowId: "t-2-2" })}
      showTaskDetailsDrawer
      showApplyBar={false}
    />
  )
};

export const EffortDurationLinkedFields: Story = {
  id: ganttStoryId("EffortDurationLinkedFields"),
  name: "Связь трудозатрат и длительности",
  render: () => (
    <GanttInteractive initialData={mockWith({ selectedRowId: "t-2-2" })} showApplyBar={false} />
  )
};

export const PlanningIssuesAndOverloads: Story = {
  id: ganttStoryId("PlanningIssuesAndOverloads"),
  name: "Проблемы планирования и перегрузки",
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
  id: ganttStoryId("ColumnResizeAndReorder"),
  name: "Размер и порядок колонок",
  render: () => <GanttInteractive initialData={GANTT_MOCK} showApplyBar={false} />
};

export const BarClickDoesNotOpenDrawer: Story = {
  id: ganttStoryId("BarClickDoesNotOpenDrawer"),
  name: "Клик по бару не открывает боковую панель",
  render: () => <GanttInteractive initialData={GANTT_MOCK} showApplyBar={false} />
};

export const BarMoveResizeProgress: Story = {
  id: ganttStoryId("BarMoveResizeProgress"),
  name: "Перемещение, изменение размера и прогресс",
  render: () => (
    <GanttInteractive
      initialData={mockWith({ selectedRowId: "t-2-2" })}
      initialFlags={{ showDependencies: true }}
      showApplyBar={false}
    />
  )
};

export const DependencyEndpointHandles: Story = {
  id: ganttStoryId("DependencyEndpointHandles"),
  name: "Маркеры связей",
  render: () => (
    <GanttInteractive
      initialData={mockWith({ selectedRowId: "t-2-2" })}
      initialFlags={{ showDependencies: true }}
      showApplyBar={false}
    />
  )
};

export const DependencyCreationValidation: Story = {
  id: ganttStoryId("DependencyCreationValidation"),
  name: "Валидация создания связи",
  render: () => <GanttInteractive initialData={GANTT_MOCK} showApplyBar />
};

export const PlanningIssueStyling: Story = {
  id: ganttStoryId("PlanningIssueStyling"),
  name: "Стили проблем планирования",
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
  id: ganttStoryId("DrawerVisualCorrection"),
  name: "Коррекция боковой панели",
  render: () => (
    <div>
      <p className="storybook-story-lead">Визуальная проверка правой боковой панели без сдвига сетки</p>
      <GanttInteractive
        initialData={mockWith({ selectedRowId: "t-2-2" })}
        showTaskDetailsDrawer
        showApplyBar={false}
      />
    </div>
  )
};
