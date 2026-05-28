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
  title: "Screens/Администрирование",
};
export default meta;


type Story = ScreenStory;

export const Admin: Story = {
  id: screenStoryId("Admin"), name: "Администрирование", args: screenStoryArgs("09-admin") };

export const Settings: Story = {
  id: screenStoryId("Settings"), name: "Настройки", args: screenStoryArgs("10-settings") };

export const AvatarMenu: Story = {
  id: screenStoryId("AvatarMenu"), name: "Меню аватара", args: screenStoryArgs("11-avatar-menu") };

export const AdminLoading: Story = {
  id: screenStoryId("AdminLoading"),
  name: "Загрузка",
  ...screenScenarioStory("09-admin", "loading")
};

export const AdminError: Story = {
  id: screenStoryId("AdminError"),
  name: "Ошибка",
  ...screenScenarioStory("09-admin", "error")
};

export const AdminForbidden: Story = {
  id: screenStoryId("AdminForbidden"),
  name: "Нет доступа",
  ...screenScenarioStory("09-admin", "forbidden")
};
