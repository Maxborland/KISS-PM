"use client";

import { BannerInline } from "@/components/ui/banner-inline";
import { UI_ONLY_PREVIEW_BANNER_TEXT, isUiOnlyPreview } from "@/lib/featureFlags";

import { ChannelList } from "./channel-list";
import { ConversationView } from "./conversation-view";
import { MessageComposer } from "./message-composer";
import type { ChannelListView, ConversationView as ConversationViewModel } from "./types";

export type ChatWidgetProps = {
  channels: ChannelListView;
  conversation: ConversationViewModel;
  onSend?: (text: string) => void;
  onSelectChannel?: (channelId: string) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  disabled?: boolean;
};

// 3-pane chat surface. The same component renders from a literal mock (Storybook
// twin, disabled + preview banner) and from live state (runtime container).
export function ChatWidget({
  channels,
  conversation,
  onSend,
  onSelectChannel,
  onToggleReaction,
  disabled
}: ChatWidgetProps) {
  const showPreviewBanner = Boolean(disabled) && isUiOnlyPreview("chat");
  return (
    <div className="chat-shell">
      <ChannelList view={channels} onSelect={onSelectChannel} disabled={disabled} />
      <div className="chat-shell__main">
        {showPreviewBanner ? (
          <BannerInline variant="warn">{UI_ONLY_PREVIEW_BANNER_TEXT}</BannerInline>
        ) : null}
        <ConversationView view={conversation} onToggleReaction={onToggleReaction} />
        <MessageComposer onSend={onSend} disabled={disabled} />
      </div>
    </div>
  );
}
