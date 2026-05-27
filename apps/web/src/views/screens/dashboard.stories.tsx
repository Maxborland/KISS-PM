import type { StoryObj } from "@storybook/react";

import {
  screenScenarioStory,
  screenStoryArgs,
  screenStoryId,
  type ScreenStory
} from "@/views/screens/screen-story-helpers";

import type { Meta } from "@storybook/react";

import { screenStoryMetaBase } from "@/views/screens/screen-story-meta";
import { ScreenView } from "@/views/screens/screen-view";

const meta: Meta<typeof ScreenView> = {
  ...screenStoryMetaBase,
  title: "Screens/Дашборд",
};
export default meta;


type Story = ScreenStory;

export const Dashboard: Story = {
  id: screenStoryId("Dashboard"),
  name: "Обзор",
  args: screenStoryArgs("01-dashboard")
};

export const DashboardEmptyState: Story = {
  id: screenStoryId("DashboardEmptyState"),
  name: "Пусто",
  ...screenScenarioStory("01-dashboard", "empty"),
};

export const DashboardLoading: Story = {
  id: screenStoryId("DashboardLoading"),
  name: "Загрузка",
  ...screenScenarioStory("01-dashboard", "loading"),
};

export const DashboardError: Story = {
  id: screenStoryId("DashboardError"),
  name: "Ошибка",
  ...screenScenarioStory("01-dashboard", "error"),
};

export const DashboardForbidden: Story = {
  id: screenStoryId("DashboardForbidden"),
  name: "Нет доступа",
  ...screenScenarioStory("01-dashboard", "forbidden"),
};
