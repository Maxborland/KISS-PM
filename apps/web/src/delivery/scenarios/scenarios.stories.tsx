import type { Meta, StoryObj } from "@storybook/react";

import { ProjectScenarios } from "@/delivery/scenarios/scenarios-surface";

/**
 * Project Delivery — поверхность «Сценарии»: what-if разрешение перегруза ресурса.
 * Триггер — конкретный перегруз (resource_overload); бэкенд предлагает три профиля
 * (Агрессивный — принять перегруз, Балансированный — снять половину, Устойчивый — снять весь)
 * с реальными метриками (финиш, перегруз, изм. задач, риск). Сравнение side-by-side с текущим
 * планом и применение выбранного как пакет команд (коммит). Реальный контракт
 * previewScenarios / applyScenario; агрессивный требует причину принятия риска.
 */
const meta: Meta<typeof ProjectScenarios> = {
  title: "Project Delivery/Scenarios",
  component: ProjectScenarios,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ProjectScenarios>;

export const Default: Story = { name: "Сценарии · разрешение перегруза" };
