import type { CSSProperties } from "react";
import { DemoShell } from "./DemoShell";

const ROWS = [
  { initials: "ИП", name: "Иван Петров", role: "Руководитель проекта", pct: 82, status: "ok" },
  { initials: "АС", name: "Анна Смирнова", role: "Бизнес-аналитик", pct: 67, status: "ok" },
  { initials: "ДК", name: "Дмитрий Кузнецов", role: "Разработчик", pct: 54, status: "ok" },
  { initials: "ЕВ", name: "Екатерина Волкова", role: "Дизайнер", pct: 91, status: "warn", hot: true },
  { initials: "МК", name: "Маркетинг-команда", role: "Ресурс", pct: 65, status: "ok" },
] as const;

export function CapacityCheckDemo({ active }: { active: boolean }) {
  return (
    <DemoShell active={active}>
      <article className="six-capacity">
        <header className="six-capacity__head">
          <h4 className="six-capacity__title">Загрузка команды</h4>
          <span className="six-capacity__period">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M7 4V2h2v2h6V2h2v2h2v16H5V4h2Zm0 4v10h10V8H7Z"
                fill="currentColor"
              />
            </svg>
            7–9 недель
          </span>
        </header>
        <ul className="six-capacity__list">
          {ROWS.map((row, i) => (
            <li
              key={row.name}
              className={`six-capacity__row six-capacity__row--${i + 1}${"hot" in row && row.hot ? " six-capacity__row--hot" : ""}`}
            >
              <span className="six-capacity__avatar">{row.initials}</span>
              <div className="six-capacity__meta">
                <span className="six-capacity__name">{row.name}</span>
                <span className="six-capacity__role">{row.role}</span>
              </div>
              <div className="six-capacity__bar-wrap">
                <div className="six-capacity__track">
                  <div
                    className="six-capacity__fill"
                    style={{ "--six-cap-pct": `${row.pct}%` } as CSSProperties}
                  />
                </div>
                <span className="six-capacity__pct">{row.pct}%</span>
                <span
                  className={`six-capacity__dot six-capacity__dot--${row.status}`}
                  aria-hidden="true"
                />
              </div>
            </li>
          ))}
        </ul>
        <footer className="six-capacity__forecast">
          <span className="six-capacity__forecast-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 12.5 11 14.5 15.5 9M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <p className="six-capacity__forecast-title">Прогноз: в рамках плана</p>
            <p className="six-capacity__forecast-sub">Перегрузок по команде не ожидается.</p>
          </div>
        </footer>
      </article>
    </DemoShell>
  );
}
