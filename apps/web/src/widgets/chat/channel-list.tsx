"use client";

import { Hash, Search } from "lucide-react";

import { PresenceDot } from "@/components/domain/presence-dot";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

import type { ChannelListView } from "./types";

export function ChannelList({
  view,
  onSelect,
  disabled
}: {
  view: ChannelListView;
  onSelect?: ((channelId: string) => void) | undefined;
  disabled?: boolean | undefined;
}) {
  return (
    <nav className="chat-rail" aria-label="Каналы и личные сообщения">
      <div className="chat-rail__search">
        <Search className="chat-rail__search-icon" aria-hidden size={16} />
        <Input placeholder="Поиск канала…" aria-label="Поиск канала" disabled={disabled} />
      </div>
      <ul className="chat-rail__list">
        {view.channels.map((channel) => (
          <li key={channel.id}>
            <button
              type="button"
              className={cn("chat-channel", channel.active && "chat-channel--active")}
              aria-current={channel.active ? "page" : undefined}
              disabled={disabled}
              onClick={onSelect ? () => onSelect(channel.id) : undefined}
            >
              {channel.kind === "dm" && channel.presence ? (
                <PresenceDot status={channel.presence} />
              ) : (
                <Hash className="chat-channel__icon" aria-hidden size={15} />
              )}
              <span className="chat-channel__name">{channel.name}</span>
              {channel.unread ? <Badge variant="primary">{channel.unread}</Badge> : null}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
