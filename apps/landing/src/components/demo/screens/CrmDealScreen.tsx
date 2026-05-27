import { Cta, ScreenShell } from "../ScreenShell";
import type { DemoFixture } from "../../../demo/fixture";

interface Props {
  deal: DemoFixture["deals"][number];
  onAdvance: () => void;
  onExplore: (message: string) => void;
}

export function CrmDealScreen({ deal, onAdvance, onExplore }: Props) {
  return (
    <ScreenShell
      title={deal.name}
      subtitle={`${deal.id} · ${deal.stage} · ${deal.owner}`}
      toolbar={
        <>
          <Cta
            variant="ghost"
            label="Обсудить"
            onClick={() =>
              onExplore("Обсуждение остаётся рядом с проектным спросом: контекст не уезжает в отдельный чат.")
            }
          />
          <Cta label="Проверить ёмкость →" onClick={onAdvance} />
        </>
      }
    >
      <div className="deal__grid">
        <div className="deal__col">
          <Section title="Сводка">
            <KV label="Бюджет" value={deal.amount} />
            <KV label="Тип" value="Внедрение" />
            <KV label="Регион" value="Север-Запад" />
            <KV label="Источник" value="CRM / ручной ввод" />
          </Section>

          <Section title="Активность">
            <Activity who="Анна К." what="Прикрепила КП v2 и переписку" when="вчера · 17:48" />
            <Activity who="Клиент: А. Сергеев" what="Подтвердил готовность к подписанию" when="сегодня · 09:12" />
            <Activity who="KISS PM" what="Портфель сейчас: 147 активных проектов" when="сегодня · 11:00" />
          </Section>
        </div>

        <div className="deal__col">
          <Section title="Обсуждение">
            <Comment
              who="Анна К. · PM"
              when="11:24"
              text="Нужно понять, выдержит ли портфель новый спрос без перегруза ведущих инженеров."
            />
            <Comment
              who="Михаил Б. · Head of Delivery"
              when="11:40"
              text="Согласен. До обещания срока проверим ресурсную ёмкость на 7–9 неделях."
              accent
            />
          </Section>
        </div>
      </div>

      <style>{`
        .deal__grid {
          display: grid;
          gap: 16px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 720px) {
          .deal__grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        .deal__col {
          display: grid;
          gap: 12px;
        }
        .section {
          background: var(--panel-subtle);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 12px 14px;
          display: grid;
          gap: 8px;
        }
        .section__title {
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 700;
        }
        .kv {
          display: grid;
          grid-template-columns: 1fr max-content;
          gap: 8px;
          font-size: 13px;
        }
        .kv__label { color: var(--muted-strong); }
        .kv__value { color: var(--text-strong); font-weight: 600; }
        .activity {
          font-size: 12.5px;
          display: grid;
          grid-template-columns: 1fr max-content;
          gap: 6px;
        }
        .activity__who { color: var(--text-strong); font-weight: 600; }
        .activity__what { color: var(--muted-strong); }
        .activity__when { color: var(--muted); font-variant-numeric: tabular-nums; }
        .comment {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 10px 12px;
          display: grid;
          gap: 4px;
        }
        .comment--accent {
          background: var(--accent-soft);
          border-color: var(--accent-muted);
        }
        .comment__head {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--muted-strong);
          font-weight: 600;
        }
        .comment__text { font-size: 13px; color: var(--text); line-height: 1.5; }
      `}</style>
    </ScreenShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="section">
      <span className="section__title">{title}</span>
      {children}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="kv">
      <span className="kv__label">{label}</span>
      <span className="kv__value">{value}</span>
    </div>
  );
}

function Activity({ who, what, when }: { who: string; what: string; when: string }) {
  return (
    <div className="activity">
      <div>
        <span className="activity__who">{who}</span>{" "}
        <span className="activity__what">— {what}</span>
      </div>
      <span className="activity__when">{when}</span>
    </div>
  );
}

function Comment({
  who,
  when,
  text,
  accent,
}: {
  who: string;
  when: string;
  text: string;
  accent?: boolean;
}) {
  return (
    <div className={`comment${accent ? " comment--accent" : ""}`}>
      <header className="comment__head">
        <span>{who}</span>
        <span>{when}</span>
      </header>
      <p className="comment__text">{text}</p>
    </div>
  );
}
