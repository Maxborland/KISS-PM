import {
  SCREEN_STORY_PARAMETERS,
  screenStoryArgs,
  screenStoryId,
  type ScreenStory
} from "@/views/screens/screen-story-helpers";
import { LoginScreenView } from "@/views/screens/login-screen-view";

import type { Meta } from "@storybook/react";

import { screenStoryMetaBase } from "@/views/screens/screen-story-meta";
import { ScreenView } from "@/views/screens/screen-view";

const meta: Meta<typeof ScreenView> = {
  ...screenStoryMetaBase,
  title: "Screens/Авторизация",
};
export default meta;


type Story = ScreenStory;

export const Login: Story = {
  id: screenStoryId("Login"), name: "Вход", args: screenStoryArgs("19-login") };

export const LoginLoading: Story = {
  id: screenStoryId("LoginLoading"),
  name: "Загрузка",
  render: () => <LoginScreenView variant="loading" />,
  parameters: SCREEN_STORY_PARAMETERS
};

export const LoginError: Story = {
  id: screenStoryId("LoginError"),
  name: "Ошибка",
  render: () => <LoginScreenView variant="error" />,
  parameters: SCREEN_STORY_PARAMETERS
};

export const LoginForbidden: Story = {
  id: screenStoryId("LoginForbidden"),
  name: "Нет доступа",
  render: () => <LoginScreenView variant="forbidden" />,
  parameters: SCREEN_STORY_PARAMETERS
};
