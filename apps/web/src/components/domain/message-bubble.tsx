"use client";

import { Pencil, Pin } from "lucide-react";

import { BemAvatar, type BemAvatarColor } from "@/components/domain/bem-avatar";
import { ReactionBar, type ReactionView } from "@/components/domain/reaction-bar";
import { cn } from "@/lib/cn";

export type MessageView = {
  id: string;
  authorName: string;
  authorInitials: string;
  authorColor: BemAvatarColor;
  time: string;
  text: string;
  own?: boolean;
  pinned?: boolean;
  edited?: boolean;
  reactions?: ReactionView[];
};

export function MessageBubble({
  message,
  onToggleReaction
}: {
  message: MessageView;
  onToggleReaction?: ((emoji: string) => void) | undefined;
}) {
  return (
    <article className={cn("msg-bubble", message.own && "msg-bubble--own")}>
      {!message.own ? (
        <BemAvatar initials={message.authorInitials} color={message.authorColor} size="sm" />
      ) : null}
      <div className="msg-bubble__body">
        <header className="msg-bubble__head">
          <span className="msg-bubble__name">{message.own ? "Вы" : message.authorName}</span>
          <span className="msg-bubble__time">{message.time}</span>
          {message.pinned ? <Pin className="msg-bubble__icon" aria-label="Закреплено" size={12} /> : null}
          {message.edited ? <Pencil className="msg-bubble__icon" aria-label="Изменено" size={12} /> : null}
        </header>
        <p className="msg-bubble__text">{message.text}</p>
        {message.reactions ? (
          <ReactionBar reactions={message.reactions} onToggle={onToggleReaction} />
        ) : null}
      </div>
    </article>
  );
}
