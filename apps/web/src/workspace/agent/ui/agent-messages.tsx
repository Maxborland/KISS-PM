"use client";

import { Bot, Check, Clock3, MessageSquare } from "lucide-react";

import { Spinner } from "@/components/ui/loaders";
import { cn } from "@/lib/cn";
import type { AgentMessage } from "@/workspace/agent/agent-model";

/**
 * Тред сообщений агента. role="log" — чат-лог с имплицитным aria-live=polite:
 * новые ответы и шаги озвучиваются скринридером без ручных live-регионов.
 */
export function ChatThread({
  messages,
  thinking,
  liveSteps
}: {
  messages: AgentMessage[];
  thinking: boolean;
  liveSteps: string[];
}) {
  return (
    <div
      role="log"
      aria-label="Диалог с агентом"
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 md:px-6"
    >
      {messages.length === 0 && !thinking ? <ChatEmpty /> : null}
      {messages.map((message) =>
        message.role === "trace" ? (
          // aria-live=off: шаги уже были озвучены при стриме — повторная вставка
          // завершённого трейса не должна объявляться второй раз.
          <div key={message.id} aria-live="off">
            <TraceSteps steps={message.steps} done failed={message.failed ?? false} />
          </div>
        ) : (
          <MessageBubble key={message.id} message={message} />
        )
      )}
      {thinking ? <TraceSteps steps={liveSteps} done={false} /> : null}
    </div>
  );
}

function ChatEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-[var(--muted)]">
      <MessageSquare className="size-5" aria-hidden />
      <span className="text-[length:var(--text-sm)]">
        Опишите задачу: Генри подготовит изменения и покажет их на сверку перед применением.
      </span>
    </div>
  );
}

function MessageBubble({ message }: { message: Extract<AgentMessage, { role: "user" | "agent" }> }) {
  const isUser = message.role === "user";
  return (
    // 720px — намеренная локальная мера строки треда (комфортное чтение);
    // токен не заводим до второго консьюмера.
    <article className={cn("flex max-w-[720px] gap-2.5", isUser && "self-end flex-row-reverse")}>
      <span
        aria-hidden
        className={cn(
          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-[length:var(--text-2xs)] font-semibold",
          isUser
            ? "bg-[var(--panel-strong)] text-[var(--muted-strong)]"
            : "bg-[var(--accent-soft)] text-[var(--accent)]"
        )}
      >
        {isUser ? "Вы" : <Bot className="size-4" aria-hidden />}
      </span>
      <div className={cn("min-w-0", isUser && "text-right")}>
        <div className={cn("mb-0.5 flex items-baseline gap-2 text-[length:var(--text-xs)] text-[var(--muted)]", isUser && "justify-end")}>
          <span className="font-medium text-[var(--muted-strong)]">{isUser ? "Вы" : "Генри Гантт"}</span>
          <time>{message.time}</time>
        </div>
        <p
          className={cn(
            "whitespace-pre-wrap rounded-[var(--radius-lg)] px-3 py-2 text-left text-[length:var(--text-md)] leading-[var(--lh-md)] text-[var(--text)]",
            isUser ? "bg-[var(--panel-strong)]" : "bg-[var(--panel)] border border-[var(--border)]",
            message.role === "agent" && message.kind === "error" && "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger-text)]",
            // result: только акцентная рамка на dark-адаптированной панели —
            // accent-soft не имеет тёмного значения и делал текст нечитаемым в dark.
            message.role === "agent" && message.kind === "result" && "border-[var(--accent)]"
          )}
        >
          {message.text}
        </p>
      </div>
    </article>
  );
}

/**
 * CoT-шаги агента. Только реальные события SSE — до первого события честный
 * индикатор «анализирует», без выдуманных шагов (демо-fallback удалён сознательно).
 */
export function TraceSteps({ steps, done, failed = false }: { steps: string[]; done: boolean; failed?: boolean }) {
  return (
    <div role="group" className="ml-9 flex max-w-[720px] flex-col gap-1" aria-label="Действия агента">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        const settled = done || !last;
        const interrupted = failed && last;
        return (
          <div key={`${index}-${step}`} className="flex items-start gap-2 text-[length:var(--text-sm)] text-[var(--muted-strong)]">
            <span className="mt-0.5 grid size-4 shrink-0 place-items-center text-[var(--muted-soft)]" aria-hidden>
              {interrupted ? (
                <Clock3 className="size-3.5 text-[var(--danger)]" />
              ) : settled ? (
                <Check className="size-3.5 text-[var(--success)]" />
              ) : (
                <Clock3 className="size-3.5" />
              )}
            </span>
            <span className="min-w-0 break-words">{step}</span>
          </div>
        );
      })}
      {done && failed ? (
        <div className="ml-6 text-[length:var(--text-sm)] text-[var(--danger-text)]">Ход прерван ошибкой.</div>
      ) : null}
      {!done ? (
        <div className="flex items-center gap-2 text-[length:var(--text-sm)] text-[var(--muted)]">
          <Spinner className="size-3.5" />
          <span>{steps.length === 0 ? "Генри анализирует запрос…" : "Генри продолжает работу…"}</span>
        </div>
      ) : null}
    </div>
  );
}
