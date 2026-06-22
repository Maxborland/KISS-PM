import type { Meta, StoryObj } from "@storybook/react";

import { ProjectSchedule } from "@/delivery/schedule/schedule-surface";

/**
 * Project Delivery — поверхность «График» (WBS + Gantt, design v4).
 * MS Project-class: WBS-дерево, синхронный Gantt, критический путь,
 * baseline-overlay, веха, сегодня/дедлайн. Масштаб (День/Неделя/Месяц) —
 * рабочий fixture-контрол. Данные по форме planning read-model.
 */
const meta: Meta<typeof ProjectSchedule> = {
  title: "Project Delivery/Schedule",
  component: ProjectSchedule,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ProjectSchedule>;

export const Default: Story = { name: "График · WBS и Gantt" };
