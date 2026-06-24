"use client";

import { ChatWidget, type ConversationViewModel } from "@/widgets/chat";
import {
  CHAT_CHANNELS_MOCK,
  CHAT_CONVERSATION_MOCK,
  CHAT_EMPTY_CONVERSATION_MOCK
} from "@/widgets/chat/chat-widget.mocks";

const THREAD_MOCK: ConversationViewModel = {
  title: "Обсуждение задачи MDS-39",
  subtitle: "Согласовать ТЗ · Внедрение CRM",
  messages: CHAT_CONVERSATION_MOCK.messages
};

export function ChatChannelsBlock() {
  return <ChatWidget channels={CHAT_CHANNELS_MOCK} conversation={CHAT_CONVERSATION_MOCK} disabled />;
}

export function ChatThreadBlock() {
  return <ChatWidget channels={CHAT_CHANNELS_MOCK} conversation={THREAD_MOCK} disabled />;
}

export function ChatComposerBlock() {
  return <ChatWidget channels={CHAT_CHANNELS_MOCK} conversation={CHAT_EMPTY_CONVERSATION_MOCK} disabled />;
}
