import type { Meta, StoryObj } from "@storybook/react";

import { ProjectBaseline } from "@/delivery/baseline/baseline-surface";

/**
 * Project Delivery — поверхность «Baseline»: сравнение текущего плана с зафиксированным
 * базовым планом. История снимков (активный = последний), метрики отклонения (Δ финиша,
 * изменено задач, Δ труда) и таблица отклонений по задачам (срок/труд, Δ дн./ч, кр.путь,
 * добавленные). Фиксация нового снимка — реальной командой baseline.capture.
 */
const meta: Meta<typeof ProjectBaseline> = {
  title: "Project Delivery/Baseline",
  component: ProjectBaseline,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ProjectBaseline>;

export const Default: Story = { name: "Baseline · отклонения от базового плана" };
