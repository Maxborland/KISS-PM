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

export const SpaceDiscipline: Story = { name: "00 Дисциплина отступов", args: { id: "00-space-discipline" } };
export const Dashboard: Story = { name: "01 Дашборд", args: { id: "01-dashboard" } };
export const MyWork: Story = { name: "02 Моя работа", args: { id: "02-my-work" } };
export const TaskCard: Story = { name: "03 Карточка задачи", args: { id: "03-task-card" } };
export const CreateTaskModal: Story = { name: "04 Модалка создания задачи", args: { id: "04-create-task-modal" } };
export const Deals: Story = { name: "05 Сделки", args: { id: "05-deals" } };
export const DealCard: Story = { name: "06 Карточка сделки", args: { id: "06-deal-card" } };
export const ProjectsList: Story = { name: "07 Список проектов", args: { id: "07-projects-list" } };
export const ProjectDetail: Story = { name: "07b Карточка проекта", args: { id: "07b-project-detail" } };
export const EntitiesClients: Story = { name: "08 Справочник клиентов", args: { id: "08-entities-clients" } };
export const EntitiesContacts: Story = { name: "08 Справочник контактов", args: { id: "08-entities-contacts" } };
export const EntitiesProducts: Story = { name: "08 Справочник продуктов", args: { id: "08-entities-products" } };
export const Admin: Story = { name: "09 Администрирование", args: { id: "09-admin" } };
export const Settings: Story = { name: "10 Настройки", args: { id: "10-settings" } };
export const AvatarMenu: Story = { name: "11 Меню аватара", args: { id: "11-avatar-menu" } };
export const ProjectGantt: Story = { name: "12 Гант проекта", args: { id: "12-project-gantt" } };
export const ProjectResources: Story = { name: "13 Ресурсы проекта", args: { id: "13-project-resources" } };
export const ProjectBaseline: Story = { name: "14 Базовый план проекта", args: { id: "14-project-baseline" } };
export const ProjectScenarios: Story = { name: "15 Сценарии проекта", args: { id: "15-project-scenarios" } };
export const ProjectKPI: Story = { name: "16 KPI проекта", args: { id: "16-project-kpi" } };
export const ProjectAudit: Story = { name: "17 Аудит проекта", args: { id: "17-project-audit" } };
export const ProjectCalendars: Story = { name: "18 Календари проекта", args: { id: "18-project-calendars" } };
export const Login: Story = { name: "19 Вход", args: { id: "19-login" } };
export const StateEmpty: Story = { name: "Состояние · пусто", args: { id: "state-empty" } };
export const StateError: Story = { name: "Состояние · ошибка", args: { id: "state-error" } };
export const StateForbidden: Story = { name: "Состояние · нет доступа", args: { id: "state-forbidden" } };
export const StateLoading: Story = { name: "Состояние · загрузка", args: { id: "state-loading" } };
