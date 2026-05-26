import type { Meta, StoryObj } from "@storybook/react";
import { expect, fireEvent, screen, waitFor, within } from "@storybook/test";

import { DashboardBento } from "@/views/blocks/dashboard-bento";
import { DealsBlock } from "@/views/blocks/deals-block";
import { EntitiesBlock } from "@/views/blocks/entities-block";
import { EntityDetailBlock } from "@/views/blocks/entity-detail-block";
import { MyWorkBlock } from "@/views/blocks/my-work-block";
import { ProjectsListBlock } from "@/views/blocks/projects-list-block";
import { StateScreenBlock } from "@/views/blocks/state-screen-block";
import { TaskCreateModalBlock } from "@/views/blocks/task-create-modal-block";
import { MOCK_PROJECT_CRM } from "@/views/catalog";
import { getScreenRoute } from "@/views/screens/screen-route";
import { WorkspaceChrome } from "@/views/layout/workspace-chrome";
import { LoginScreenView } from "@/views/screens/login-screen-view";
import {
  SCREEN_STORY_PARAMETERS,
  screenScenarioStory,
  screenStoryArgs,
  type ScreenStory
} from "@/views/screens/screen-story-helpers";
import { ScreenView } from "@/views/screens/screen-view";

/** Колонка Kanban/Funnel: заголовок в `.kanban-col__title` (без глобального getByText). */
function kanbanColumnByTitle(root: HTMLElement, title: string): HTMLElement {
  const cols = root.querySelectorAll<HTMLElement>(".kanban-col");
  for (const col of cols) {
    const head = col.querySelector(".kanban-col__title");
    const label = head?.textContent?.trim() ?? "";
    if (label.startsWith(title)) return col;
  }
  throw new Error(`Kanban column "${title}" not found`);
}

const meta: Meta<typeof ScreenView> = {
  title: "Views/Screens",
  component: ScreenView,
  parameters: {
    ...SCREEN_STORY_PARAMETERS,
    viewport: { defaultViewport: "desktop1440" }
  },
  tags: ["!autodocs"]
};

export default meta;

type Story = ScreenStory;

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
export const Login: Story = { name: "19 Вход", args: screenStoryArgs("19-login") };

export const LoginLoading: Story = {
  name: "19 Вход · загрузка",
  render: () => <LoginScreenView variant="loading" />,
  parameters: SCREEN_STORY_PARAMETERS
};

export const LoginError: Story = {
  name: "19 Вход · ошибка",
  render: () => <LoginScreenView variant="error" />,
  parameters: SCREEN_STORY_PARAMETERS
};

export const LoginForbidden: Story = {
  name: "19 Вход · нет доступа",
  render: () => <LoginScreenView variant="forbidden" />,
  parameters: SCREEN_STORY_PARAMETERS
};

export const DashboardLoading: Story = {
  name: "01 Дашборд · загрузка",
  args: screenStoryArgs("01-dashboard"),
  parameters: { ...SCREEN_STORY_PARAMETERS, scenario: "loading" }
};

export const DashboardError: Story = {
  name: "01 Дашборд · ошибка",
  args: screenStoryArgs("01-dashboard"),
  parameters: { ...SCREEN_STORY_PARAMETERS, scenario: "error" }
};

export const DashboardForbidden: Story = {
  name: "01 Дашборд · нет доступа",
  args: screenStoryArgs("01-dashboard"),
  parameters: { ...SCREEN_STORY_PARAMETERS, scenario: "forbidden" }
};

export const MyWorkEmpty: Story = {
  name: "02 Моя работа · пусто",
  args: screenStoryArgs("02-my-work"),
  parameters: { ...SCREEN_STORY_PARAMETERS, scenario: "empty" }
};

export const MyWorkLoading: Story = {
  name: "02 Моя работа · загрузка",
  args: screenStoryArgs("02-my-work"),
  parameters: { ...SCREEN_STORY_PARAMETERS, scenario: "loading" }
};

export const MyWorkError: Story = {
  name: "02 Моя работа · ошибка",
  args: screenStoryArgs("02-my-work"),
  parameters: { ...SCREEN_STORY_PARAMETERS, scenario: "error" }
};

export const MyWorkForbidden: Story = {
  name: "02 Моя работа · нет доступа",
  args: screenStoryArgs("02-my-work"),
  parameters: { ...SCREEN_STORY_PARAMETERS, scenario: "forbidden" }
};
export const StateEmpty: Story = { name: "Состояние · пусто", args: { id: "state-empty" } };
export const StateError: Story = { name: "Состояние · ошибка", args: { id: "state-error" } };
export const StateForbidden: Story = { name: "Состояние · нет доступа", args: { id: "state-forbidden" } };
export const StateLoading: Story = { name: "Состояние · загрузка", args: { id: "state-loading" } };

export const MyWorkListMode: Story = {
  name: "02 Моя работа · список",
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("02-my-work")}>
      <MyWorkBlock initialMode="list" />
    </WorkspaceChrome>
  )
};

export const MyWorkKanbanDragging: Story = {
  name: "02 Моя работа · DnD",
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("02-my-work")}>
      <MyWorkBlock initialMode="kanban" />
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = await canvas.findByLabelText(/Открыть карточку MDS-39/i);
    const target = kanbanColumnByTitle(canvasElement, "В работе");
    if (!card) return;

    const cardRect = card.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    fireEvent.pointerDown(card, {
      pointerId: 1,
      button: 0,
      clientX: cardRect.left + 8,
      clientY: cardRect.top + 8
    });
    fireEvent.pointerMove(card, {
      pointerId: 1,
      clientX: cardRect.left + 60,
      clientY: cardRect.top + 60
    });
    fireEvent.pointerMove(target, {
      pointerId: 1,
      clientX: targetRect.left + targetRect.width / 2,
      clientY: targetRect.top + targetRect.height / 2
    });
    fireEvent.pointerUp(target, {
      pointerId: 1,
      clientX: targetRect.left + targetRect.width / 2,
      clientY: targetRect.top + targetRect.height / 2
    });

    await waitFor(() => {
      const inProgressCol = kanbanColumnByTitle(canvasElement, "В работе");
      expect(within(inProgressCol).queryByText("Новая страница продукта")).toBeTruthy();
    });

    const openCard = await canvas.findByLabelText(/Открыть карточку MDS-2/i);
    openCard.focus();
    fireEvent.keyDown(openCard, { key: "Enter", code: "Enter" });
    await waitFor(() => {
      expect(screen.queryAllByText("Презентация для клиента").length).toBeGreaterThan(0);
    });
  }
};

export const DashboardEmptyState: Story = screenScenarioStory(
  "01-dashboard",
  "01 Дашборд · пусто",
  "empty"
);

export const AdminLoading: Story = screenScenarioStory(
  "09-admin",
  "09 Администрирование · загрузка",
  "loading"
);

export const AdminError: Story = screenScenarioStory("09-admin", "09 Администрирование · ошибка", "error");

export const AdminForbidden: Story = screenScenarioStory(
  "09-admin",
  "09 Администрирование · нет доступа",
  "forbidden"
);

export const DealsLoading: Story = screenScenarioStory("05-deals", "05 Сделки · загрузка", "loading");

export const DealsError: Story = screenScenarioStory("05-deals", "05 Сделки · ошибка", "error");

export const DealsForbidden: Story = screenScenarioStory("05-deals", "05 Сделки · нет доступа", "forbidden");

export const ProjectsListLoading: Story = screenScenarioStory(
  "07-projects-list",
  "07 Список проектов · загрузка",
  "loading"
);

export const ProjectsListError: Story = screenScenarioStory(
  "07-projects-list",
  "07 Список проектов · ошибка",
  "error"
);

export const ProjectKpiLoading: Story = screenScenarioStory(
  "16-project-kpi",
  "16 KPI проекта · загрузка",
  "loading"
);

export const ProjectResourcesLoading: Story = screenScenarioStory(
  "13-project-resources",
  "13 Ресурсы проекта · загрузка",
  "loading"
);

export const EntitiesClientsLoading: Story = screenScenarioStory(
  "08-entities-clients",
  "08 Справочник клиентов · загрузка",
  "loading"
);

export const DealsFunnelDragging: Story = {
  name: "05 Сделки · DnD",
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("05-deals")}>
      <DealsBlock />
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const card = await canvas.findByLabelText(/Открыть сделку DEAL-103/i);
    const target = kanbanColumnByTitle(canvasElement, "КП");
    if (!card) return;
    const cardRect = card.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    fireEvent.pointerDown(card, {
      pointerId: 1,
      button: 0,
      clientX: cardRect.left + 8,
      clientY: cardRect.top + 8
    });
    fireEvent.pointerMove(card, {
      pointerId: 1,
      clientX: cardRect.left + 60,
      clientY: cardRect.top + 60
    });
    fireEvent.pointerMove(target, {
      pointerId: 1,
      clientX: targetRect.left + targetRect.width / 2,
      clientY: targetRect.top + targetRect.height / 2
    });
    fireEvent.pointerUp(target, {
      pointerId: 1,
      clientX: targetRect.left + targetRect.width / 2,
      clientY: targetRect.top + targetRect.height / 2
    });
    await waitFor(() => {
      const proposalCol = kanbanColumnByTitle(canvasElement, "КП");
      expect(within(proposalCol).queryByText("Аудит Salesforce")).toBeTruthy();
    });
  }
};

export const CreateTaskModalStep1: Story = {
  name: "04 Модалка · шаг 1 (Контекст)",
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("04-create-task-modal")}>
      <TaskCreateModalBlock initialStep={1} />
    </WorkspaceChrome>
  )
};

export const CreateTaskModalValidation: Story = {
  name: "04 Модалка · валидация названия",
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("04-create-task-modal")}>
      <TaskCreateModalBlock initialStep={2} />
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const next = canvas.getByRole("button", { name: "Далее" });
    fireEvent.click(next);
    await waitFor(() => {
      expect(canvas.getByText(/Название: от 3 до 160 символов/i)).toBeTruthy();
    });
    const nameInput = canvas.getByLabelText(/Название/i) as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Согласовать ТЗ" } });
    fireEvent.click(next);
    await waitFor(() => {
      expect(canvas.getByRole("heading", { level: 3, name: "Участники" })).toBeTruthy();
      expect(canvas.getByRole("button", { name: /3\s+Участники/ })).toHaveAttribute("aria-current", "step");
    });
  }
};

export const EntityDetailDirty: Story = {
  name: "06 Карточка сделки · dirty save",
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("06-deal-card")}>
      <EntityDetailBlock
        title="Сделка «Ромашка»"
        subtitle="DEAL-101 · ООО «Ромашка»"
        stage={{ label: "Квалификация", tone: "violet" }}
      />
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const save = canvas.getByRole("button", { name: "Сохранить" });
    expect(save.hasAttribute("disabled")).toBe(true);
    const amount = canvas.getByLabelText(/Сумма/i) as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "920 000" } });
    await waitFor(() => {
      expect(canvas.getByRole("button", { name: /Сохранить · есть изменения/i })).toBeTruthy();
    });
    fireEvent.click(canvas.getByRole("button", { name: /Сохранить · есть изменения/i }));
    await waitFor(() => {
      expect(canvas.getByRole("button", { name: "Сохранить" }).hasAttribute("disabled")).toBe(true);
    });
  }
};

export const ProjectsListFiltered: Story = {
  name: "07 Список проектов · архив и поиск",
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("07-projects-list")}>
      <ProjectsListBlock />
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    fireEvent.click(canvas.getByRole("radio", { name: "Архив" }));
    await waitFor(() => {
      expect(canvas.getByText("Портал поддержки")).toBeTruthy();
      expect(canvas.queryByText(MOCK_PROJECT_CRM)).toBeNull();
    });
    fireEvent.click(canvas.getByRole("radio", { name: "Активные" }));
    const search = canvas.getByPlaceholderText(/Код или название/i) as HTMLInputElement;
    fireEvent.change(search, { target: { value: "DataHub" } });
    await waitFor(() => {
      expect(canvas.queryByText(MOCK_PROJECT_CRM)).toBeNull();
      expect(canvas.getByText("DataHub KPI")).toBeTruthy();
    });
    const row = canvas.getByLabelText(/Открыть DataHub KPI/i);
    fireEvent.click(row);
    await waitFor(() => {
      expect(screen.queryAllByText("DataHub KPI").length).toBeGreaterThan(1);
    });
  }
};

export const StateErrorRetry: Story = {
  name: "Состояние · ошибка · повтор",
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("state-error")}>
      <StateScreenBlock kind="error" />
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    fireEvent.click(canvas.getByRole("button", { name: "Повторить" }));
    await waitFor(() => {
      expect(canvas.getByText(/Повтор 1/i)).toBeTruthy();
    });
  }
};

export const EntitiesClientsFiltered: Story = {
  name: "08 Справочник клиентов · поиск",
  render: () => (
    <WorkspaceChrome meta={getScreenRoute("08-entities-clients")}>
      <EntitiesBlock kind="clients" />
    </WorkspaceChrome>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByPlaceholderText(/Поиск в «Клиенты»/i) as HTMLInputElement;
    fireEvent.change(search, { target: { value: "Техно" } });
    await waitFor(() => {
      expect(canvas.queryByText("ООО «Ромашка»")).toBeNull();
      expect(canvas.queryByText("АО «Техно»")).toBeTruthy();
    });
    const row = canvas.getByLabelText(/Открыть АО «Техно»/i);
    fireEvent.click(row);
    await waitFor(() => {
      expect(screen.queryAllByText("АО «Техно»").length).toBeGreaterThan(0);
    });
  }
};
