import type { Meta, StoryObj } from "@storybook/react";

import { MeetingsSurface } from "@/communications/meetings/meetings-surface";

/**
 * Коммуникации — поверхность «Встречи»: список митингов проекта (createCommsClient
 * + in-memory mock; переключение на боевой API = смена apiOrigin) и детальная
 * панель выбранного — повестка, участники, ноты, внешние ссылки, action-items.
 * Создание встречи — POST /meetings (datetime-local + мультивыбор участников),
 * смена статуса — PATCH /meetings/:id. Данные in-memory («Прототип»);
 * realtime-доставка — в приложении, здесь обновление по действию.
 */
const meta: Meta<typeof MeetingsSurface> = {
  title: "Communications/Meetings",
  component: MeetingsSurface,
  parameters: { layout: "fullscreen" },
  tags: ["!autodocs"]
};

export default meta;

type Story = StoryObj<typeof MeetingsSurface>;

export const Default: Story = { name: "Встречи · список и детали" };
