/* ============================================================
   Регрессия F3: границы дат фильтра журнала аудита и рендер колонки «Когда»
   обязаны жить в ОДНОЙ зоне. Раньше границы пиналась к UTC, а строки
   форматировались в зоне браузера, поэтому в UTC+3 события, подписанные
   «20 июл», выпадали из фильтра «20 июл», а в отрицательном оффсете
   втягивались чужие сутки.

   Тест гоняет обе стороны оффсета через process.env.TZ: форматтер строится
   на каждый вызов, поэтому смена TZ реально влияет на результат — до фикса
   (Intl без timeZone) эти проверки падают.
   ============================================================ */

import { describe, expect, it } from "vitest";

import {
  auditDayOfInstant,
  auditFromDateBound,
  auditToDateBound,
  formatAuditTimestamp
} from "./audit-date";

/** Выполняет fn с подменённой зоной процесса (эмуляция зоны браузера оператора). */
function withTimeZone<T>(timeZone: string, fn: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = timeZone;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

/** Ведущее число в «19 июл., 22:30» — календарный день, который видит оператор. */
function renderedDay(iso: string): string {
  return formatAuditTimestamp(iso).slice(0, 2);
}

/** Инстант попадает в диапазон фильтра за указанный день (как сравнивает сервер). */
function includedByDayFilter(iso: string, day: string): boolean {
  const from = auditFromDateBound(day);
  const to = auditToDateBound(day);
  if (!from || !to) return false;
  const at = new Date(iso).getTime();
  return at >= new Date(from).getTime() && at <= new Date(to).getTime();
}

const POSITIVE_OFFSET_ZONE = "Europe/Moscow"; // UTC+3
const NEGATIVE_OFFSET_ZONE = "America/New_York"; // UTC-4 в июле

describe("F3 — фильтр по датам и рендер журнала аудита в одной зоне", () => {
  it("положительный оффсет: событие поздним вечером UTC подписано своим днём", () => {
    const iso = "2026-07-19T22:30:00.000Z";
    // Сервер отдаёт это событие по фильтру «19 июл»...
    expect(includedByDayFilter(iso, "2026-07-19")).toBe(true);
    expect(includedByDayFilter(iso, "2026-07-20")).toBe(false);
    // ...и таблица обязана подписать его тем же днём. До фикса в UTC+3 было «20».
    withTimeZone(POSITIVE_OFFSET_ZONE, () => {
      expect(renderedDay(iso)).toBe("19");
    });
  });

  it("отрицательный оффсет: событие ранним утром UTC подписано своим днём", () => {
    const iso = "2026-07-20T01:30:00.000Z";
    expect(includedByDayFilter(iso, "2026-07-20")).toBe(true);
    expect(includedByDayFilter(iso, "2026-07-19")).toBe(false);
    // До фикса в UTC-4 было «19» — событие «пропадало» из фильтра «20 июл».
    withTimeZone(NEGATIVE_OFFSET_ZONE, () => {
      expect(renderedDay(iso)).toBe("20");
    });
  });

  it("рендер не зависит от зоны процесса вовсе", () => {
    const iso = "2026-07-19T22:30:00.000Z";
    const utc = withTimeZone("UTC", () => formatAuditTimestamp(iso));
    expect(withTimeZone(POSITIVE_OFFSET_ZONE, () => formatAuditTimestamp(iso))).toBe(utc);
    expect(withTimeZone(NEGATIVE_OFFSET_ZONE, () => formatAuditTimestamp(iso))).toBe(utc);
    expect(utc).toContain("22:30");
  });

  it("инвариант на границах суток: показанный день = день фильтра, который вернул событие", () => {
    const instants = [
      "2026-07-19T00:00:00.000Z",
      "2026-07-19T22:30:00.000Z",
      "2026-07-19T23:59:59.999Z",
      "2026-07-20T00:00:00.000Z",
      "2026-07-20T01:30:00.000Z",
      "2026-07-20T12:00:00.000Z"
    ];
    for (const zone of [POSITIVE_OFFSET_ZONE, NEGATIVE_OFFSET_ZONE, "UTC"]) {
      withTimeZone(zone, () => {
        for (const iso of instants) {
          const day = auditDayOfInstant(iso);
          expect(includedByDayFilter(iso, day)).toBe(true);
          expect(renderedDay(iso)).toBe(day.slice(8, 10));
        }
      });
    }
  });

  it("битый ISO возвращается как есть, а не как Invalid Date", () => {
    expect(formatAuditTimestamp("не-дата")).toBe("не-дата");
  });
});
