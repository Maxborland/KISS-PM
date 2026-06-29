import type { Meta, StoryObj } from "@storybook/react";

import { CallsSurface } from "@/communications/calls/calls-surface";

/**
 * Коммуникации — поверхность «Звонки»: комнаты звонков проекта на реальном
 * контракте (createCommsClient + in-memory mock; переключение на боевой API =
 * смена apiOrigin). ЧЕСТНО БЕЗ WebRTC: только метаданные комнаты, таймлайн
 * событий (создание комнаты, старт сессии, выдача join-token, события
 * участников, завершение сессии, прикрепление записи) и контракт join-token.
 * «Подключиться» получает join-ссылку, но реального медиа-соединения не
 * устанавливает. Несовпадение провайдера даёт 409 video_provider_misconfigured
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
