import type { Meta, StoryObj } from "@storybook/react";

import { DashboardSurface } from "@/workspace/dashboard/dashboard-surface";

/**
 * Workspace — функциональный «Дашборд» (summary-first). Заменяет статический
 * views/blocks/dashboard-bento.tsx.
 *
 * Собран КЛИЕНТСКОЙ АГРЕГАЦИЕЙ реальных контрактов через contract-mock
 * (переключение на боевой = apiOrigin): мои задачи (GET /api/workspace/my-work),
 * активные проекты (GET /api/workspace/projects) и сделки (CRM read-model).
 * Наверху — «Требует внимания»: реальные сигналы (просроченные задачи/сделки,
 * дедлайны ≤ 7 дней, сделки без движения), каждый сигнал и каждое число —
 * drill-down к источнику (/my-work?task=, /crm/deals?deal=, /projects).
 * Сигналов без данных в API (митинги, перегрузка ресурсов) нет сознательно.
 */
const meta: Meta<typeof DashboardSurface> = {
  title: "Workspace/Dashboard",
  component: DashboardSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof DashboardSurface>;

export const Default: Story = { name: "Дашборд · сводка" };
