/**
 * Workspace realtime event bus (P4.1 SSE) — зеркало planningEventBus, но с
 * обобщённым строковым каналом вместо projectId. Каналы:
 *   user:{userId}          — уведомления текущего пользователя (notification.created)
 *   conversation:{convId}  — сообщения беседы (message.created)
 *
 * ponytail: in-memory publisher (один процесс). Для многоинстансного прода —
 * Redis pub/sub по образцу planningRedisEventBus; подключить когда появится >1 реплики.
 */
export type WorkspaceRealtimeEvent =
  | { type: "message.created"; conversationId: string; message: unknown }
  | { type: "notification.created"; userId: string; notificationType: string };

export type WorkspaceEventListener = (event: WorkspaceRealtimeEvent) => void;

export interface WorkspaceEventPublisher {
  publish(channel: string, event: WorkspaceRealtimeEvent): void;
  subscribe(channel: string, listener: WorkspaceEventListener): () => void;
}

export class InMemoryWorkspaceEventPublisher implements WorkspaceEventPublisher {
  private readonly listenersByChannel = new Map<string, Set<WorkspaceEventListener>>();

  subscribe(channel: string, listener: WorkspaceEventListener): () => void {
    const bucket = this.listenersByChannel.get(channel) ?? new Set<WorkspaceEventListener>();
    bucket.add(listener);
    this.listenersByChannel.set(channel, bucket);
    return () => {
      bucket.delete(listener);
      if (bucket.size === 0) this.listenersByChannel.delete(channel);
    };
  }

  publish(channel: string, event: WorkspaceRealtimeEvent): void {
    const bucket = this.listenersByChannel.get(channel);
    if (!bucket) return;
    for (const listener of bucket) listener(event);
  }
}

let publisher: WorkspaceEventPublisher | null = null;

function getWorkspaceEventPublisher(): WorkspaceEventPublisher {
  if (!publisher) publisher = new InMemoryWorkspaceEventPublisher();
  return publisher;
}

export function setWorkspaceEventPublisher(next: WorkspaceEventPublisher): void {
  publisher = next;
}

export const userChannel = (userId: string): string => `user:${userId}`;
export const conversationChannel = (conversationId: string): string => `conversation:${conversationId}`;

export function subscribeWorkspaceEvents(
  channel: string,
  listener: WorkspaceEventListener
): () => void {
  return getWorkspaceEventPublisher().subscribe(channel, listener);
}

export function emitWorkspaceEvent(channel: string, event: WorkspaceRealtimeEvent): void {
  getWorkspaceEventPublisher().publish(channel, event);
}

export function emitMessageCreated(conversationId: string, message: unknown): void {
  emitWorkspaceEvent(conversationChannel(conversationId), { type: "message.created", conversationId, message });
}

export function emitNotificationCreated(userId: string, notificationType: string): void {
  emitWorkspaceEvent(userChannel(userId), { type: "notification.created", userId, notificationType });
}
