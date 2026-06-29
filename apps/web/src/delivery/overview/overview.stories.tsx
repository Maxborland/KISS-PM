import type { Meta, StoryObj } from "@storybook/react";

import { ProjectOverview } from "@/delivery/overview/overview-surface";

/**
 * Project Delivery — поверхность «Обзор» (design v4, чекпоинт 1).
 * Контракт-граундед прототип: данные по форме planning read-model.
 */
const meta: Meta<typeof ProjectOverview> = {
  title: "Project Delivery/Overview",
  component: ProjectOverview,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ProjectOverview>;

export const Default: Story = { name: "Обзор проекта" };
