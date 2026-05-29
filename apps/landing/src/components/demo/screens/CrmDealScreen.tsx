import type { ReactNode } from "react";
import { Cta } from "../ScreenShell";
import type { DemoDeal } from "../../../demo/fixture";

interface Props {
  deal: DemoDeal;
  onAdvance: () => void;
  onExplore: (message: string) => void;
}

export function CrmDealScreen({ deal, onAdvance, onExplore }: Props) {
  const ws = deal.workspace;
  if (!ws) {
    return null;
  }

  return (
    <div className="deal-workspace">
      <header className="deal-workspace__head">
        <div className="deal-workspace__title-block">
          <div className="deal-workspace__title-row">
            <button
              type="button"
              className="deal-workspace__star"
              aria-label="Добавить в избранное"
              onClick={() => onExplore("Избранные сделки доступны из списка CRM.")}
            >
              ★
            </button>
            <h2 className="deal-workspace__title">{deal.name}</h2>
            <span className="deal-workspace__status">{ws.statusLabel}</span>
          </div>
          <p className="deal-workspace__meta">
            {deal.id} · Создана {ws.createdAt} · {deal.owner}
            <span className="deal-workspace__sync" title="Синхронизировано с CRM">
              · синхр. 2 мин назад
            </span>
          </p>
        </div>

        <div className="deal-workspace__toolbar">
          <div className="deal-workspace__avatars" aria-label="Участники сделки">
            {ws.team.map((member) => (
              <span
                key={member.initials}
                className="deal-workspace__avatar"
                title={`${member.name} · ${member.role}`}
              >
                {member.initials}
                {member.online ? <span className="deal-workspace__avatar-dot" /> : null}
              </span>
            ))}
          </div>
          <Cta
            variant="ghost"
            label="Обсудить"
            onClick={() =>
              onExplore("Обсуждение ведётся на карточке — отдельный чат не нужен.")
            }
          />
          <Cta variant="primary" label="Проверить ёмкость →" emphasis onClick={onAdvance} />
        </div>
      </header>

      <div className="deal-workspace__body">
        <div className="deal-workspace__cols">
          <div className="deal-workspace__side">
            <DealPanel title="Сводка по сделке">
              <dl className="deal-kv">
                {ws.summary.map((row) => (
                  <div key={row.label} className="deal-kv__row">
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
              <button
                type="button"
                className="deal-panel__more"
                onClick={() =>
                  onExplore("Детальная карточка уже собрана: условия, команда и активности показаны в этом окне.")
                }
              >
                Показать детали
                <span aria-hidden="true">▾</span>
              </button>
            </DealPanel>

            <DealPanel title="Активность">
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

          <DealPanel title="Обсуждение сделки" className="deal-panel--chat">
            <div className="deal-chat" role="log" aria-label="Обсуждение сделки">
              {ws.thread.map((msg) => (
                <article
                  key={`${msg.author}-${msg.when}`}
                  className={`deal-chat__msg${msg.highlight ? " deal-chat__msg--note" : ""}${
                    msg.fresh ? " deal-chat__msg--fresh" : ""
                  }`}
                >
                  <header className="deal-chat__head">
                    <span className="deal-chat__author">
                      {msg.author}
                      <span className="deal-chat__role">· {msg.role}</span>
                    </span>
                    <time dateTime={msg.when}>{msg.when}</time>
                  </header>
                  <p className="deal-chat__text">{msg.text}</p>
                  {msg.fresh ? (
                    <span className="deal-chat__read" aria-label="Доставлено">
                      ✓✓
                    </span>
                  ) : null}
                </article>
              ))}
            </div>
            <div className="deal-composer" aria-hidden="true">
              <div className="deal-composer__field">Написать сообщение…</div>
              <div className="deal-composer__tools">
                <span className="deal-composer__tool">Файл</span>
                <span className="deal-composer__tool">Упомянуть</span>
              </div>
            </div>
          </DealPanel>
        </div>

        <section className="deal-related" aria-label="Связанные сущности">
          <h3 className="deal-related__title">Связанные сущности</h3>
          <div className="deal-related__grid">
            {ws.related.map((entity) => (
              <button
                key={entity.label}
                type="button"
                className="deal-related__card"
                onClick={() => onExplore(`${entity.label} «${entity.title}» открывается в CRM.`)}
              >
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

function DealPanel({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`deal-panel${className ? ` ${className}` : ""}`}>
      <h3 className="deal-panel__title">{title}</h3>
      <div className="deal-panel__body">{children}</div>
    </section>
  );
}
