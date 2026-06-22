import type { ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, Flag, GitCommit, RotateCcw, TrendingUp, Zap } from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Bento, BentoCard, StatTile } from "@/delivery/ui/bento";
import { DeliveryFrame, type ProjectMeta } from "@/delivery/ui/delivery-frame";
import { demoAction } from "@/views/lib/demo";

const PROJECT: ProjectMeta = {
  name: "Производственный портал · Релиз 2",
  code: "ПР",
  status: "В работе",
  statusTone: "info",
  planVersion: "v17",
  deadline: "12.07.2026",
  finish: "14.06.2026",
  variance: { label: "+2 дня к baseline B2", tone: "warning" }
};

/** Сигналы планирования — производные read-model (validationIssues + resourceLoad). */
const SIGNALS: {
  tone: "danger" | "warning" | "info";
  icon: typeof Zap;
  title: string;
  detail: string;
  action: string;
}[] = [
  { tone: "danger", icon: Zap, title: "Перегруз — Михаил К.", detail: "142% на неделе 21 · 7 задач, 264 ч", action: "Сценарий выравнивания" },
  { tone: "warning", icon: AlertTriangle, title: "Риск срока — Контур безопасности", detail: "−4 дн к плану · WBS 2.2 · финиш 17.04", action: "Открыть в графике" },
  { tone: "warning", icon: AlertTriangle, title: "На критическом пути без резерва", detail: "3 задачи · резерв 0 дн", action: "Показать путь" },
  { tone: "info", icon: TrendingUp, title: "Объём +6 SP согласован клиентом", detail: "22.05 · влияет на baseline B2", action: "Принять в план" }
];

const MILESTONES: { wbs: string; name: string; date: string; done: boolean }[] = [
  { wbs: "M1", name: "Объём зафиксирован", date: "27.03.2026", done: true },
  { wbs: "M2", name: "Демо MVP", date: "05.06.2026", done: false },
  { wbs: "M3", name: "Приёмка релиза", date: "12.07.2026", done: false }
];

const KEY_TASKS: { wbs: string; name: string; progress: number; assignee: { initials: string; color: "c1" | "c2" | "c3" | "c4" | "c5" }; due: string; critical?: boolean }[] = [
  { wbs: "2.2", name: "Контур безопасности", progress: 72, assignee: { initials: "ИВ", color: "c1" }, due: "17.04", critical: true },
  { wbs: "3.1.1", name: "Планировочный движок", progress: 92, assignee: { initials: "СП", color: "c2" }, due: "08.05" },
  { wbs: "3.2.1", name: "WBS + Gantt", progress: 38, assignee: { initials: "МК", color: "c5" }, due: "29.05", critical: true },
  { wbs: "4.1", name: "Функциональное тестирование", progress: 12, assignee: { initials: "КН", color: "c3" }, due: "05.06" }
];

/** Лента коммитов (PM-as-code) — заменяет «аудит». Каждое изменение обратимо. */
const COMMITS: { time: string; author: string; message: ReactNode; ref: string }[] = [
  { time: "14.05 14:32", author: "Иван И.", message: <>изменил длительность <b className="text-[var(--text-strong)]">4 дн → 5 дн</b></>, ref: "WBS 3.2.1" },
  { time: "12.05 11:08", author: "Михаил К.", message: <>назначен исполнителем · units 100%</>, ref: "WBS 3.2.1" },
  { time: "11.05 16:20", author: "Анна П.", message: <>сдвинула baseline <b className="text-[var(--text-strong)]">B1 → B2</b></>, ref: "план v16" },
  { time: "10.05 09:14", author: "Система", message: <>задача создана из шаблона «Frontend»</>, ref: "WBS 3.2" }
];

function toneIcon(tone: "danger" | "warning" | "info") {
  return {
    danger: "bg-[var(--danger)] text-white",
    warning: "bg-[var(--warning)] text-white",
    info: "bg-[var(--accent)] text-white"
  }[tone];
}

function toneBorder(tone: "danger" | "warning" | "info") {
  return {
    danger: "border-[var(--danger)]",
    warning: "border-[var(--warning)]",
    info: "border-[var(--accent)]"
  }[tone];
}

function ProgressBar({ value, critical }: { value: number; critical?: boolean }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel-strong)]">
      <div
        className={cn("h-full rounded-full", critical ? "bg-[var(--critical-stripe)]" : "bg-[var(--success)]")}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function ProjectOverview() {
  return (
    <DeliveryFrame project={PROJECT} activeTab="Обзор">
      {/* KPI-полоса */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Прогресс" value="42%" delta="+4 пп за неделю" tone="success" />
        <StatTile label="Финиш (расчёт)" value="14.06" delta="дедлайн 12.07" />
        <StatTile label="К baseline B2" value="+2 дн" delta="отставание" tone="warning" />
        <StatTile label="Перегрузы" value="2" delta="ресурса в 14 дн" tone="danger" />
        <StatTile label="Открытых рисков" value="3" delta="1 критический" tone="warning" />
      </div>

      <Bento>
        {/* Сигналы */}
        <BentoCard span={8} title="Внимание · сигналы планирования" subtitle="Производные от плана и загрузки ресурсов" flush>
          <ul className="py-1">
            {SIGNALS.map((s) => (
              <li
                key={s.title}
                className={cn(
                  "v4-row group flex items-center gap-3 border-l-[3px] py-3 pl-3.5 pr-3",
                  toneBorder(s.tone)
                )}
              >
                <span
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] shadow-[var(--shadow-card)]",
                    toneIcon(s.tone)
                  )}
                >
                  <s.icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[length:var(--text-md)] font-semibold text-[var(--text-strong)]">{s.title}</div>
                  <div className="truncate text-[length:var(--text-sm)] text-[var(--muted)]">{s.detail}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 font-semibold text-[var(--accent)]"
                  {...demoAction(s.action.toLowerCase())}
                >
                  {s.action}
                  <ArrowUpRight className="v4-arrow size-3.5" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </BentoCard>

        {/* Контрольные точки */}
        <BentoCard span={4} title="Контрольные точки" subtitle="Вехи проекта" flush>
          <ul className="py-1">
            {MILESTONES.map((m) => (
              <li key={m.wbs} className="v4-row flex items-center gap-3 px-4 py-2.5">
                <Flag className={cn("size-4 shrink-0", m.done ? "text-[var(--success)]" : "text-[var(--muted-soft)]")} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[length:var(--text-md)] text-[var(--text-strong)]">{m.name}</div>
                  <div className="v4-mono text-[length:var(--text-xs)] text-[var(--muted)]">{m.wbs}</div>
                </div>
                <span className="v4-num shrink-0 text-[length:var(--text-sm)] text-[var(--muted-strong)]">{m.date}</span>
              </li>
            ))}
          </ul>
        </BentoCard>

        {/* Ключевые задачи */}
        <BentoCard span={7} title="Ключевые задачи" subtitle="Критический путь и ближайшие сроки" flush>
          <table className="w-full border-collapse text-[length:var(--text-sm)]">
            <tbody>
              {KEY_TASKS.map((t) => (
                <tr key={t.wbs} className="v4-row border-b border-[var(--border-subtle)] last:border-0">
                  <td className="v4-mono py-2.5 pl-4 pr-2 align-middle text-[length:var(--text-xs)] text-[var(--muted)]">{t.wbs}</td>
                  <td className="py-2.5 pr-3 align-middle">
                    <div className="flex items-center gap-2">
                      {t.critical ? <span className="size-1.5 shrink-0 rounded-full bg-[var(--critical-stripe)]" title="На критическом пути" /> : null}
                      <span className="truncate font-medium text-[var(--text-strong)]">{t.name}</span>
                    </div>
                  </td>
                  <td className="w-32 py-2.5 pr-3 align-middle">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={t.progress} critical={Boolean(t.critical)} />
                      <span className="v4-num w-8 shrink-0 text-right text-[length:var(--text-xs)] text-[var(--muted)]">{t.progress}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-2 align-middle">
                    <BemAvatar initials={t.assignee.initials} color={t.assignee.color} size="sm" />
                  </td>
                  <td className="v4-num py-2.5 pr-4 align-middle text-right text-[length:var(--text-sm)] text-[var(--muted-strong)]">{t.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </BentoCard>

        {/* Последние коммиты — PM-as-code */}
        <BentoCard
          span={5}
          title="Последние коммиты"
          subtitle="История изменений проекта · обратимая"
          actions={<GitCommit className="size-4 text-[var(--muted)]" aria-hidden />}
          flush
          footer={
            <span className="flex items-center justify-between">
              <span>Каждое изменение — коммит, можно откатить</span>
              <Button variant="link" size="sm" className="h-auto p-0 text-[var(--accent)]" {...demoAction("полная история")}>
                Вся история
              </Button>
            </span>
          }
        >
          <ul className="py-1">
            {COMMITS.map((c) => (
              <li key={c.time} className="v4-row group flex items-start gap-2.5 px-4 py-2.5">
                <span className="mt-[5px] size-2 shrink-0 rounded-full bg-[var(--accent)] ring-2 ring-[var(--accent-soft)]" />
                <span className="v4-num mt-0.5 w-[68px] shrink-0 text-[length:var(--text-xs)] text-[var(--muted)]">{c.time}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[length:var(--text-sm)] text-[var(--text)]">
                    <b className="font-semibold text-[var(--text-strong)]">{c.author}</b> {c.message}
                  </div>
                  <div className="v4-mono text-[length:var(--text-xs)] text-[var(--muted-soft)]">{c.ref}</div>
                </div>
                <button
                  type="button"
                  className="mt-0.5 shrink-0 text-[var(--muted-soft)] opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Откатить коммит ${c.time}`}
                  disabled
                  title="Демо-прототип: откат коммита подключится к рабочему приложению"
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </BentoCard>
      </Bento>
    </DeliveryFrame>
  );
}
