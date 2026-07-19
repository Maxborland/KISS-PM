import type { Meta, StoryObj } from "@storybook/react";

import { CallsSurface } from "@/communications/calls/calls-surface";

/**
 * Коммуникации — поверхность «Звонки»: комнаты звонков проекта на реальном
 * контракте (createCommsClient + in-memory mock; переключение на боевой API =
 * смена apiOrigin). Метаданные комнаты, таймлайн событий (создание комнаты,
 * старт сессии, выдача join-token, события участников, завершение сессии,
 * прикрепление записи) и управление сессией. «Открыть комнату» ведёт в живую
 * комнату звонка /calls/{roomId} (в Storybook — просто ссылка); сырой контракт
 * join-ссылки — dev-кнопка «Данные подключения» (prototypeNotesEnabled).
 * Несовпадение провайдера даёт 409 video_provider_misconfigured
 * (честный баннер). Данные in-memory («Прототип»).
 */
const meta: Meta<typeof CallsSurface> = {
  title: "Communications/Calls",
  component: CallsSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof CallsSurface>;

export const Default: Story = { name: "Звонки · комнаты и сессии" };
