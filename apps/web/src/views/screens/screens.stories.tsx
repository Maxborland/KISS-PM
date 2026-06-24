import type { Meta, StoryObj } from "@storybook/react";

import { ScreenView } from "@/views/screens/screen-view";

const meta: Meta<typeof ScreenView> = {
  title: "Views/Screens",
  component: ScreenView,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ScreenView>;

// Только экраны-прототипы без функционального surface-аналога; остальные 00–19 живут
// как функциональные поверхности в группах Project Delivery / CRM / Workspace / Admin / Auth.
export const SpaceDiscipline: Story = { name: "00 Дисциплина отступов", args: { id: "00-space-discipline" } };
export const Dashboard: Story = { name: "01 Дашборд", args: { id: "01-dashboard" } };
export const CreateTaskModal: Story = { name: "04 Модалка создания задачи", args: { id: "04-create-task-modal" } };
export const Settings: Story = { name: "10 Настройки", args: { id: "10-settings" } };
export const ProjectKPI: Story = { name: "16 KPI проекта", args: { id: "16-project-kpi" } };
export const StateEmpty: Story = { name: "Состояние · пусто", args: { id: "state-empty" } };
export const StateError: Story = { name: "Состояние · ошибка", args: { id: "state-error" } };
export const StateForbidden: Story = { name: "Состояние · нет доступа", args: { id: "state-forbidden" } };
export const StateLoading: Story = { name: "Состояние · загрузка", args: { id: "state-loading" } };
