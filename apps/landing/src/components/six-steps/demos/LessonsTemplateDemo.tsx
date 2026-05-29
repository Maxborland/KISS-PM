import { DemoShell } from "./DemoShell";

const LESSONS = [
  {
    kind: "risk",
    label: "Риск",
    text: "Смещение сроков из-за зависимостей с поставщиками",
  },
  {
    kind: "solution",
    label: "Решение",
    text: "Раннее подключение поставщиков и буфер в плане",
  },
  {
    kind: "repeat",
    label: "Повторить",
    text: "Еженедельная синхронизация и единый источник данных",
  },
] as const;

const TEMPLATE_ITEMS = [
  "Планирование поставок",
  "Буфер по срокам",
  "Еженедельные синки",
  "Единый источник данных",
] as const;

function LessonIcon({ kind }: { kind: string }) {
  if (kind === "risk") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3 2 20h20L12 3Zm0 6v5m0 3h.01" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "solution") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3 11v2h6v-2a6 6 0 0 0-3-11Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12a8 8 0 0 1 13.5-5.7M20 12a8 8 0 0 1-13.5 5.7M8 12h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LessonsTemplateDemo({ active }: { active: boolean }) {
  return (
    <DemoShell active={active}>
      <div className="six-closure">
        <article className="six-closure__lessons">
          <h4 className="six-closure__lessons-title">
            <span className="six-closure__check-icon" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 12.5 11 14.5 15.5 9M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            </span>
            Уроки проекта
          </h4>
          <ul className="six-closure__lesson-list">
            {LESSONS.map((item, i) => (
              <li key={item.label} className={`six-closure__lesson six-closure__lesson--${i + 1}`}>
                <span className={`six-closure__lesson-icon six-closure__lesson-icon--${item.kind}`}>
                  <LessonIcon kind={item.kind} />
                </span>
                <div>
                  <span className="six-closure__lesson-label">{item.label}</span>
                  <p>{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </article>
        <div className="six-closure__bridge" aria-hidden="true">
          <svg className="six-closure__bridge-line" viewBox="0 0 80 24" fill="none">
            <path
              className="six-closure__bridge-path"
              d="M2 12 H58 M58 12 l-6 -5 M58 12 l-6 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="4 5"
              strokeLinecap="round"
            />
          </svg>
          <span className="six-closure__bridge-node">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 12.5 10 16.5 18 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
        </div>
        <article className="six-closure__template">
          <header className="six-closure__template-head">
            <h4>Шаблон проекта</h4>
            <span className="six-closure__badge">Новый</span>
          </header>
          <ul className="six-closure__checklist">
            {TEMPLATE_ITEMS.map((item, i) => (
              <li key={item} className={`six-closure__check six-closure__check--${i + 1}`}>
                <span className="six-closure__checkbox" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M6 12.5 10 16.5 18 7.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </span>
                <span>{item}</span>
                <span className="six-closure__drag" aria-hidden="true">
                  ⋮⋮
                </span>
              </li>
            ))}
          </ul>
          <span className="six-closure__add" aria-hidden="true">
            + Добавить пункт
          </span>
        </article>
      </div>
    </DemoShell>
  );
}
