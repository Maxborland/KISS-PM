import { expect, fireEvent, waitFor, within } from "@storybook/test";

import { StateScreenBlock } from "@/views/blocks/state-screen-block";
import { getScreenRoute } from "@/views/screens/screen-route";
import {
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
  title: "Screens/Состояния",
};
export default meta;


type Story = ScreenStory;

export const StateEmpty: Story = {
  id: screenStoryId("StateEmpty"), name: "Пусто", args: screenStoryArgs("state-empty") };

export const StateError: Story = {
  id: screenStoryId("StateError"), name: "Ошибка", args: screenStoryArgs("state-error") };

export const StateForbidden: Story = {
  id: screenStoryId("StateForbidden"), name: "Нет доступа", args: screenStoryArgs("state-forbidden") };

export const StateLoading: Story = {
  id: screenStoryId("StateLoading"), name: "Загрузка", args: screenStoryArgs("state-loading") };

export const StateErrorRetry: Story = {
  id: screenStoryId("StateErrorRetry"),
  name: "Ошибка · повтор",
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
