import type { Meta, StoryObj } from "@storybook/react";

import { ChatWidget } from "./chat-widget";
import {
  CHAT_CHANNELS_MOCK,
  CHAT_CONVERSATION_MOCK,
  CHAT_EMPTY_CONVERSATION_MOCK
} from "./chat-widget.mocks";

const meta: Meta<typeof ChatWidget> = {
  title: "Widgets/Чат",
  component: ChatWidget,
  parameters: { layout: "fullscreen" }
};

export default meta;
type Story = StoryObj<typeof ChatWidget>;

// Static twin: controls disabled behind the preview banner (no fake affordances).
export const Default: Story = {
  name: "По умолчанию",
  render: () => (
    <ChatWidget channels={CHAT_CHANNELS_MOCK} conversation={CHAT_CONVERSATION_MOCK} disabled />
  )
};

export const Empty: Story = {
  name: "Пусто",
  render: () => (
    <ChatWidget channels={CHAT_CHANNELS_MOCK} conversation={CHAT_EMPTY_CONVERSATION_MOCK} disabled />
  )
};
