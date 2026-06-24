import type { MessageView } from "@/components/domain/message-bubble";
import type { PresenceStatus } from "@/components/domain/presence-dot";

// View-model contract for the chat surface. Pure data shared by the static
// Storybook twin and the live runtime container.

export type ConversationView = {
  title: string;
  subtitle?: string;
  messages: MessageView[];
};

export type ChannelView = {
  id: string;
  name: string;
  kind: "channel" | "dm";
  unread?: number;
  active?: boolean;
  presence?: PresenceStatus;
};

export type ChannelListView = {
  channels: ChannelView[];
};

export type { MessageView, PresenceStatus };
