/* ============================================================
   Регрессия устойчивости Redis-бекенда workspace-шины:
   - F1(a) error-listener должен висеть ДО connect() (иначе переэмит ошибки
     сокета на EventEmitter без слушателей роняет процесс на старте);
   - F1(b) ранний return при неподнявшемся subscriber-е не должен оставлять
     живой коннект publisher-а;
   - F2  сток ошибок доставки не латчится навсегда: повторы подавляются окном,
     восстановление логируется, следующая авария снова видна.
   ============================================================ */

import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InMemoryWorkspaceEventPublisher } from "./workspaceEventBus";

/** Слепок состояния fake-клиентов, который наполняет мок ниже. */
type ClientProbe = {
  role: "publisher" | "subscriber";
  /** Число 'error'-слушателей на момент входа в connect() — суть фикса F1(a). */
  errorListenersAtConnect: number;
  quitCalls: number;
  client: FakeRedisClient;
};

class FakeRedisClient extends EventEmitter {
  quitCalls = 0;
  errorListenersAtConnect = -1;
  connectAttempts = 0;

  constructor(private readonly failConnect: () => boolean) {
    super();
  }

  async connect(): Promise<void> {
    this.connectAttempts += 1;
    if (this.errorListenersAtConnect < 0) {
      this.errorListenersAtConnect = this.listenerCount("error");
    }
    if (this.failConnect()) throw new Error("redis_down");
  }

  async publish(): Promise<void> {}
  async subscribe(): Promise<void> {}
  async unsubscribe(): Promise<void> {}
  async quit(): Promise<void> {
    this.quitCalls += 1;
  }
}

// Управляется из теста: определяет, падает ли connect() у subscriber-а.
const state = { subscriberFails: false, probes: [] as ClientProbe[] };

vi.mock("redis", () => ({
  createClient: () => {
    const role: "publisher" | "subscriber" = state.probes.length % 2 === 0 ? "publisher" : "subscriber";
    const client = new FakeRedisClient(() => role === "subscriber" && state.subscriberFails);
    const probe: ClientProbe = { role, errorListenersAtConnect: -1, quitCalls: 0, client };
    state.probes.push(probe);
    return client;
  }
}));

const importBus = async () => await import("./workspaceRedisEventBus");

beforeEach(() => {
  state.subscriberFails = false;
  state.probes = [];
  vi.stubEnv("REDIS_URL", "redis://127.0.0.1:6379");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("F1 — подключение Redis-шины workspace", () => {
  it("вешает error-listener на оба клиента ДО первого connect()", async () => {
    const { createRedisWorkspaceEventPublisher } = await importBus();
    const bus = await createRedisWorkspaceEventPublisher(new InMemoryWorkspaceEventPublisher());
    expect(bus).not.toBeNull();

    expect(state.probes).toHaveLength(2);
    for (const probe of state.probes) {
      // До фикса listener вешался ПОСЛЕ connect() → здесь был бы 0.
      expect(probe.client.errorListenersAtConnect).toBeGreaterThanOrEqual(1);
    }

    // Ошибка сокета вне промиса (как переэмит node-redis) не должна ронять процесс.
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => state.probes[0]!.client.emit("error", new Error("socket_reset"))).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();

    await bus!.close?.();
  });

  it("не оставляет живой publisher-коннект, когда subscriber не поднялся", async () => {
    state.subscriberFails = true;
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { createRedisWorkspaceEventPublisher, getWorkspaceRedisEventBusStatus } = await importBus();
    const bus = await createRedisWorkspaceEventPublisher(new InMemoryWorkspaceEventPublisher());

    expect(bus).toBeNull();
    const publisher = state.probes.find((p) => p.role === "publisher");
    expect(publisher).toBeDefined();
    // До фикса ранний return уходил, не закрыв поднятый publisher → утечка коннекта.
    expect(publisher!.client.quitCalls).toBe(1);

    const status = getWorkspaceRedisEventBusStatus();
    expect(status).toEqual({ backend: "memory", connected: false, redisConfigured: true });
  }, 10_000);
});

describe("F2 — сток ошибок доставки не латчится навсегда", () => {
  it("подавляет повторы окном, но логирует восстановление и следующую аварию", async () => {
    const { createDeliveryErrorSink } = await importBus();
    const logs: Array<{ message: string; error?: unknown }> = [];
    let clock = 0;
    const sink = createDeliveryErrorSink({
      cooldownMs: 1000,
      now: () => clock,
      log: (message, error) => logs.push({ message, error })
    });

    sink.report(new Error("e1"));
    expect(logs).toHaveLength(1);
    expect(logs[0]!.message).toContain("Redis delivery failed");

    // Повторы внутри окна подавляются (node-redis эмитит error на каждый реконнект).
    clock = 200;
    sink.report(new Error("e2"));
    clock = 400;
    sink.report(new Error("e3"));
    expect(logs).toHaveLength(1);

    // За окном — снова логируем, с числом подавленных.
    clock = 1500;
    sink.report(new Error("e4"));
    expect(logs).toHaveLength(2);
    expect(logs[1]!.message).toContain("подавлено повторов: 2");

    // Восстановление наблюдаемо.
    clock = 1600;
    sink.recover();
    expect(logs).toHaveLength(3);
    expect(logs[2]!.message).toContain("Redis delivery recovered");

    // Ключевое отличие от вечного латча: НОВАЯ авария логируется сразу.
    clock = 1650;
    sink.report(new Error("e5"));
    expect(logs).toHaveLength(4);
    expect(logs[3]!.message).toContain("Redis delivery failed");
  });

  it("повторная авария после реконнекта видна в логах живой шины", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { createRedisWorkspaceEventPublisher, getWorkspaceRedisEventBusStatus } = await importBus();
    const bus = await createRedisWorkspaceEventPublisher(new InMemoryWorkspaceEventPublisher());
    expect(bus).not.toBeNull();

    const publisher = state.probes.find((p) => p.role === "publisher")!.client;
    publisher.emit("error", new Error("outage_1"));
    expect(getWorkspaceRedisEventBusStatus().connected).toBe(false);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    // node-redis сам переподключается — статус и логи должны восстановиться.
    publisher.emit("ready");
    expect(getWorkspaceRedisEventBusStatus().connected).toBe(true);
    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(String(errorSpy.mock.calls[1]![0])).toContain("recovered");

    // Отдельная более поздняя авария: до фикса латч молчал бы навсегда.
    publisher.emit("error", new Error("outage_2"));
    expect(errorSpy).toHaveBeenCalledTimes(3);
    expect(String(errorSpy.mock.calls[2]![0])).toContain("failed");

    await bus!.close?.();
  });
});

describe("F3 — восстановление шины сводится по ОБОИМ клиентам", () => {
  it("не объявляет доставку восстановленной, пока поднялся только publisher", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { createRedisWorkspaceEventPublisher, getWorkspaceRedisEventBusStatus } = await importBus();
    const bus = await createRedisWorkspaceEventPublisher(new InMemoryWorkspaceEventPublisher());
    expect(bus).not.toBeNull();

    const publisher = state.probes.find((p) => p.role === "publisher")!.client;
    const subscriber = state.probes.find((p) => p.role === "subscriber")!.client;
    const recoveredLogs = () =>
      errorSpy.mock.calls.filter((call) => String(call[0]).includes("recovered")).length;

    // Авария сети роняет оба клиента: node-redis эмитит 'error' на каждом.
    publisher.emit("error", new Error("outage"));
    subscriber.emit("error", new Error("outage"));
    expect(getWorkspaceRedisEventBusStatus().connected).toBe(false);

    // Вернулся ТОЛЬКО publisher: публиковать мы снова можем, а ПРИНИМАТЬ
    // кросс-инстансные события — нет. Общий markConnected до фикса объявлял
    // всю шину восстановленной по первому же поднявшемуся клиенту: статус
    // connected:true при мёртвом subscriber — ровно та молчаливая деградация,
    // которую запрещает AGENTS.md.
    publisher.emit("ready");
    expect(getWorkspaceRedisEventBusStatus().connected).toBe(false);
    expect(recoveredLogs()).toBe(0);

    // Честное восстановление — только когда поднялись ОБА.
    subscriber.emit("ready");
    expect(getWorkspaceRedisEventBusStatus().connected).toBe(true);
    expect(recoveredLogs()).toBe(1);

    await bus!.close?.();
  });

  it("роняет статус в degraded, когда падает любой из клиентов", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { createRedisWorkspaceEventPublisher, getWorkspaceRedisEventBusStatus } = await importBus();
    const bus = await createRedisWorkspaceEventPublisher(new InMemoryWorkspaceEventPublisher());
    expect(bus).not.toBeNull();

    const subscriber = state.probes.find((p) => p.role === "subscriber")!.client;
    expect(getWorkspaceRedisEventBusStatus().connected).toBe(true);

    // Упал только subscriber — publisher жив, но приём событий уже потерян.
    subscriber.emit("error", new Error("subscriber_down"));
    expect(getWorkspaceRedisEventBusStatus().connected).toBe(false);

    // 'ready' чужого (publisher) клиента не должен «чинить» subscriber.
    state.probes.find((p) => p.role === "publisher")!.client.emit("ready");
    expect(getWorkspaceRedisEventBusStatus().connected).toBe(false);

    subscriber.emit("ready");
    expect(getWorkspaceRedisEventBusStatus().connected).toBe(true);

    await bus!.close?.();
  });
});
