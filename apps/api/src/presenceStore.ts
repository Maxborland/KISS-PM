/**
 * P4.3 — присутствие (online/away/offline). In-memory, привязано к SSE-соединениям:
 *   online  — есть хотя бы одно открытое SSE-соединение пользователя;
 *   away    — соединений нет, но последний раз видели ≤ AWAY_MS назад;
 *   offline — давно не видели.
 *
 * Рефкаунт соединений корректно обрабатывает несколько вкладок: online держится,
 * пока открыта хотя бы одна. ponytail: один процесс; для многоинстансного прода —
 * вынести в Redis (как planningRedisEventBus). Время — Date.now() (обычный node-рантайм).
 */
export type PresenceStatus = "online" | "away" | "offline";

const AWAY_MS = 5 * 60_000;

const connections = new Map<string, number>(); // key → число открытых SSE-соединений
const lastSeen = new Map<string, number>(); // key → ms последней активности

const key = (tenantId: string, userId: string): string => `${tenantId}:${userId}`;

/** Открытие SSE-соединения. Возвращает true, если пользователь стал online (0→1). */
export function presenceConnect(tenantId: string, userId: string): boolean {
  const k = key(tenantId, userId);
  const next = (connections.get(k) ?? 0) + 1;
  connections.set(k, next);
  lastSeen.set(k, Date.now());
  return next === 1;
}

/** Закрытие SSE-соединения. Возвращает true, если соединений не осталось (1→0 → away). */
export function presenceDisconnect(tenantId: string, userId: string): boolean {
  const k = key(tenantId, userId);
  const next = Math.max(0, (connections.get(k) ?? 0) - 1);
  if (next === 0) connections.delete(k);
  else connections.set(k, next);
  lastSeen.set(k, Date.now());
  return next === 0;
}

/** Heartbeat активного соединения — освежает lastSeen. */
export function presenceHeartbeat(tenantId: string, userId: string): void {
  lastSeen.set(key(tenantId, userId), Date.now());
}

export function presenceStatusOf(tenantId: string, userId: string): PresenceStatus {
  const k = key(tenantId, userId);
  if ((connections.get(k) ?? 0) > 0) return "online";
  const seen = lastSeen.get(k);
  if (seen === undefined) return "offline";
  return Date.now() - seen <= AWAY_MS ? "away" : "offline";
}

export function presenceFor(tenantId: string, userIds: string[]): Record<string, PresenceStatus> {
  const result: Record<string, PresenceStatus> = {};
  for (const userId of userIds) result[userId] = presenceStatusOf(tenantId, userId);
  return result;
}

// Тестовый сброс (изоляция между тестами).
export function resetPresenceStore(): void {
  connections.clear();
  lastSeen.clear();
}
