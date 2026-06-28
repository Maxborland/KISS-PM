"use client";

import { AtSign, Paperclip, Send, Smile } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Textarea } from "@/components/ui/textarea";

export function MessageComposer({
  onSend,
  disabled,
  showExtras = true
}: {
  onSend?: ((text: string) => void) | undefined;
  disabled?: boolean | undefined;
  showExtras?: boolean | undefined;
}) {
  return (
    <form
      className="chat-composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled || !onSend) return;
        const field = event.currentTarget.elements.namedItem("message");
        const value = field instanceof HTMLTextAreaElement ? field.value.trim() : "";
        if (!value) return;
        onSend(value);
        event.currentTarget.reset();
      }}
    >
      <Textarea
        name="message"
        rows={2}
        placeholder="Написать сообщение…"
        aria-label="Сообщение"
        disabled={disabled}
      />
      <div className="chat-composer__actions">
        {showExtras ? (
          <>
            <IconButton label="Упомянуть" variant="ghost" disabled={disabled}>
              <AtSign />
            </IconButton>
            <IconButton label="Стикеры" variant="ghost" disabled={disabled}>
              <Smile />
            </IconButton>
            <IconButton label="Прикрепить" variant="ghost" disabled={disabled}>
              <Paperclip />
            </IconButton>
          </>
        ) : null}
        <Button variant="primary" size="sm" type="submit" disabled={disabled}>
          <Send className="size-4" aria-hidden />
          Отправить
        </Button>
      </div>
    </form>
  );
}
