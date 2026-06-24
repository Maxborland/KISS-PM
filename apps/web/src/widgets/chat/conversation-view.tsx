"use client";

import { MessageBubble } from "@/components/domain/message-bubble";

import type { ConversationView as ConversationViewModel } from "./types";

export function ConversationView({
  view,
  onToggleReaction
}: {
  view: ConversationViewModel;
  onToggleReaction?: ((messageId: string, emoji: string) => void) | undefined;
}) {
  return (
    <section className="chat-thread" aria-label={view.title}>
      <header className="chat-thread__head">
        <span className="chat-thread__title">{view.title}</span>
        {view.subtitle ? <span className="chat-thread__sub">{view.subtitle}</span> : null}
      </header>
      <div className="chat-thread__scroll">
        {view.messages.length === 0 ? (
          <p className="chat-thread__empty">Пока нет сообщений. Начните обсуждение.</p>
        ) : (
          view.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onToggleReaction={
                onToggleReaction ? (emoji) => onToggleReaction(message.id, emoji) : undefined
              }
            />
          ))
        )}
      </div>
    </section>
  );
}
