import { DemoShell } from "./DemoShell";
import { DottedConnector } from "./DottedConnector";

const INPUTS = [
  { icon: "building", label: "Объект", value: "ЖК Север, корпус 1" },
  { icon: "calendar", label: "Срок", value: "7–9 недель" },
  { icon: "team", label: "Команда", value: "avatars" },
  { icon: "list", label: "Этапы", value: "Аналитика → Запуск" },
  { icon: "budget", label: "Бюджет", value: "₽ 8 400 000" },
] as const;

function InputIcon({ kind }: { kind: string }) {
  const paths: Record<string, string> = {
    building: "M4 20V8l8-4 8 4v12H4Zm4-2h8v-6H8v6Z",
    calendar: "M7 4V2h2v2h6V2h2v2h2v16H5V4h2Zm0 4v10h10V8H7Z",
    team: "M9 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 0a2.5 2.5 0 1 0-2.5-2.5A2.5 2.5 0 0 0 17 11ZM4 20v-1a5 5 0 0 1 5-5h0a5 5 0 0 1 5 5v1M14 20v-1a4 4 0 0 1 3.5-4",
    list: "M6 7h12M6 12h12M6 17h8",
    budget: "M12 2a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6V2Zm-1 6h2v2h-2V8Zm0 4h2v6h-2v-6Z",
  };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d={paths[kind] ?? paths.list} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function TeamAvatars() {
  return (
    <span className="six-draft__avatars">
      {["ИП", "АС", "ДК", "ЕВ"].map((initials) => (
        <span key={initials} className="six-draft__avatar">
          {initials}
        </span>
      ))}
      <span className="six-draft__avatar six-draft__avatar--more">+2</span>
    </span>
  );
}

export function ProjectDraftDemo({ active }: { active: boolean }) {
  return (
    <DemoShell active={active}>
      <div className="six-draft">
        <ul className="six-draft__inputs">
          {INPUTS.map((item, i) => (
            <li key={item.label} className={`six-draft__input six-draft__input--${i + 1}`}>
              <span className="six-draft__input-icon">
                <InputIcon kind={item.icon} />
              </span>
              <div className="six-draft__input-text">
                <span className="six-draft__input-label">{item.label}</span>
                <span className="six-draft__input-value">
                  {item.value === "avatars" ? <TeamAvatars /> : item.value}
                </span>
              </div>
            </li>
          ))}
        </ul>
        <DottedConnector className="six-draft__arrow" variant="horizontal-long" />
        <article className="six-draft__result">
          <span className="six-draft__doc-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M8 3h6l4 4v14H8V3Zm6 1v4h4M10 12h8M10 16h6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <div className="six-draft__result-head">
            <h4 className="six-draft__result-title">Черновик проекта</h4>
            <span className="six-draft__badge">Черновик</span>
          </div>
          <dl className="six-draft__result-lines">
            <div>
              <dt>Объект</dt>
              <dd>ЖК Север, корпус 1</dd>
            </div>
            <div>
              <dt>Срок</dt>
              <dd>7–9 недель</dd>
            </div>
            <div>
              <dt>Команда</dt>
              <dd>
                <TeamAvatars />
              </dd>
            </div>
            <div>
              <dt>Этапы</dt>
              <dd>Аналитика → Запуск</dd>
            </div>
            <div>
              <dt>Бюджет</dt>
              <dd>₽ 8 400 000</dd>
            </div>
          </dl>
          <button type="button" className="six-draft__cta" tabIndex={-1}>
            Открыть черновик
          </button>
        </article>
      </div>
    </DemoShell>
  );
}
