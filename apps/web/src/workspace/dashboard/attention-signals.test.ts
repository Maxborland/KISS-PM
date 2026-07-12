import { describe, expect, it } from "vitest";

import type { TaskRecord } from "@/workspace/lib/workspace-client";
import type { Opportunity } from "@/crm/lib/crm-client";
import {
  DUE_SOON_DAYS,
  MAX_ROWS_PER_GROUP,
  STALE_DEAL_DAYS,
  buildAttentionSignals
} from "./attention-signals";

/* Юнит-границы buildAttentionSignals: дедлайны today/today+7/today+8,
   застой ровно 14 дней (мс-арифметика), cap на группу + restCount,
   null-источники, исключение done/закрытых сделок. */

// Фиксированный «сейчас»: полдень локального 2026-07-13 — детерминизм границ дня.
const NOW = new Date(2026, 6, 13, 12, 0, 0);
const TODAY = "2026-07-13";

const task = (over: Partial<TaskRecord>): TaskRecord =>
  ({
    id: "task-x",
    title: "Задача",
    statusName: "В работе",
    statusCategory: "in_progress",
    plannedFinish: TODAY,
    ...over
  }) as TaskRecord;

const opp = (over: Partial<Opportunity>): Opportunity =>
  ({
    id: "opp-x",
    title: "Сделка",
    status: "new",
    plannedFinish: "2026-08-01",
    updatedAt: NOW.toISOString(),
    ...over
  }) as Opportunity;

const daysAgoIso = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

describe("buildAttentionSignals: дедлайны задач", () => {
  it("finish=today — «дедлайн ≤ 7 дн.», не просрочка", () => {
    const { shown } = buildAttentionSignals([task({ plannedFinish: TODAY })], null, NOW);
    expect(shown).toHaveLength(1);
    expect(shown[0]!.chip).toBe(`Дедлайн ≤ ${DUE_SOON_DAYS} дн.`);
    expect(shown[0]!.tone).toBe("warning");
  });

  it("finish=today+7 — ещё в горизонте «дедлайн близко»", () => {
    const { shown } = buildAttentionSignals([task({ plannedFinish: "2026-07-20" })], null, NOW);
    expect(shown).toHaveLength(1);
    expect(shown[0]!.chip).toBe(`Дедлайн ≤ ${DUE_SOON_DAYS} дн.`);
  });

  it("finish=today+8 — за горизонтом, сигнала нет", () => {
    const { shown, restCount } = buildAttentionSignals([task({ plannedFinish: "2026-07-21" })], null, NOW);
    expect(shown).toHaveLength(0);
    expect(restCount).toBe(0);
  });

  it("finish<today — «задача просрочена», danger; aria-label озвучивает причину и срок", () => {
    const { shown } = buildAttentionSignals(
      [task({ title: "Отчёт", plannedFinish: "2026-07-12" })],
      null,
      NOW
    );
    expect(shown).toHaveLength(1);
    expect(shown[0]!.chip).toBe("Задача просрочена");
    expect(shown[0]!.tone).toBe("danger");
    expect(shown[0]!.ariaLabel).toBe("Открыть задачу «Отчёт»: задача просрочена, финиш 12.07.2026");
  });

  it("done-задачи не дают сигналов даже с финишем в прошлом", () => {
    const { shown } = buildAttentionSignals(
      [task({ statusCategory: "done", plannedFinish: "2026-01-01" })],
      null,
      NOW
    );
    expect(shown).toHaveLength(0);
  });
});

describe("buildAttentionSignals: сделки", () => {
  it("открытая сделка с updatedAt ровно 14 дней назад — «без движения» (мс-арифметика)", () => {
    const { shown } = buildAttentionSignals(null, [opp({ updatedAt: daysAgoIso(STALE_DEAL_DAYS) })], NOW);
    expect(shown).toHaveLength(1);
    expect(shown[0]!.chip).toBe(`Без движения ${STALE_DEAL_DAYS}+ дн.`);
  });

  it("updatedAt меньше 14 полных дней назад — застоя нет", () => {
    const { shown } = buildAttentionSignals(
      null,
      [opp({ updatedAt: daysAgoIso(STALE_DEAL_DAYS - 0.5) })],
      NOW
    );
    expect(shown).toHaveLength(0);
  });

  it("просроченная открытая сделка — danger-сигнал", () => {
    const { shown } = buildAttentionSignals(null, [opp({ plannedFinish: "2026-07-01" })], NOW);
    expect(shown).toHaveLength(1);
    expect(shown[0]!.chip).toBe("Сделка просрочена");
    expect(shown[0]!.href).toBe("/crm/deals?deal=opp-x");
  });

  it("закрытые сделки (won/lost) не дают сигналов", () => {
    const { shown } = buildAttentionSignals(
      null,
      [
        opp({ status: "won_closed", plannedFinish: "2026-07-01" }),
        opp({ id: "opp-y", status: "lost_rejected", updatedAt: daysAgoIso(30) })
      ],
      NOW
    );
    expect(shown).toHaveLength(0);
  });
});

describe("buildAttentionSignals: cap на группу и null-источники", () => {
  it("группа режется до MAX_ROWS_PER_GROUP, остаток уходит в restCount", () => {
    const overdue = Array.from({ length: MAX_ROWS_PER_GROUP + 2 }, (_, i) =>
      task({ id: `task-${i}`, plannedFinish: `2026-07-0${i + 1}` })
    );
    const { shown, restCount } = buildAttentionSignals(overdue, null, NOW);
    expect(shown).toHaveLength(MAX_ROWS_PER_GROUP);
    // Сортировка по срочности: старейший финиш первым.
    expect(shown[0]!.title).toBe("Задача");
    expect(shown.map((s) => s.key)).toEqual(
      Array.from({ length: MAX_ROWS_PER_GROUP }, (_, i) => `task-Задача просрочена-task-${i}`)
    );
    expect(restCount).toBe(2);
  });

  it("cap действует на КАЖДУЮ группу независимо — шумная группа не вытесняет другую", () => {
    const overdue = Array.from({ length: MAX_ROWS_PER_GROUP + 3 }, (_, i) =>
      task({ id: `task-${i}`, plannedFinish: `2026-07-0${i + 1}` })
    );
    const stale = [opp({ updatedAt: daysAgoIso(20) })];
    const { shown, restCount } = buildAttentionSignals(overdue, stale, NOW);
    expect(shown).toHaveLength(MAX_ROWS_PER_GROUP + 1);
    expect(shown.at(-1)!.chip).toBe(`Без движения ${STALE_DEAL_DAYS}+ дн.`);
    expect(restCount).toBe(3);
  });

  it("null-источники (нет прав) дают пустой результат без исключений", () => {
    expect(buildAttentionSignals(null, null, NOW)).toEqual({ shown: [], restCount: 0 });
  });
});
