import type { Meta, StoryObj } from "@storybook/react";

import { MyWorkSurface } from "@/workspace/my-work/my-work-surface";

/**
 * Workspace — поверхность «Мои задачи»: домашний экран текущего пользователя
 * (исполнитель = CURRENT_USER_ID) на реальном контракте (createWorkspaceClient
 * + in-memory mock; переключение на боевой API = смена apiOrigin).
 *
 * Канбан с drag-and-drop по статусам (PATCH /projects/:id/tasks/:taskId/status)
 * и список со сменой статуса через select — обе операции шлют РЕАЛЬНУЮ мутацию
 * в мок. Матрица переходов реальна: запрещённый переход возвращает 409 и
 * показывается отклонением. Реордер внутри колонки контрактом не покрыт.
 * Данные in-memory («Прототип»).
 */
const meta: Meta<typeof MyWorkSurface> = {
  title: "Workspace/My Work",
  component: MyWorkSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof MyWorkSurface>;

export const Default: Story = { name: "Мои задачи · канбан и список" };
