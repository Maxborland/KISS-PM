import type { ReactNode } from "react";
import type { LandingLocale } from "../../../lib/landing-i18n";
import { Cta } from "../ScreenShell";
import type { DemoDeal } from "../../../demo/fixture";

interface Props {
  deal: DemoDeal;
  locale?: LandingLocale;
  onAdvance: () => void;
  onExplore: (message: string) => void;
}

const COPY = {
  ru: {
    favorite: "Добавить в избранное",
    favoriteNotice: "Избранные сделки доступны из списка CRM.",
    created: "Создана",
    syncTitle: "Синхронизировано с CRM",
    sync: "синхр. 2 мин назад",
    participants: "Участники сделки",
    discuss: "Обсудить",
    discussNotice: "Обсуждение сделки открыто рядом со сводкой и активностью.",
    capacity: "Проверить ёмкость →",
    summary: "Сводка по сделке",
    details: "Показать детали",
    activity: "Активность",
    thread: "Обсуждение сделки",
    delivered: "Доставлено",
    composer: "Написать сообщение…",
    file: "Файл",
    mention: "Упомянуть",
    related: "Связанные сущности",
    relatedNotice: (label: string, title: string) => `${label} «${title}» открывается в CRM.`,
  },
  en: {
    favorite: "Add to favorites",
    favoriteNotice: "Favorite opportunities are available from the CRM list.",
    created: "Created",
    syncTitle: "Synced with CRM",
    sync: "synced 2 min ago",
    participants: "Opportunity participants",
    discuss: "Discuss",
    discussNotice: "The opportunity discussion opens next to summary and activity.",
    capacity: "Check capacity →",
    summary: "Opportunity summary",
    details: "Show details",
    activity: "Activity",
    thread: "Opportunity discussion",
    delivered: "Delivered",
    composer: "Write a message…",
    file: "File",
    mention: "Mention",
    related: "Related entities",
    relatedNotice: (label: string, title: string) => `${label} “${title}” opens in CRM.`,
  },
} as const;

export function CrmDealScreen({ deal, locale = "ru", onAdvance, onExplore }: Props) {
  const copy = COPY[locale];
  const ws = deal.workspace;
  if (!ws) return null;

  return (
    <div className="deal-workspace">
      <header className="deal-workspace__head">
        <div className="deal-workspace__title-block">
          <div className="deal-workspace__title-row">
            <button type="button" className="deal-workspace__star" aria-label={copy.favorite} onClick={() => onExplore(copy.favoriteNotice)}>
              ★
            </button>
            <h2 className="deal-workspace__title">{deal.name}</h2>
            <span className="deal-workspace__status">{ws.statusLabel}</span>
          </div>
          <p className="deal-workspace__meta">
            {deal.id} · {copy.created} {ws.createdAt} · {deal.owner}
            <span className="deal-workspace__sync" title={copy.syncTitle}>
              · {copy.sync}
            </span>
          </p>
        </div>

        <div className="deal-workspace__toolbar">
          <div className="deal-workspace__avatars" aria-label={copy.participants}>
            {ws.team.map((member) => (
              <span key={member.initials} className="deal-workspace__avatar" title={`${member.name} · ${member.role}`}>
                {member.initials}
                {member.online ? <span className="deal-workspace__avatar-dot" /> : null}
              </span>
            ))}
          </div>
          <Cta variant="ghost" label={copy.discuss} onClick={() => onExplore(copy.discussNotice)} />
          <Cta variant="primary" label={copy.capacity} emphasis onClick={onAdvance} />
        </div>
      </header>

      <div className="deal-workspace__body">
        <div className="deal-workspace__cols">
          <div className="deal-workspace__side">
            <DealPanel title={copy.summary}>
              <dl className="deal-kv">
                {ws.summary.map((row) => (
                  <div key={row.label} className="deal-kv__row">
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
              <button type="button" className="deal-panel__more" tabIndex={-1}>
                {copy.details}<span aria-hidden="true">▾</span>
              </button>
            </DealPanel>

            <DealPanel title={copy.activity}>
              <ul className="deal-activity" role="list">
                {ws.activities.map((item) => (
                  <li key={`${item.who}-${item.when}`} className="deal-activity__item">
                    <span className={`deal-activity__icon deal-activity__icon--${item.kind}`} />
                    <div className="deal-activity__content">
                      <div className="deal-activity__head">
                        <span className="deal-activity__who">{item.who}</span>
                        <time dateTime={item.when}>{item.when}</time>
                      </div>
                      <p className="deal-activity__what">{item.what}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </DealPanel>
          </div>

          <DealPanel title={copy.thread} className="deal-panel--chat">
            <div className="deal-chat" role="log" aria-label={copy.thread}>
              {ws.thread.map((msg) => (
                <article key={`${msg.author}-${msg.when}`} className={`deal-chat__msg${msg.highlight ? " deal-chat__msg--note" : ""}${msg.fresh ? " deal-chat__msg--fresh" : ""}`}>
                  <header className="deal-chat__head">
                    <span className="deal-chat__author">{msg.author}<span className="deal-chat__role">· {msg.role}</span></span>
                    <time dateTime={msg.when}>{msg.when}</time>
                  </header>
                  <p className="deal-chat__text">{msg.text}</p>
                  {msg.fresh ? <span className="deal-chat__read" aria-label={copy.delivered}>✓✓</span> : null}
                </article>
              ))}
            </div>
            <div className="deal-composer" aria-hidden="true">
              <div className="deal-composer__field">{copy.composer}</div>
              <div className="deal-composer__tools">
                <span className="deal-composer__tool">{copy.file}</span>
                <span className="deal-composer__tool">{copy.mention}</span>
              </div>
            </div>
          </DealPanel>
        </div>

        <section className="deal-related" aria-label={copy.related}>
          <h3 className="deal-related__title">{copy.related}</h3>
          <div className="deal-related__grid">
            {ws.related.map((entity) => (
              <button key={entity.label} type="button" className="deal-related__card" onClick={() => onExplore(copy.relatedNotice(entity.label, entity.title))}>
                <span className="deal-related__label">{entity.label}</span>
                <span className="deal-related__name">{entity.title}</span>
                <span className="deal-related__meta">{entity.meta}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function DealPanel({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <section className={`deal-panel${className ? ` ${className}` : ""}`}>
      <h3 className="deal-panel__title">{title}</h3>
      <div className="deal-panel__body">{children}</div>
    </section>
  );
}