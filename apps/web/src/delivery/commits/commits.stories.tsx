import type { Meta, StoryObj } from "@storybook/react";

import { ProjectCommits } from "@/delivery/commits/commits-surface";

/**
 * Project Delivery — поверхность «Коммиты»: PM-as-code история версий плана (по макету 09-audit).
 * Лента коммитов сессии (версия, действие, тип-чип, затронутые задачи), панель деталей
 * (planVersion, аудит-событие, raw payload) и откат последнего обратимого коммита
 * компенсирующими командами (buildCompensatingCommands + apply-command-batch).
 */
const meta: Meta<typeof ProjectCommits> = {
  title: "Project Delivery/Commits",
  component: ProjectCommits,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ProjectCommits>;

export const Default: Story = { name: "Коммиты · история и откат" };
