import { DemoShell } from "./DemoShell";

const DATES = ["20 Май", "27 Май", "3 Июн", "10 Июн", "17 Июн"] as const;

const TASKS = [
  { name: "Исследование", left: "4%", width: "18%" },
  { name: "Проектирование", left: "18%", width: "20%" },
  { name: "Разработка ядра", left: "32%", width: "28%", active: true },
  { name: "Интеграция", left: "52%", width: "22%", shift: true },
  { name: "Тестирование", left: "68%", width: "18%", shift: true },
  { name: "Релиз", left: "82%", width: "12%" },
] as const;

export function LiveScheduleDemo({ active }: { active: boolean }) {
  return (
    <DemoShell active={active}>
      <div className="six-gantt">
        <header className="six-gantt__head">
          <button type="button" className="six-gantt__menu" tabIndex={-1} aria-label="Меню">
            <span />
            <span />
            <span />
          </button>
          <span className="six-gantt__period">
            Май — Июнь 2024
            <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" fill="none" />
            </svg>
          </span>
          <span className="six-gantt__pill">Дни</span>
          <span className="six-gantt__status">
            <span className="six-gantt__status-dot" />
            Разработка
          </span>
        </header>
        <div className="six-gantt__table">
          <div className="six-gantt__row six-gantt__row--head">
            <span className="six-gantt__task-col">Задача</span>
            {DATES.map((d) => (
              <span key={d} className="six-gantt__date-col">
                {d}
              </span>
            ))}
          </div>
          <div className="six-gantt__body">
            <div className="six-gantt__today" aria-hidden="true" />
            {TASKS.map((task, i) => (
              <div key={task.name} className={`six-gantt__row six-gantt__row--task six-gantt__row--${i + 1}`}>
                <span className="six-gantt__task-col">
                  <span className="six-gantt__grip" aria-hidden="true">
                    ⋮⋮
                  </span>
                  {task.name}
                </span>
                <div className="six-gantt__timeline">
                  <span
                    className={`six-gantt__bar${"active" in task && task.active ? " six-gantt__bar--active" : ""}${"shift" in task && task.shift ? " six-gantt__bar--shift" : ""}`}
                    style={{ left: task.left, width: task.width }}
                  >
                    {"active" in task && task.active ? (
                      <span className="six-gantt__handle" aria-hidden="true" />
                    ) : null}
                  </span>
                </div>
              </div>
            ))}
            <svg className="six-gantt__deps" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
              <path
                className="six-gantt__dep-line"
                d="M 168 28 L 168 48 L 220 48 L 220 68"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
              <path
                className="six-gantt__dep-line six-gantt__dep-line--2"
                d="M 248 68 L 248 88 L 290 88"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="3 4"
              />
            </svg>
          </div>
        </div>
      </div>
    </DemoShell>
  );
}
