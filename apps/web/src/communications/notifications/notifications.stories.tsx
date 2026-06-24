import type { Meta, StoryObj } from "@storybook/react";

import { NotificationsSurface } from "@/communications/notifications/notifications-surface";

/**
 * Коммуникации — поверхность «Уведомления»: лента + настройки доставки на
 * реальном контракте (createCommsClient + in-memory mock; переключение на
 * боевой API = смена apiOrigin). Лента (GET /notifications?status) с фильтром
 * Все/Непрочитанные/Прочитанные, per-item «Прочитать» (POST /:id/read, не
 * идемпотентно) и честный bulk = N вызовов markRead по непрочитанным.
 * Настройки — таблица channel × тип (switch + частота дайджеста), «Сохранить»
 * = полный upsert PUT /notification-preferences. Данные in-memory («Прототип»).
 */
const meta: Meta<typeof NotificationsSurface> = {
  title: "Communications/Notifications",
  component: NotificationsSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof NotificationsSurface>;

export const Default: Story = { name: "Уведомления · лента и настройки" };
