import type { Meta, StoryObj } from "@storybook/react";

import { ProjectDetailSurface } from "@/workspace/project-detail/project-detail-surface";

/**
 * Workspace — поверхность «Карточка проекта»: внутренний экран рабочей области
 * (WorkspaceShell, навигация «Проекты»). Шапка проекта (название, клиент,
 * статус, срок, сумма, план.часы), таблица задач команды (статус/исполнитель/
 * срок/прогресс) и сводка по объёму/демэнду.
 *
 * Работает через настоящий createWorkspaceClient + in-memory mock
 * (переключение на боевой API = смена apiOrigin). Селектор проекта сверху
 * переключает реальный запрос GET /api/workspace/projects/:id; список —
 * GET /api/workspace/projects (активные). Данные in-memory («Прототип»).
 */
const meta: Meta<typeof ProjectDetailSurface> = {
  title: "Workspace/Project Card",
  component: ProjectDetailSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ProjectDetailSurface>;

export const Default: Story = { name: "Карточка проекта · задачи и сводка" };
