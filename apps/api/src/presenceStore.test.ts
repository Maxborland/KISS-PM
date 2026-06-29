import { afterEach, describe, expect, it } from "vitest";

import {
  presenceConnect,
  presenceDisconnect,
  presenceFor,
  presenceStatusOf,
  resetPresenceStore
} from "./presenceStore";

const T = "tenant-x";
const U = "user-1";

afterEach(() => resetPresenceStore());

describe("presenceStore", () => {
  it("неизвестный пользователь → offline", () => {
    expect(presenceStatusOf(T, U)).toBe("offline");
  });

  it("connect делает online и возвращает true на переходе 0→1", () => {
    expect(presenceConnect(T, U)).toBe(true);
    expect(presenceStatusOf(T, U)).toBe("online");
  });

  it("рефкаунт вкладок: второй connect не меняет статус и возвращает false", () => {
    expect(presenceConnect(T, U)).toBe(true);
    expect(presenceConnect(T, U)).toBe(false); // 1→2
    expect(presenceStatusOf(T, U)).toBe("online");
    // одно закрытие из двух — всё ещё online, переход не наступил
    expect(presenceDisconnect(T, U)).toBe(false); // 2→1
    expect(presenceStatusOf(T, U)).toBe("online");
  });

  it("последний disconnect → away (недавно видели) и возвращает true на 1→0", () => {
    presenceConnect(T, U);
    expect(presenceDisconnect(T, U)).toBe(true); // 1→0
    expect(presenceStatusOf(T, U)).toBe("away");
  });

  it("presenceFor отдаёт статусы по списку, неизвестные — offline", () => {
    presenceConnect(T, U);
    const map = presenceFor(T, [U, "user-ghost"]);
    expect(map[U]).toBe("online");
    expect(map["user-ghost"]).toBe("offline");
  });

  it("изоляция по тенанту: тот же userId в другом тенанте — offline", () => {
    presenceConnect(T, U);
    expect(presenceStatusOf("tenant-y", U)).toBe("offline");
  });
});
