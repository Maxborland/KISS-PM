import type { Meta, StoryObj } from "@storybook/react";

import { ChannelsSurface } from "@/communications/channels/channels-surface";

/**
 * Коммуникации — поверхность «Каналы»: список каналов рабочей области
 * (createCommsClient + in-memory mock; переключение на боевой API = смена apiOrigin).
 * Слева — каналы с бейджем типа (workspace_general/team/project_general/custom),
 * справа — детальная панель: инфо, участники (роли owner/moderator/member),
 * добавление/удаление, правка названия/описания (manage) и компактная лента беседы
 * канала (POST/GET /communication-channels/:id/conversation). Системный «Общий»
 * не создаётся и не управляется. Данные in-memory («Прототип»).
 */
const meta: Meta<typeof ChannelsSurface> = {
  title: "Communications/Channels",
  component: ChannelsSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof ChannelsSurface>;

export const Default: Story = { name: "Каналы · список и детали" };
