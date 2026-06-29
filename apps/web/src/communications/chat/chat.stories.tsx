import type { Meta, StoryObj } from "@storybook/react";

import { ChatSurface } from "@/communications/chat/chat-surface";

/**
 * Коммуникации — поверхность «Чат»: беседы demo-сущности (project/proj-portal)
 * на реальном контракте (createCommsClient + in-memory mock; переключение на
 * боевой API = смена apiOrigin). Двухпанель: список бесед с непрочитанными слева,
 * лента сообщений + композер справа. Сообщения, реакции (toggle по своему userId),
 * стикеры, закрепление, правка/удаление (soft), «прочитано» — через ручки
 * /api/workspace/conversations/*. Данные in-memory («Прототип»); realtime-доставка
 * появится в приложении — здесь лента обновляется по действию.
 */
const meta: Meta<typeof ChatSurface> = {
  title: "Communications/Chat",
  component: ChatSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ChatSurface>;

export const Default: Story = { name: "Чат · беседы проекта" };
