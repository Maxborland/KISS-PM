import type { Meta, StoryObj } from "@storybook/react";

import { ProjectAssignments } from "@/delivery/assignments/assignments-surface";

/**
 * Project Delivery — поверхность «Назначения»: матрица задача → исполнители с дневной
 * кривой распределения трудозатрат (assignmentAllocations). Несколько исполнителей на задачу
 * (роли/units), редактирование ресурса/роли/единиц/труда, пресеты кривой (Равномерно/Фронт/Бэк)
 * и ручная правка по дням с балансом «сумма = трудоёмкости» (optimistic → validate → error).
 * Реальный контракт: assignment.upsert / assignment.allocations.replace / assignment.delete.
 */
const meta: Meta<typeof ProjectAssignments> = {
  title: "Project Delivery/Assignments",
  component: ProjectAssignments,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ProjectAssignments>;

export const Default: Story = { name: "Назначения · задача → исполнители × дни" };
