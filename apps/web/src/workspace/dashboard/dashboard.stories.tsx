import type { Meta, StoryObj } from "@storybook/react";

import { DashboardSurface } from "@/workspace/dashboard/dashboard-surface";

/**
 * Workspace — функциональный «Дашборд» (персональный home). Заменяет статический
 * views/blocks/dashboard-bento.tsx.
 *
 * Собран КЛИЕНТСКОЙ АГРЕГАЦИЕЙ реальных контрактов через contract-mock
 * (переключение на боевой = apiOrigin): мои задачи (GET /api/workspace/my-work),
 * активные проекты (GET /api/workspace/projects) и сделки (CRM read-model).
 * Tenant-широкого агрегата у ручек нет — KPI/списки считаются на клиенте; чего
 * контракт не даёт (митинги/сигналы дня) — честный плейсхолдер, не фейк.
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
