import { Cta, ScreenShell } from "../ScreenShell";
import type { DemoFixture } from "../../../demo/fixture";

interface Props {
  task: DemoFixture["task"];
  onAdvance: () => void;
  onExplore: (message: string) => void;
}

export function TaskScreen({ task, onAdvance, onExplore }: Props) {
  return (
    <ScreenShell
      title={task.title}
      subtitle={`${task.id} · ${task.owner} · срок ${task.due}`}
      toolbar={
        <>
          <Cta
            variant="ghost"
            label="Обсуждение"
            onClick={() =>
              onExplore("Обсуждение связано с задачей и проектом, но сигнал уже собрал нужный контекст для решения.")
            }
          />
          <Cta
            variant="ghost"
            label="Назначить"
            onClick={() =>
              onExplore("Назначение доступно, но сначала важно увидеть причину: почему действие нужно именно сейчас.")
            }
          />
        </>
      }
    >
      <div className="task">
        <p className="task__desc">{task.description}</p>

        <div className="task__signal" role="button" tabIndex={0} onClick={onAdvance} onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onAdvance();
        }}>
          <span className="task__signal-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 3l9 16H3l9-16z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M12 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="17" r="1" fill="currentColor" />
            </svg>
          </span>
          <div>
            <p className="task__signal-title">Сигнал: перегруз роли через 3 недели</p>
            <p className="task__signal-body">
              Загрузка ведущего инженера выходит на 112%. Откройте сигнал, чтобы выбрать сценарий.
            </p>
          </div>
          <span className="task__signal-chev" aria-hidden="true">→</span>
        </div>

        <section className="task__activity">
          <h4 className="task__activity-title">Активность</h4>
          <ul>
            {task.activity.map((a, idx) => (
              <li key={idx} className="task__activity-row">
                <span className="task__activity-who">{a.who}</span>
                <span className="task__activity-what">— {a.what}</span>
                <span className="task__activity-when">{a.when}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <style>{`
        .task { display: grid; gap: 14px; }
        .task__desc {
          font-size: 13.5px;
          color: var(--text);
          line-height: 1.55;
        }
        .task__signal {
          display: grid;
          grid-template-columns: 36px 1fr max-content;
          gap: 12px;
          align-items: center;
          padding: 12px 14px;
          background: linear-gradient(135deg, var(--warning-soft) 0%, #fffaf0 100%);
          border: 1px solid #fcd34d;
          border-left-width: 4px;
          border-radius: var(--radius-md);
          cursor: pointer;
          color: #92400e;
          transition:
            transform var(--duration-ui) var(--ease-ui),
            box-shadow var(--duration-ui) var(--ease-ui);
        }
        .task__signal:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px -8px rgba(245, 158, 11, 0.35);
        }
        .task__signal-icon {
          width: 36px;
          height: 36px;
          background: #fde68a;
          border-radius: var(--radius-md);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #b45309;
        }
        .task__signal-title { font-weight: 700; font-size: 13.5px; color: #78350f; }
        .task__signal-body { font-size: 12.5px; color: #92400e; line-height: 1.5; margin-top: 2px; }
        .task__signal-chev { font-size: 18px; color: #b45309; font-weight: 700; }

        .task__activity-title {
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 700;
          margin: 0 0 6px;
        }
        .task__activity {
          padding-top: 8px;
          border-top: 1px solid var(--border-subtle);
        }
        .task__activity ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
        .task__activity-row {
          display: grid;
          grid-template-columns: max-content 1fr max-content;
          gap: 8px;
          font-size: 12.5px;
        }
        .task__activity-who { color: var(--text-strong); font-weight: 600; }
        .task__activity-what { color: var(--muted-strong); }
        .task__activity-when { color: var(--muted); font-variant-numeric: tabular-nums; }
      `}</style>
    </ScreenShell>
  );
}
