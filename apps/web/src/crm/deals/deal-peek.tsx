"use client";

import { useEffect, useState, type ReactElement } from "react";
import { Loader2 } from "lucide-react";

import { money } from "@/crm/ui/crm-bits";
import type { CrmActivity, Opportunity } from "@/crm/lib/crm-client";
import type { CrmDataResult } from "@/crm/lib/use-crm";
import { UrlPeekSheet } from "@/workspace/lib/url-peek";

// Локальные словари статусов — как в deal-card-surface (карточка остаётся канонической).
const STATUS_LABEL: Record<Opportunity["status"], string> = { new: "Новая", feasibility: "Проверка", ready_to_activate: "Готова к запуску", won_closed: "Выиграна", lost_rejected: "Проиграна" };
const FEAS_LABEL: Record<string, string> = { ok: "Реализуема", warning: "С оговорками", conflict: "Конфликт ресурсов", blocked: "Заблокирована" };

const DEAL_DATE_FORMAT = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const dealDate = (value: string) => {
  const part = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!part) return value;
  return DEAL_DATE_FORMAT.format(new Date(Date.UTC(Number(part[1]), Number(part[2]) - 1, Number(part[3]))));
};

/** Сколько последних событий ленты показывает peek (полная лента — на канонической странице). */
export const DEAL_PEEK_ACTIVITY_LIMIT = 3;

export type DealPeekProps = {
  deal: Opportunity;
  pipelineName: string;
  stageName: string;
  ownerName: string;
  /** Лента активностей сделки — useCrm().loadActivities (реальный GET /crm/opportunity/:id/activity). */
  loadActivities: (entityType: "opportunity", entityId: string) => Promise<CrmDataResult<CrmActivity[]>>;
  /** Один фокусируемый элемент — триггер peek (Radix SheetTrigger asChild). */
  children: ReactElement;
};

/**
 * Peek-сводка сделки: открывается по `?deal=<id>` на /crm/deals (URL-грамматика TaskPeek).
 * СТРОГО read-only — все правки (PATCH, feasibility, активация, лента) только на
 * канонической странице /crm/deals/[id] («Открыть полностью»).
 */
export function DealPeek({ deal, pipelineName, stageName, ownerName, loadActivities, children }: DealPeekProps): ReactElement {
  const facts = [
    { label: "Клиент", value: deal.clientName || "—" },
    { label: "Контакт", value: deal.contactName || "—" },
    { label: "Воронка", value: pipelineName },
    { label: "Стадия", value: stageName },
    { label: "Сумма", value: money(deal.contractValue), num: true },
    { label: "Вероятность", value: `${deal.probability}%`, num: true },
    { label: "Владелец", value: ownerName },
    { label: "Срок", value: `${dealDate(deal.plannedStart)} — ${dealDate(deal.plannedFinish)}`, num: true },
    { label: "Осуществимость", value: deal.feasibilityStatus ? FEAS_LABEL[deal.feasibilityStatus] ?? deal.feasibilityStatus : "Не проверялась" }
  ];

  return (
    <UrlPeekSheet
      param="deal"
      id={deal.id}
      title={deal.title}
      description={`${STATUS_LABEL[deal.status]} · ${money(deal.contractValue)}`}
      fullHref={`/crm/deals/${encodeURIComponent(deal.id)}`}
      trigger={children}
    >
      <div className="flex flex-col gap-5">
        <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-[length:var(--text-xs)] font-medium text-[var(--muted)]">{fact.label}</dt>
              <dd className={`mt-0.5 break-words text-[length:var(--text-sm)] text-[var(--text)]${fact.num ? " v4-num" : ""}`}>{fact.value}</dd>
            </div>
          ))}
        </dl>

        {deal.description?.trim() ? (
          <section aria-labelledby="deal-peek-description">
            <h2 id="deal-peek-description" className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Описание</h2>
            <p className="mt-2 whitespace-pre-wrap text-[length:var(--text-sm)] leading-[var(--lh-md)] text-[var(--text)]">{deal.description}</p>
          </section>
        ) : null}

        {/* Монтируется только при открытом Sheet (Radix без forceMount) → лента грузится лениво. */}
        <DealPeekActivity dealId={deal.id} loadActivities={loadActivities} />
      </div>
    </UrlPeekSheet>
  );
}

/** Последние события ленты — read-only, с честными loading/error состояниями. */
function DealPeekActivity({ dealId, loadActivities }: { dealId: string; loadActivities: DealPeekProps["loadActivities"] }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; items: CrmActivity[] }>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    void loadActivities("opportunity", dealId).then((r) => {
      if (!alive) return;
      if (r.ok) setState({ status: "ready", items: r.data.slice(0, DEAL_PEEK_ACTIVITY_LIMIT) });
      else setState({ status: "error", message: r.message });
    });
    return () => { alive = false; };
  }, [dealId, loadActivities]);

  return (
    <section aria-labelledby="deal-peek-activity">
      <h2 id="deal-peek-activity" className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Последние события</h2>
      {state.status === "loading" ? (
        <div className="mt-2 flex items-center gap-2 text-[length:var(--text-xs)] text-[var(--muted)]"><Loader2 className="size-3.5 animate-spin" aria-hidden /> Загрузка ленты…</div>
      ) : state.status === "error" ? (
        <p role="alert" className="mt-2 text-[length:var(--text-xs)] text-[var(--danger-text)]">Не удалось загрузить ленту: {state.message}</p>
      ) : state.items.length === 0 ? (
        <p className="mt-2 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Пока нет активностей.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {state.items.map((a) => (
            <li key={a.id} className="min-w-0">
              <p className="truncate text-[length:var(--text-sm)] text-[var(--text)]">{a.title ?? a.body ?? "—"}</p>
              <p className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">
                {a.type === "task" ? (a.status === "done" ? "Задача · выполнена" : "Задача") : a.type === "file" ? "Файл" : "Комментарий"}
                {" · "}
                {new Date(a.createdAt).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
