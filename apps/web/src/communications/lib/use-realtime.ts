"use client";

import { useEffect, useRef } from "react";

import { useCommsRuntime } from "./comms-runtime";

/**
 * P4.1 — подписка на боевой SSE-поток рабочей области
 * (GET /api/workspace/realtime/events). Только в live-режиме: открывает
 * EventSource и зовёт колбэки на server-sent событиях message.created /
 * notification.created. В mock (Storybook) — no-op: SSE-сервера нет, «живость»
 * остаётся на ре-фетче после мутаций (как было). Транспорт выбирается тем же
 * CommsRuntime, что и у comms-client.
 *
 * conversationId (опц.) добавляет канал беседы (живые сообщения). Без него —
 * только канал пользователя (живые уведомления). Переподключается при смене
 * conversationId; колбэки читаются через ref, чтобы не пересоздавать соединение.
 */
export type MessageCreatedEvent = { type: "message.created"; conversationId: string; message: unknown };
export type NotificationCreatedEvent = { type: "notification.created"; userId: string; notificationType: string };
export type PresenceChangedEvent = { type: "presence.changed"; userId: string; status: "online" | "away" | "offline" };

export function useWorkspaceRealtime(options: {
  conversationId?: string | null;
  onMessage?: (event: MessageCreatedEvent) => void;
  onNotification?: (event: NotificationCreatedEvent) => void;
  onPresence?: (event: PresenceChangedEvent) => void;
}) {
  const { live } = useCommsRuntime();
  const { conversationId } = options;
  const onMessageRef = useRef(options.onMessage);
  const onNotificationRef = useRef(options.onNotification);
  const onPresenceRef = useRef(options.onPresence);
  onMessageRef.current = options.onMessage;
  onNotificationRef.current = options.onNotification;
  onPresenceRef.current = options.onPresence;

  useEffect(() => {
    // mock/Storybook: SSE-сервера нет → не открываем соединение.
    if (!live) return;
    if (typeof window === "undefined" || typeof EventSource === "undefined") return;

    const url = conversationId
      ? `/api/workspace/realtime/events?conversationId=${encodeURIComponent(conversationId)}`
      : "/api/workspace/realtime/events";
    const source = new EventSource(url, { withCredentials: true });

    const handleMessage = (event: MessageEvent) => {
      try {
        onMessageRef.current?.(JSON.parse(event.data) as MessageCreatedEvent);
      } catch {
        /* игнорируем некорректный кадр */
      }
    };
    const handleNotification = (event: MessageEvent) => {
      try {
        onNotificationRef.current?.(JSON.parse(event.data) as NotificationCreatedEvent);
      } catch {
        /* игнорируем некорректный кадр */
      }
    };
    const handlePresence = (event: MessageEvent) => {
      try {
        onPresenceRef.current?.(JSON.parse(event.data) as PresenceChangedEvent);
      } catch {
        /* игнорируем некорректный кадр */
      }
    };

    source.addEventListener("message.created", handleMessage);
    source.addEventListener("notification.created", handleNotification);
    source.addEventListener("presence.changed", handlePresence);

    return () => {
      source.removeEventListener("message.created", handleMessage);
      source.removeEventListener("notification.created", handleNotification);
      source.removeEventListener("presence.changed", handlePresence);
      source.close();
    };
  }, [live, conversationId]);
}
