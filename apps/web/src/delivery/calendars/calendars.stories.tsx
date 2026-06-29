import type { Meta, StoryObj } from "@storybook/react";

import { ProjectCalendars } from "@/delivery/calendars/calendars-surface";

/**
 * Project Delivery — поверхность «Календари»: производственный календарь проекта (5×8, рабочая
 * неделя read-only), праздники для всех (calendar.exception.upsert с resourceId=null) и
 * персональные отсутствия ресурсов. Слева — календари/ресурсы, в центре — месячная сетка
 * (рабочий день / выходной / праздник / отсутствие; клик — добавить/снять), справа — список
 * исключений и конфликты с расписанием. Ёмкость пересчитывается (Ресурсы/Назначения опираются на неё).
 */
const meta: Meta<typeof ProjectCalendars> = {
  title: "Project Delivery/Calendars",
  component: ProjectCalendars,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ProjectCalendars>;

export const Default: Story = { name: "Календари · проект и ресурсы" };
