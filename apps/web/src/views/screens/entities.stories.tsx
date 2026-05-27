import { expect, fireEvent, screen, waitFor, within } from "@storybook/test";

import { EntitiesBlock } from "@/views/blocks/entities-block";
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
  title: "Screens/Справочники",
};
export default meta;


type Story = ScreenStory;

export const EntitiesClients: Story = {
  id: screenStoryId("EntitiesClients"), name: "Клиенты", args: screenStoryArgs("08-entities-clients") };

export const EntitiesContacts: Story = {
  id: screenStoryId("EntitiesContacts"), name: "Контакты", args: screenStoryArgs("08-entities-contacts") };

export const EntitiesProducts: Story = {
  id: screenStoryId("EntitiesProducts"), name: "Продукты", args: screenStoryArgs("08-entities-products") };

export const EntitiesClientsFiltered: Story = {
  id: screenStoryId("EntitiesClientsFiltered"),
  name: "Поиск",
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

export const EntitiesClientsLoading: Story = {
  id: screenStoryId("EntitiesClientsLoading"),
  name: "Загрузка",
  ...screenScenarioStory("08-entities-clients", "loading")
};
