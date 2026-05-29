import { Cta, DemoScreenFrame } from "../DemoScreenFrame";
import type { DemoFixture } from "../../../demo/fixture";

interface Props {
  task: DemoFixture["task"];
  onAdvance: () => void;
  onExplore: (message: string) => void;
}

export function TaskScreen({ task, onAdvance, onExplore }: Props) {
  return (
    <DemoScreenFrame
      title={task.title}
      meta={`${task.id} · ${task.owner} · срок ${task.due}`}
      status="Сигнал активен"
      statusTone="warning"
      syncNote="DEAL-204 · ведущий инженер"
      toolbar={
        <>
          <Cta variant="ghost" label="Обсуждение" onClick={() => onExplore("Тред задачи связан с проектом и сделкой.")} />
          <Cta variant="ghost" label="Назначить" onClick={() => onExplore("Назначение доступно после выбора сценария.")} />
        </>
      }
    >
      <div className="demo-task">
        <p className="demo-task__desc">{task.description}</p>

        <button type="button" className="demo-task__signal" onClick={onAdvance}>
          <span className="demo-task__signal-icon" aria-hidden="true" />
          <div className="demo-task__signal-copy">
            <span className="demo-task__signal-kicker">Управленческий сигнал</span>
            <span className="demo-task__signal-title">Перегруз роли через 3 недели · 112%</span>
            <span className="demo-task__signal-body">
              Загрузка ведущего инженера выходит за порог. Откройте сигнал, чтобы выбрать сценарий.
            </span>
          </div>
          <span className="demo-task__signal-action">Открыть →</span>
        </button>

        <section className="demo-panel">
          <h3 className="demo-panel__title">Активность задачи</h3>
          <ul className="demo-activity-list">
            {task.activity.map((a) => (
              <li key={`${a.who}-${a.when}`} className="demo-activity-list__item">
                <div className="demo-activity-list__head">
                  <span className="demo-activity-list__who">{a.who}</span>
                  <time>{a.when}</time>
                </div>
                <p>{a.what}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </DemoScreenFrame>
  );
}
