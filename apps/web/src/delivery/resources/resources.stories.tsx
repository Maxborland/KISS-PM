import type { Meta, StoryObj } from "@storybook/react";

import { ProjectResources } from "@/delivery/resources/resources-surface";
import { PortfolioResources } from "@/delivery/resources/portfolio-resources";

/**
 * Project Delivery — поверхность «Ресурсы»: матрица загрузки (референс BitrixReports2).
 * Один универсальный компонент ResourceLoadMatrix работает на всех уровнях — меняется
 * только скоуп (scope.groupLevels + источник данных):
 *  • Project — внутри проекта, живой usePlanning, редактируемо (задачи/часы/перегруз/отсутствие);
 *  • Portfolio — отчётный уровень (компания/команда) по нескольким проектам, read-only.
 * Строки = команда → роль → человек (сворачиваемые), колонки = периоды (день/неделя/месяц),
 * ячейки = часы за период с теплокартой; перегруз красным, отсутствие фиолетовым.
 * На портфельном уровне ёмкость человека считается один раз, а назначения суммируются по
 * проектам — поэтому виден межпроектный перегруз. Данные по реальной форме planning resourceLoad.
 */
const meta: Meta = {
  title: "Project Delivery/Resources",
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj;

export const Default: Story = { name: "Проект · матрица загрузки", render: () => <ProjectResources /> };

export const Portfolio: Story = { name: "Портфель · компания / команда", render: () => <PortfolioResources /> };
