import type { Meta, StoryObj } from "@storybook/react";

import { ProjectSettings } from "@/delivery/settings/settings-surface";

/**
 * Project Delivery — поверхность «Настройки»: минимальные project-level параметры на реальном
 * контракте. Редактируемое — дедлайн релиза (project.deadline.move с обязательной причиной →
 * preview/apply с bump версии плана). Read-only — календарь по умолчанию (каталог календарей вне
 * планировочного read-model), старт/расчётный финиш, источник (сделка CRM), ID/версия, сводка
 * режима планирования. Права и интеграции показаны честно (вне планировочного read-model /
 * роадмап), без выдуманных данных.
 */
const meta: Meta<typeof ProjectSettings> = {
  title: "Project Delivery/Settings",
  component: ProjectSettings,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ProjectSettings>;

export const Default: Story = { name: "Настройки · дедлайн и календарь" };
