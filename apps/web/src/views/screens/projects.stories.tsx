import { expect, fireEvent, screen, waitFor, within } from "@storybook/test";

import { MOCK_PROJECT_CRM } from "@/views/catalog";
import { ProjectsListBlock } from "@/views/blocks/projects-list-block";
import { getScreenRoute } from "@/views/screens/screen-route";
import {
  screenScenarioStory,
  screenStoryArgs,
  screenStoryId,
  type ScreenStory
} from "@/views/screens/screen-story-helpers";
import { WorkspaceChrome } from "@/views/layout/workspace-chrome";

import type { Meta } from "@storybook/react";

import { screenStoryMetaBase } from "@/views/screens/screen-story-meta";
import { ScreenView } from "@/views/screens/screen-view";

const meta: Meta<typeof ScreenView> = {
  ...screenStoryMetaBase,
  title: "Screens/Проекты",
};
export default meta;


type Story = ScreenStory;

export const ProjectsList: Story = {
  id: screenStoryId("ProjectsList"), name: "Список проектов", args: screenStoryArgs("07-projects-list") };

export const ProjectDetail: Story = {
  id: screenStoryId("ProjectDetail"), name: "Карточка проекта", args: screenStoryArgs("07b-project-detail") };

export const ProjectsListFiltered: Story = {
  id: screenStoryId("ProjectsListFiltered"),
  name: "Архив и поиск",
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

export const ProjectGantt: Story = {
  id: screenStoryId("ProjectGantt"), name: "Гант проекта", args: screenStoryArgs("12-project-gantt") };

export const ProjectResources: Story = {
  id: screenStoryId("ProjectResources"), name: "Ресурсы проекта", args: screenStoryArgs("13-project-resources") };

export const ProjectBaseline: Story = {
  id: screenStoryId("ProjectBaseline"), name: "Базовый план", args: screenStoryArgs("14-project-baseline") };

export const ProjectScenarios: Story = {
  id: screenStoryId("ProjectScenarios"), name: "Сценарии", args: screenStoryArgs("15-project-scenarios") };

export const ProjectKPI: Story = {
  id: screenStoryId("ProjectKPI"), name: "KPI проекта", args: screenStoryArgs("16-project-kpi") };

export const ProjectAudit: Story = {
  id: screenStoryId("ProjectAudit"), name: "Аудит", args: screenStoryArgs("17-project-audit") };

export const ProjectCalendars: Story = {
  id: screenStoryId("ProjectCalendars"), name: "Календари", args: screenStoryArgs("18-project-calendars") };

export const ProjectsListLoading: Story = {
  id: screenStoryId("ProjectsListLoading"),
  name: "Загрузка",
  ...screenScenarioStory("07-projects-list", "loading"),
};

export const ProjectsListError: Story = {
  id: screenStoryId("ProjectsListError"),
  name: "Ошибка",
  ...screenScenarioStory("07-projects-list", "error"),
};

export const ProjectKpiLoading: Story = {
  id: screenStoryId("ProjectKpiLoading"),
  name: "KPI проекта · загрузка",
  ...screenScenarioStory("16-project-kpi", "loading"),
};

export const ProjectResourcesLoading: Story = {
  id: screenStoryId("ProjectResourcesLoading"),
  name: "Ресурсы проекта · загрузка",
  ...screenScenarioStory("13-project-resources", "loading"),
};
