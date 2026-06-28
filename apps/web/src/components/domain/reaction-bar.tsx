"use client";

import { cn } from "@/lib/cn";

export type ReactionView = { emoji: string; count: number; reactedByMe?: boolean };

export function ReactionBar({
  reactions,
  onToggle
}: {
  reactions: ReactionView[];
  onToggle?: ((emoji: string) => void) | undefined;
}) {
  if (reactions.length === 0) return null;
  return (
    <div className="reaction-bar">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          className={cn("reaction", reaction.reactedByMe && "reaction--mine")}
          aria-pressed={reaction.reactedByMe ?? false}
          aria-label={`Реакция ${reaction.emoji}, ${reaction.count}`}
          disabled={!onToggle}
          onClick={onToggle ? () => onToggle(reaction.emoji) : undefined}
        >
          <span className="reaction__emoji" aria-hidden>
            {reaction.emoji}
          </span>
          <span className="reaction__count">{reaction.count}</span>
        </button>
      ))}
    </div>
  );
}
