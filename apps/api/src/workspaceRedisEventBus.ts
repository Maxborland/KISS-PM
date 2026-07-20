/**
 * Redis-бекенд workspace-шины (Д5) — зеркало planningRedisEventBus, но поверх
 * обобщённых строковых каналов (user:/conversation:/tenant:).
 *
 * Доставка без дублей: publish() кладёт событие локальным подписчикам напрямую
 * (local.publish) и параллельно шлёт его в Redis в конверте с origin-меткой
 * инстанса; Redis-handler отбрасывает конверты со своим origin, поэтому свои же
 * публикации не приходят второй раз. Planning-вариант обходится без метки —
 * его planVersion-события идемпотентны, а message.created дублировать нельзя
 * (в чате появлялось бы два одинаковых сообщения).
 */
import { randomUUID } from "node:crypto";

import { requireSecureRedisUrl } from "./redisSecurity";
import type {
  WorkspaceEventListener,
  WorkspaceEventPublisher,
  WorkspaceRealtimeEvent
} from "./workspaceEventBus";

export const WORKSPACE_CHANNEL_PREFIX = "kiss-pm:workspace:";
const RETRY_DELAYS_MS = [200, 500, 1000] as const;

/**
 * Окно подавления повторов лога доставки. node-redis эмитит `error` на КАЖДУЮ
 * попытку переподключения, поэтому логировать каждую ошибку нельзя — но и латч
 * «залогировали один раз и молчим до конца процесса» прячет затяжную аварию.
 * Компромисс: один лог на окно + счётчик подавленных + лог восстановления.
 */
const DELIVERY_ERROR_LOG_COOLDOWN_MS = 60_000;

export function workspaceRedisChannel(channel: string): string {
  return `${WORKSPACE_CHANNEL_PREFIX}${channel}`;
}

export type WorkspaceEventEnvelope = {
  /** Уникальная метка publisher-инстанса — по ней отбрасываем эхо своих публикаций. */
  origin: string;
  event: WorkspaceRealtimeEvent;
};

/**
 * Статус workspace-шины — зеркало PlanningRealtimeStatus, чтобы readiness-проба
 * могла видеть не только planning-бекенд (сейчас serverReadiness проверяет лишь
 * planningEventsBackend; см. follow-up в отчёте).
 */
export type WorkspaceRealtimeStatus = {
  backend: "memory" | "redis";
  connected: boolean;
  redisConfigured: boolean;
};

let lastStatus: WorkspaceRealtimeStatus = {
  backend: "memory",
  connected: false,
  redisConfigured: false
};

export function getWorkspaceRedisEventBusStatus(): WorkspaceRealtimeStatus {
  return lastStatus;
}

export function encodeWorkspaceEventEnvelope(origin: string, event: WorkspaceRealtimeEvent): string {
  return JSON.stringify({ origin, event } satisfies WorkspaceEventEnvelope);
}

export function decodeWorkspaceEventEnvelope(message: string): WorkspaceEventEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(message);
    if (!parsed || typeof parsed !== "object") return null;
    const { origin, event } = parsed as { origin?: unknown; event?: unknown };
    if (typeof origin !== "string" || origin.length === 0) return null;
    if (!event || typeof event !== "object" || typeof (event as { type?: unknown }).type !== "string") {
      return null;
    }
    return { origin, event: event as WorkspaceRealtimeEvent };
  } catch {
    return null;
  }
}

export type DeliveryErrorSink = {
  /** Ошибка доставки: логируем не чаще окна, копим счётчик подавленных. */
  report(error: unknown): void;
  /** Успешный реконнект: снимаем подавление и честно логируем восстановление. */
  recover(): void;
};

/**
 * Rate-limited сток ошибок доставки. Вместо вечного латча:
 *  - первая ошибка логируется сразу;
 *  - повторы внутри окна подавляются, но считаются;
 *  - восстановление логируется и СБРАСЫВАЕТ окно, поэтому отдельная более
 *    поздняя авария снова видна в логах, а не пропадает молча.
 */
export function createDeliveryErrorSink(options: {
  cooldownMs?: number;
  log?: (message: string, error?: unknown) => void;
  now?: () => number;
} = {}): DeliveryErrorSink {
  const cooldownMs = options.cooldownMs ?? DELIVERY_ERROR_LOG_COOLDOWN_MS;
  const now = options.now ?? Date.now;
  const log =
    options.log ??
    ((message: string, error?: unknown) => {
      if (error === undefined) console.error(message);
      else console.error(message, error);
    });

  let lastLoggedAt: number | null = null;
  let suppressed = 0;
  let failing = false;

  const suppressedTail = (): string =>
    suppressed > 0 ? ` (подавлено повторов: ${suppressed})` : "";

  return {
    report(error: unknown) {
      failing = true;
      const at = now();
      if (lastLoggedAt !== null && at - lastLoggedAt < cooldownMs) {
        suppressed += 1;
        return;
      }
      const tail = suppressedTail();
      suppressed = 0;
      lastLoggedAt = at;
      log(`[workspace-events] Redis delivery failed${tail}`, error);
    },
    recover() {
      if (!failing) return;
      failing = false;
      const tail = suppressedTail();
      suppressed = 0;
      lastLoggedAt = null;
      log(`[workspace-events] Redis delivery recovered${tail}`);
    }
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(connect: () => Promise<void>, label: string): Promise<boolean> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await connect();
      return true;
    } catch (error) {
      lastError = error;
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined) break;
      await sleep(delay);
    }
  }
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `[workspace-events] Redis unavailable for ${label}, falling back to in-memory`,
      lastError
    );
  }
  return false;
}

type QuittableClient = { quit: () => Promise<unknown> };

/** Закрываем всё, что успели открыть, — иначе ранний return течёт живым коннектом. */
async function closeQuietly(clients: QuittableClient[]): Promise<void> {
  await Promise.allSettled(clients.map((client) => client.quit()));
}

export async function createRedisWorkspaceEventPublisher(
  local: WorkspaceEventPublisher
): Promise<WorkspaceEventPublisher | null> {
  const rawRedisUrl = process.env.REDIS_URL ?? process.env.PLANNING_EVENTS_REDIS_URL;
  const redisUrl = rawRedisUrl
    ? requireSecureRedisUrl({
        allowInsecure:
          process.env.WORKSPACE_EVENTS_REDIS_ALLOW_INSECURE === "true" ||
          process.env.PLANNING_EVENTS_REDIS_ALLOW_INSECURE === "true",
        production: process.env.NODE_ENV === "production",
        url: rawRedisUrl
      })
    : undefined;
  if (!redisUrl) {
    lastStatus = { backend: "memory", connected: true, redisConfigured: false };
    return null;
  }

  try {
    const { createClient } = await import("redis");
    const publisher = createClient({ url: redisUrl });
    const subscriber = createClient({ url: redisUrl });

    const sink = createDeliveryErrorSink();
    // Пока идёт connect(), об ошибках уже отчитывается connectWithRetry —
    // дублировать их как «delivery failed» не нужно.
    let started = false;

    // Готовность отслеживается ПОКЛИЕНТНО и сводится по И. Один общий флаг
    // объявлял всю шину восстановленной по ПЕРВОМУ поднявшемуся клиенту:
    // вернувшийся publisher «чинил» статус, пока subscriber ещё лежал, — то есть
    // кросс-инстансные события не принимались, а статус и лог рапортовали
    // recovered. Это ровно та молчаливая деградация, которую запрещает AGENTS.md.
    const ready: Record<"publisher" | "subscriber", boolean> = {
      publisher: false,
      subscriber: false
    };
    /** Шина связна, только когда живы ОБА конца: и публикация, и приём. */
    const bothReady = (): boolean => ready.publisher && ready.subscriber;

    const markDisconnected = (role: "publisher" | "subscriber") => (error: unknown) => {
      ready[role] = false;
      if (!started) return;
      lastStatus = { backend: "redis", connected: false, redisConfigured: true };
      sink.report(error);
    };
    const markConnected = (role: "publisher" | "subscriber") => () => {
      ready[role] = true;
      if (!started) return;
      // Пока второй конец не поднялся — статус остаётся degraded и о
      // восстановлении не сообщаем (окно подавления логов не сбрасывается).
      if (!bothReady()) return;
      lastStatus = { backend: "redis", connected: true, redisConfigured: true };
      sink.recover();
    };

    // ВАЖНО: error-listener вешается ДО connect(). node-redis переэмитит ошибку
    // сокета на клиенте, а EventEmitter без единого 'error'-слушателя роняет
    // процесс — окно между connect() publisher-а и retry-циклом subscriber-а
    // (до ~1.7s) иначе убивает API на старте.
    publisher.on("error", markDisconnected("publisher"));
    subscriber.on("error", markDisconnected("subscriber"));
    // 'ready' после реконнекта — сигнал восстановления: снимает подавление логов.
    publisher.on("ready", markConnected("publisher"));
    subscriber.on("ready", markConnected("subscriber"));

    const publisherConnected = await connectWithRetry(async () => {
      await publisher.connect();
    }, "publisher");
    const subscriberConnected = await connectWithRetry(async () => {
      await subscriber.connect();
    }, "subscriber");
    if (!publisherConnected || !subscriberConnected) {
      // Утечка коннекта: закрываем того, кто всё-таки поднялся.
      await closeQuietly([
        ...(publisherConnected ? [publisher] : []),
        ...(subscriberConnected ? [subscriber] : [])
      ]);
      lastStatus = { backend: "memory", connected: false, redisConfigured: true };
      return null;
    }

    // Успешный connectWithRetry обоих клиентов — источник истины стартовой
    // готовности: 'ready' мог прийти до started и быть проигнорирован.
    ready.publisher = true;
    ready.subscriber = true;
    started = true;
    lastStatus = { backend: "redis", connected: true, redisConfigured: true };

    const origin = randomUUID();
    // Сбой доставки атрибутируется тому концу, который его допустил: publish —
    // publisher-у, (un)subscribe — subscriber-у. Иначе ошибка приёма гасила бы
    // готовность публикации и наоборот.
    const onPublishError = markDisconnected("publisher");
    const onSubscribeError = markDisconnected("subscriber");

    return {
      publish(channel: string, event: WorkspaceRealtimeEvent) {
        // Своим подписчикам — напрямую; Redis-эхо этого же конверта отфильтрует origin.
        local.publish(channel, event);
        void publisher
          .publish(workspaceRedisChannel(channel), encodeWorkspaceEventEnvelope(origin, event))
          .catch(onPublishError);
      },
      subscribe(channel: string, listener: WorkspaceEventListener) {
        const localUnsub = local.subscribe(channel, listener);
        const redisChannel = workspaceRedisChannel(channel);
        const handler = (message: string) => {
          const envelope = decodeWorkspaceEventEnvelope(message);
          if (!envelope || envelope.origin === origin) return;
          listener(envelope.event);
        };
        void subscriber.subscribe(redisChannel, handler).catch(onSubscribeError);
        return () => {
          localUnsub();
          // Снимаем ТОЛЬКО свой handler (не весь канал): несколько подписчиков одного канала
          // мультиплексируются на один Redis-канал; unsubscribe(channel) без handler оборвал бы всех.
          void subscriber.unsubscribe(redisChannel, handler).catch(onSubscribeError);
        };
      },
      async close() {
        started = false;
        ready.publisher = false;
        ready.subscriber = false;
        await Promise.allSettled([subscriber.quit(), publisher.quit()]);
        lastStatus = { backend: "redis", connected: false, redisConfigured: true };
      }
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[workspace-events] Redis unavailable, falling back to in-memory", error);
    }
    lastStatus = { backend: "memory", connected: false, redisConfigured: true };
    return null;
  }
}
