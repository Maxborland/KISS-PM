import type { TaskRecord } from "@/workspace/lib/workspace-client";
import type { Opportunity } from "@/crm/lib/crm-client";

/* ============================================================
   Сигналы «Требует внимания» дашборда — чистая логика без React:
   просроченные задачи/сделки, приближающиеся дедлайны, сделки без
   движения. Вынесено из dashboard-surface.tsx ради юнит-тестов
   (границы дат, cap на группу, null-источники).
   ============================================================ */

export const OPP_OPEN: Opportunity["status"][] = ["new", "feasibility", "ready_to_activate"];
export const OPP_STATUS_LABEL: Record<Opportunity["status"], string> = {
  new: "Новые",
  feasibility: "Проверка",
  ready_to_activate: "Готовы",
  won_closed: "Выиграны",
  lost_rejected: "Проиграны"
};

export const fmtDate = (iso: string) => {
  // ISO → дд.мм.гггг без зависимости от локали рантайма.
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : iso.slice(0, 10);
};

// Локальный день в ISO (YYYY-MM-DD) со сдвигом на deltaDays — для сравнения дат сигналов.
export const localIsoDay = (deltaDays = 0, base: Date = new Date()) => {
  const d = new Date(base);
  d.setDate(d.getDate() + deltaDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Порог «сделка без движения»: открыта и не обновлялась N дней. Порог показан в подписи сигнала. */
export const STALE_DEAL_DAYS = 14;
/** Горизонт «дедлайн близко» для задач, дней. */
export const DUE_SOON_DAYS = 7;
/** Максимум строк НА ГРУППУ сигналов (просроченные задачи/сделки, дедлайны, застой):
 *  одна шумная группа не вытесняет остальные; остаток — честной строкой «и ещё N». */
export const MAX_ROWS_PER_GROUP = 4;

export type AttentionSignal = {
  key: string;
  chip: string;
  tone: "danger" | "warning";
  title: string;
  detail: string;
  href: string;
  ariaLabel: string;
};

// Сигналы «требует внимания» из РЕАЛЬНЫХ данных доступных источников.
// null-источник (нет прав) просто не даёт сигналов — об этом честная пометка в блоке.
// Внутри группы — сортировка по срочности (старейший срок первым), потом cap на группу.
// now — инъекция времени для детерминированных тестов (по умолчанию текущее).
export function buildAttentionSignals(
  tasks: TaskRecord[] | null,
  opportunities: Opportunity[] | null,
  now: Date = new Date()
): { shown: AttentionSignal[]; restCount: number } {
  const today = localIsoDay(0, now);
  const soon = localIsoDay(DUE_SOON_DAYS, now);
  const staleBefore = localIsoDay(-STALE_DEAL_DAYS, now);
  const byFinish = <T extends { plannedFinish: string }>(list: T[]) =>
    [...list].sort((a, b) => a.plannedFinish.localeCompare(b.plannedFinish));

  const activeTasks = (tasks ?? []).filter((t) => t.statusCategory !== "done");
  const overdueTasks = byFinish(activeTasks.filter((t) => t.plannedFinish.slice(0, 10) < today));
  const dueSoonTasks = byFinish(
    activeTasks.filter((t) => {
      const f = t.plannedFinish.slice(0, 10);
      return f >= today && f <= soon;
    })
  );

  const openOpps = (opportunities ?? []).filter((o) => OPP_OPEN.includes(o.status));
  const overdueOpps = byFinish(openOpps.filter((o) => o.plannedFinish.slice(0, 10) < today));
  const staleOpps = openOpps
    .filter((o) => o.plannedFinish.slice(0, 10) >= today && o.updatedAt.slice(0, 10) <= staleBefore)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

  const taskSignal = (t: TaskRecord, chip: string, tone: "danger" | "warning"): AttentionSignal => ({
    key: `task-${chip}-${t.id}`,
    chip,
    tone,
    title: t.title,
    detail: `${t.statusName} · финиш ${fmtDate(t.plannedFinish)}`,
    href: `/my-work?task=${encodeURIComponent(t.id)}`,
    ariaLabel: `Открыть задачу «${t.title}» в Моих задачах`
  });
  const oppSignal = (o: Opportunity, chip: string, tone: "danger" | "warning", detail: string): AttentionSignal => ({
    key: `deal-${chip}-${o.id}`,
    chip,
    tone,
    title: o.title,
    detail,
    href: `/crm/deals?deal=${encodeURIComponent(o.id)}`,
    ariaLabel: `Открыть сделку «${o.title}» в CRM`
  });

  const groups: AttentionSignal[][] = [
    overdueTasks.map((t) => taskSignal(t, "Задача просрочена", "danger")),
    overdueOpps.map((o) =>
      oppSignal(o, "Сделка просрочена", "danger", `${OPP_STATUS_LABEL[o.status]} · финиш ${fmtDate(o.plannedFinish)}`)
    ),
    dueSoonTasks.map((t) => taskSignal(t, `Дедлайн ≤ ${DUE_SOON_DAYS} дн.`, "warning")),
    staleOpps.map((o) =>
      oppSignal(o, `Без движения ${STALE_DEAL_DAYS}+ дн.`, "warning", `${OPP_STATUS_LABEL[o.status]} · обновлена ${fmtDate(o.updatedAt)}`)
    )
  ];
  const shown = groups.flatMap((g) => g.slice(0, MAX_ROWS_PER_GROUP));
  const restCount = groups.reduce((s, g) => s + Math.max(0, g.length - MAX_ROWS_PER_GROUP), 0);
  return { shown, restCount };
}
