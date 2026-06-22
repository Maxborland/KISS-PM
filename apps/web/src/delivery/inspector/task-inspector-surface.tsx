"use client";

import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  AtSign,
  Check,
  FileText,
  GitCommit,
  Link2,
  Paperclip,
  Send,
  Smile,
  TriangleAlert,
  Zap
} from "lucide-react";

import { BemAvatar } from "@/components/domain/bem-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
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

const TABS = ["Чат", "Файлы", "Встречи", "Аудит"] as const;
type Tab = (typeof TABS)[number];

type Color = "c1" | "c2" | "c3" | "c4" | "c5";

// Единая лента задачи (Conversation + DiscussionMessage + CrmActivity + audit-проекция).
// Разные ТИПЫ событий в одном хронологическом потоке (doc 25: «типы activity, а не вкладки»).
type Feed =
  | { kind: "divider"; label: string }
  | { kind: "system"; icon: typeof GitCommit; tone: "muted" | "warning" | "danger"; time: string; text: ReactNode; ref?: string; revertible?: boolean }
  | { kind: "comment"; author: string; initials: string; color: Color; time: string; body: ReactNode; reactions?: { emoji: string; n: number }[]; file?: { name: string; size: string } }
  | { kind: "task"; time: string; title: string; assignee: string; due: string; done: boolean };

const FEED: Feed[] = [
  { kind: "system", icon: GitCommit, tone: "muted", time: "10.05 09:14", text: <>задача создана из шаблона «Frontend»</>, ref: "calendar ProjCal" },
  {
    kind: "comment",
    author: "Анна П.",
    initials: "АП",
    color: "c2",
    time: "10.05 10:20",
    body: (
      <>
        Берём за основу утверждённый <b className="font-semibold text-[var(--text-strong)]">planning-ui-approved</b>. <span className="text-[var(--accent)]">@Михаил</span> начни с WBS-дерева, baseline-overlay во вторую очередь.
      </>
    ),
    reactions: [{ emoji: "👍", n: 2 }, { emoji: "🚀", n: 1 }]
  },
  { kind: "system", icon: GitCommit, tone: "muted", time: "12.05 11:08", text: <>назначен исполнителем · units 100% · effort-driven</>, ref: "Михаил К." },
  { kind: "task", time: "12.05 11:30", title: "Согласовать колонки сетки с PM", assignee: "Михаил К.", due: "15.05", done: true },
  {
    kind: "comment",
    author: "Михаил К.",
    initials: "МК",
    color: "c5",
    time: "13.05 16:40",
    body: <>Готов sticky-WBS + синхронный Gantt. Осталось baseline-overlay и критический путь. Черновик во вложении.</>,
    file: { name: "wbs-gantt-draft.png", size: "248 КБ" }
  },
  { kind: "system", icon: GitCommit, tone: "muted", time: "14.05 14:32", text: <>изменил длительность <b className="font-semibold text-[var(--text-strong)]">4 дн → 5 дн</b></>, ref: "Применено · 3.2.1", revertible: true },
  { kind: "system", icon: Zap, tone: "danger", time: "14.05 15:02", text: <>сигнал: критический путь без резерва (0 дн)</>, ref: "control_action · WBS 3.2.1" },
  { kind: "divider", label: "Новые" },
  {
    kind: "comment",
    author: "Иван И.",
    initials: "ИИ",
    color: "c1",
    time: "14.05 17:10",
    body: <>Апрувлю подход. После baseline-overlay двигаем в ревью. Срок держим.</>,
    reactions: [{ emoji: "✅", n: 1 }]
  }
];

const FACTS: { label: string; value: ReactNode; mono?: boolean }[] = [
  { label: "Статус", value: <span className="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--accent-soft)] px-2 py-0.5 text-[length:var(--text-sm)] font-medium text-[var(--accent)]">В работе</span> },
  { label: "Начало", value: "13.04.2026", mono: true },
  { label: "Финиш", value: "29.05.2026", mono: true },
  { label: "Длительность", value: "46 дн · расчёт", mono: true },
  { label: "Работа", value: "320 ч", mono: true },
  { label: "Исполнитель", value: "Михаил К." },
  { label: "Календарь", value: "ProjCal · унаследован" }
];

const DEPS = [
  { wbs: "3.1.1", type: "ОН", name: "Планировочный движок" },
  { wbs: "2.2", type: "ОН", name: "Контур безопасности" },
  { wbs: "5.1", type: "ОН", name: "Запуск пилота" }
];

function FactsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
      <h3 className="border-b border-[var(--border-subtle)] px-3.5 py-2.5 text-[length:var(--text-xs)] font-bold uppercase tracking-[0.05em] text-[var(--muted-soft)]">{title}</h3>
      <div className="px-3.5 py-2.5">{children}</div>
    </section>
  );
}

function ProgressMini({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--panel-strong)]">
        <span className="block h-full rounded-full bg-[var(--success)]" style={{ width: `${value}%` }} />
      </span>
      <span className="v4-num text-[length:var(--text-sm)] text-[var(--muted-strong)]">{value}%</span>
    </span>
  );
}

function FeedRow({ item }: { item: Feed }) {
  if (item.kind === "divider") {
    return (
      <div className="my-1 flex items-center gap-2 px-1">
        <span className="h-px flex-1 bg-[var(--danger)] opacity-40" />
        <span className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--danger)]">{item.label}</span>
        <span className="h-px flex-1 bg-[var(--danger)] opacity-40" />
      </div>
    );
  }
  if (item.kind === "system") {
    const tone = { muted: "text-[var(--muted)]", warning: "text-[var(--warning)]", danger: "text-[var(--danger)]" }[item.tone];
    return (
      <div className="group flex items-center gap-2 px-1 py-1.5">
        <span className={cn("grid size-5 shrink-0 place-items-center rounded-full bg-[var(--panel-strong)]", tone)}>
          <item.icon className="size-3" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 text-[length:var(--text-sm)] text-[var(--muted)]">
          {item.text} <span className="v4-mono text-[length:var(--text-xs)] text-[var(--muted-soft)]">· {item.ref} · {item.time}</span>
        </span>
        {item.revertible ? (
          <button type="button" className="v4-pop shrink-0 text-[length:var(--text-xs)] text-[var(--muted-soft)] opacity-0 group-hover:opacity-100" disabled title="Демо-прототип: откат коммита подключится к рабочему приложению">
            Откатить
          </button>
        ) : null}
      </div>
    );
  }
  if (item.kind === "task") {
    return (
      <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-2">
        <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-[var(--radius-xs)] border", item.done ? "border-[var(--success)] bg-[var(--success)] text-white" : "border-[var(--border-strong)]")}>
          {item.done ? <Check className="size-3" aria-hidden /> : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className={cn("text-[length:var(--text-md)]", item.done ? "text-[var(--muted)] line-through" : "font-medium text-[var(--text-strong)]")}>{item.title}</div>
          <div className="text-[length:var(--text-xs)] text-[var(--muted)]">Задача · {item.assignee} · до {item.due} · {item.time}</div>
        </div>
      </div>
    );
  }
  // comment
  return (
    <div className="group flex gap-2.5 px-1 py-1.5">
      <BemAvatar initials={item.initials} color={item.color} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">{item.author}</span>
          <span className="v4-num text-[length:var(--text-xs)] text-[var(--muted-soft)]">{item.time}</span>
        </div>
        <div className="mt-0.5 text-[length:var(--text-md)] leading-[var(--lh-md)] text-[var(--text)]">{item.body}</div>
        {item.file ? (
          <div className="mt-1.5 inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-2.5 py-1.5">
            <FileText className="size-4 text-[var(--muted)]" aria-hidden />
            <span className="text-[length:var(--text-sm)] font-medium text-[var(--text-strong)]">{item.file.name}</span>
            <span className="v4-num text-[length:var(--text-xs)] text-[var(--muted-soft)]">{item.file.size}</span>
          </div>
        ) : null}
        {item.reactions ? (
          <div className="mt-1.5 flex items-center gap-1.5">
            {item.reactions.map((r) => (
              <span key={r.emoji} className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--panel-subtle)] px-1.5 py-0.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
                <span>{r.emoji}</span>
                <span className="v4-num">{r.n}</span>
              </span>
            ))}
            <button type="button" className="grid size-5 place-items-center rounded-full text-[var(--muted-soft)] opacity-0 transition-opacity hover:bg-[var(--panel-strong)] group-hover:opacity-100" disabled title="Демо-прототип: реакции подключатся к рабочему приложению">
              <Smile className="size-3.5" aria-hidden />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function TaskInspector() {
  const [tab, setTab] = useState<Tab>("Чат");

  return (
    <DeliveryFrame project={PROJECT} activeTab="График">
      {/* Sub-header */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button type="button" className="v4-row flex items-center gap-1.5 rounded-[var(--radius-md)] px-2 py-1 text-[length:var(--text-sm)] font-medium text-[var(--accent)]" title="Демо-прототип: навигация подключится в рабочем приложении">
          <ArrowLeft className="size-3.5" aria-hidden />
          График
        </button>
        <h2 className="font-[family-name:var(--font-display)] text-[19px] font-extrabold tracking-[-0.02em] text-[var(--text-strong)]">WBS + Gantt</h2>
        <span className="v4-mono text-[length:var(--text-sm)] text-[var(--muted)]">WBS 3.2.1 · план v17</span>
        <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--danger-soft)] px-2 py-0.5 text-[length:var(--text-sm)] font-medium text-[var(--danger-text)]">
          <TriangleAlert className="size-3" aria-hidden /> На критическом пути
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="secondary" size="sm" {...demoAction("открытие в Gantt")}>Открыть в Gantt</Button>
          <Button variant="destructive-soft" size="sm" {...demoAction("удаление задачи")}>Удалить</Button>
        </div>
      </div>

      <div className="v4-split">
        {/* MAIN = ЧАТ (герой) */}
        <div className="flex h-[640px] min-w-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
          {/* tabs */}
          <div className="flex shrink-0 items-center gap-1 border-b border-[var(--border)] px-2">
            {TABS.map((t) => {
              const active = t === tab;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn("relative px-3 py-2.5 text-[length:var(--text-sm)] font-medium transition-colors", active ? "text-[var(--text-strong)]" : "text-[var(--muted)] hover:text-[var(--text)]")}
                >
                  {t}
                  {active ? <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--accent)]" /> : null}
                </button>
              );
            })}
            <span className="v4-num ml-auto pr-2 text-[length:var(--text-xs)] text-[var(--muted-soft)]">1 новое</span>
          </div>

          {tab === "Чат" ? (
            <>
              {/* feed */}
              <div className="flex-1 overflow-y-auto px-3 py-2">
                {FEED.map((item, i) => (
                  <FeedRow key={i} item={item} />
                ))}
              </div>
              {/* composer */}
              <div className="shrink-0 border-t border-[var(--border)] bg-[var(--panel-subtle)] p-2.5">
                <div className="rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--panel)]">
                  <textarea
                    rows={2}
                    placeholder="Написать сообщение…  @ — упомянуть"
                    className="w-full resize-none bg-transparent px-3 py-2 text-[length:var(--text-md)] text-[var(--text)] outline-none placeholder:text-[var(--muted-soft)]"
                  />
                  <div className="flex items-center gap-1 border-t border-[var(--border-subtle)] px-2 py-1.5">
                    <button type="button" className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)] disabled:opacity-50" disabled title="Демо-прототип: вложения подключатся к рабочему приложению"><Paperclip className="size-4" aria-hidden /></button>
                    <button type="button" className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)] disabled:opacity-50" disabled title="Демо-прототип: упоминания подключатся к рабочему приложению"><AtSign className="size-4" aria-hidden /></button>
                    <button type="button" className="grid size-7 place-items-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:bg-[var(--panel-strong)] disabled:opacity-50" disabled title="Демо-прототип: эмодзи подключатся к рабочему приложению"><Smile className="size-4" aria-hidden /></button>
                    <Button variant="default" size="sm" className="ml-auto" {...demoAction("отправка сообщения")}>
                      <Send className="size-3.5" aria-hidden />
                      Отправить
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-center">
              <div>
                <div className="text-[length:var(--text-md)] font-semibold text-[var(--text-strong)]">Раздел «{tab}»</div>
                <div className="mt-1 text-[length:var(--text-sm)] text-[var(--muted)]">Появится в рабочем приложении</div>
              </div>
            </div>
          )}
        </div>

        {/* ASIDE = свойства/факты (вторично) */}
        <aside className="v4-split__aside flex flex-col gap-3">
          <FactsCard title="Свойства">
            <dl className="flex flex-col">
              <div className="flex items-center justify-between gap-3 py-1.5">
                <dt className="text-[length:var(--text-sm)] text-[var(--muted-strong)]">Прогресс</dt>
                <dd><ProgressMini value={38} /></dd>
              </div>
              {FACTS.map((f) => (
                <div key={f.label} className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] py-1.5">
                  <dt className="shrink-0 text-[length:var(--text-sm)] text-[var(--muted-strong)]">{f.label}</dt>
                  <dd className={cn("min-w-0 truncate text-right text-[length:var(--text-md)] text-[var(--text-strong)]", f.mono && "v4-num")}>{f.value}</dd>
                </div>
              ))}
            </dl>
          </FactsCard>

          <FactsCard title="Зависимости">
            <ul className="flex flex-col gap-1.5">
              {DEPS.map((d) => (
                <li key={d.wbs} className="flex items-center gap-2 text-[length:var(--text-sm)]">
                  <Link2 className="size-3.5 shrink-0 text-[var(--muted-soft)]" aria-hidden />
                  <span className="v4-mono text-[var(--muted)]">{d.wbs}</span>
                  <span className="rounded-[var(--radius-xs)] bg-[var(--panel-strong)] px-1.5 text-[10px] font-semibold text-[var(--muted-strong)]">{d.type}</span>
                  <span className="truncate text-[var(--text)]">{d.name}</span>
                </li>
              ))}
            </ul>
          </FactsCard>

          <FactsCard title="Контроль и baseline">
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-[var(--radius-sm)] bg-[var(--panel-strong)] px-2 py-0.5 text-[length:var(--text-sm)] text-[var(--muted-strong)]">PM · Анна П.</span>
              <span className="rounded-[var(--radius-sm)] bg-[var(--panel-strong)] px-2 py-0.5 text-[length:var(--text-sm)] text-[var(--muted-strong)]">Approver · Иван И.</span>
              <span className="rounded-[var(--radius-sm)] bg-[var(--accent-soft)] px-2 py-0.5 text-[length:var(--text-sm)] text-[var(--accent)]">canManageProjectPlan</span>
              <span className="rounded-[var(--radius-sm)] bg-[var(--warning-soft)] px-2 py-0.5 text-[length:var(--text-sm)] text-[var(--warning-text)]">Baseline B2 · +3 дн</span>
            </div>
          </FactsCard>
        </aside>
      </div>
    </DeliveryFrame>
  );
}
