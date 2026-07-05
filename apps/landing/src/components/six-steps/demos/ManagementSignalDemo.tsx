import { DemoShell } from "./DemoShell";

const ACTIONS = [
  { id: "move", label: "Перенести срок", primary: true, icon: "calendar" },
  { id: "resource", label: "Добавить ресурс", icon: "user" },
  { id: "risk", label: "Согласовать риск", icon: "flag" },
] as const;

function ActionIcon({ kind }: { kind: string }) {
  if (kind === "calendar") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 4V2h2v2h6V2h2v2h2v16H5V4h2Zm0 4v10h10V8H7Z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    );
  }
  if (kind === "user") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 4h12v3H6V4Zm0 7h12v9H6v-9Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ManagementSignalDemo({ active }: { active: boolean }) {
  return (
    <DemoShell active={active}>
      <div className="six-signal">
        <article className="six-signal__card">
          <header className="six-signal__card-head">
            <span className="six-signal__alert-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3 2 20h20L12 3Zm0 6v5m0 3h.01"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="six-signal__card-title">Сигнал</span>
            <time className="six-signal__time">11:24</time>
          </header>
          <p className="six-signal__risk">
            Высокий риск срыва срока по сделке «ГК Север» — вероятность{" "}
            <strong className="six-signal__prob">72%</strong>.
          </p>
          <div className="six-signal__cause">
            <span className="six-signal__cause-label">Причина</span>
            <p>Задержка согласования и занятость ключевого ресурса.</p>
          </div>
        </article>
        <div className="six-signal__actions">
          <h5 className="six-signal__actions-title">Рекомендуемые действия</h5>
          <div className="six-signal__actions-row">
            {ACTIONS.map((action, i) => (
              <button
                key={action.id}
                type="button"
                className={`six-signal__action six-signal__action--${i + 1}${"primary" in action && action.primary ? " six-signal__action--primary" : ""}`}
                tabIndex={-1}
              >
                <ActionIcon kind={action.icon} />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </DemoShell>
  );
}
