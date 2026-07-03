import type { LandingLocale } from "../../../lib/landing-i18n";
import { Cta, DemoScreenFrame } from "../DemoScreenFrame";
import type { DemoFixture } from "../../../demo/fixture";

interface Props {
  task: DemoFixture["task"];
  locale?: LandingLocale;
  onAdvance: () => void;
  onExplore: (message: string) => void;
}

const COPY = {
  ru: {
    meta: (id: string, owner: string, due: string) => `${id} · ${owner} · срок ${due}`,
    status: "Сигнал активен",
    sync: "сделка «ГК Север» · ведущий инженер",
    discussion: "Обсуждение",
    discussionNotice: "Тред задачи связан с проектом и сделкой.",
    assign: "Назначить",
    assignNotice: "Назначение доступно после выбора сценария.",
    signalKicker: "Управленческий сигнал",
    signalTitle: "Перегруз роли через 3 недели · 112%",
    signalBody: "Загрузка ведущего инженера выходит за порог. Откройте сигнал, чтобы выбрать сценарий.",
    open: "Открыть →",
    activity: "Активность задачи",
  },
  en: {
    meta: (id: string, owner: string, due: string) => `${id} · ${owner} · due ${due}`,
    status: "Signal active",
    sync: "Northstar opportunity · lead engineer",
    discussion: "Discussion",
    discussionNotice: "The task thread is linked to the project and opportunity.",
    assign: "Assign",
    assignNotice: "Assignment is available after a scenario is selected.",
    signalKicker: "Management signal",
    signalTitle: "Role overload in 3 weeks · 112%",
    signalBody: "Lead engineer load crosses the threshold. Open the signal to choose a scenario.",
    open: "Open →",
    activity: "Task activity",
  },
} as const;

export function TaskScreen({ task, locale = "ru", onAdvance, onExplore }: Props) {
  const copy = COPY[locale];
  return (
    <DemoScreenFrame title={task.title} meta={copy.meta(task.id, task.owner, task.due)} status={copy.status} statusTone="warning" syncNote={copy.sync} toolbar={<><Cta variant="ghost" label={copy.discussion} onClick={() => onExplore(copy.discussionNotice)} /><Cta variant="ghost" label={copy.assign} onClick={() => onExplore(copy.assignNotice)} /></>}>
      <div className="demo-task">
        <p className="demo-task__desc">{task.description}</p>
        <button type="button" className="demo-task__signal" onClick={onAdvance}>
          <span className="demo-task__signal-icon" aria-hidden="true" />
          <div className="demo-task__signal-copy">
            <span className="demo-task__signal-kicker">{copy.signalKicker}</span>
            <span className="demo-task__signal-title">{copy.signalTitle}</span>
            <span className="demo-task__signal-body">{copy.signalBody}</span>
          </div>
          <span className="demo-task__signal-action">{copy.open}</span>
        </button>
        <section className="demo-panel">
          <h3 className="demo-panel__title">{copy.activity}</h3>
          <ul className="demo-activity-list">
            {task.activity.map((a) => (
              <li key={`${a.who}-${a.when}`} className="demo-activity-list__item">
                <div className="demo-activity-list__head"><span className="demo-activity-list__who">{a.who}</span><time>{a.when}</time></div>
                <p>{a.what}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </DemoScreenFrame>
  );
}