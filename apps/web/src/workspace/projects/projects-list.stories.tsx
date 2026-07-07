import type { Meta, StoryObj } from "@storybook/react";

import { ProjectsListSurface } from "@/workspace/projects/projects-list-surface";

/**
 * Workspace — поверхность «Проекты»: список активных проектов рабочей области
 * на реальном контракте (createWorkspaceClient + in-memory mock; переключение
 * на боевой API = смена apiOrigin). Таблица: проект (title + id), клиент, статус,
 * срок, сумма, план.часы, спрос (позиция · часы). Список не показывает фильтр
 * «Все», потому что контракт GET /api/workspace/projects отдаёт только активные
 * проекты. Карточка проекта — отдельный экран (навигация не
 * подключена). Данные in-memory («Прототип»).
 */
const meta: Meta<typeof ProjectsListSurface> = {
  title: "Workspace/Projects",
  component: ProjectsListSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ProjectsListSurface>;

export const Default: Story = { name: "Проекты · список" };
