import { Cta, DemoScreenFrame } from "../DemoScreenFrame";
import type { DemoFixture } from "../../../demo/fixture";

interface Props {
  project: DemoFixture["project"];
  onAdvance: () => void;
  onExplore: (message: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  "in-progress": "В работе",
  todo: "К выполнению",
  done: "Готово",
};

export function ProjectScreen({ project, onAdvance, onExplore }: Props) {
  return (
    <DemoScreenFrame
      title={project.name}
      meta="Сводка портфеля · конфликт по роли «ведущий инженер»"
      status="42% средний прогресс"
      statusTone="neutral"
      syncNote={`осталось ${project.weeksLeft} нед. по горизонту`}
      toolbar={
        <>
          <Cta variant="ghost" label="План" onClick={() => onExplore("Гантт покажет те же зависимости и сроки.")} />
          <Cta variant="ghost" label="Ресурсы" onClick={() => onExplore("Матрица загрузки — тот же пул, что в проверке ёмкости.")} />
        </>
      }
    >
      <div className="demo-project">
        <div className="demo-project__kpis">
          <div className="demo-kpi">
            <span className="demo-kpi__label">Прогресс</span>
            <span className="demo-kpi__value">{project.progress}%</span>
          </div>
          <div className="demo-kpi">
            <span className="demo-kpi__label">Сигналы</span>
            <span className="demo-kpi__value demo-kpi__value--warn">3 открытых</span>
          </div>
          <div className="demo-kpi">
            <span className="demo-kpi__label">Связь</span>
            <span className="demo-kpi__value">ГК Север</span>
          </div>
        </div>

        <div className="demo-project__progress" role="progressbar" aria-valuenow={project.progress}>
          <span className="demo-project__progress-fill" style={{ width: `${project.progress}%` }} />
        </div>

        <div className="demo-table-wrap">
          <table className="demo-table">
            <thead>
              <tr>
                <th>Задача</th>
                <th>Исполнитель</th>
                <th>Срок</th>
                <th>Статус</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {project.tasks.map((t, i) => {
                const isHot = i === 0;
                return (
                  <tr key={t.id} className={isHot ? "demo-table__row demo-table__row--warn" : "demo-table__row"}>
                    <td>
                      <div className="demo-table__name">
                        {t.flagged ? <span className="demo-table__flag" aria-label="Сигнал" /> : null}
                        <div>
                          <span className="demo-table__title">{t.title}</span>
                          <span className="demo-table__id">{t.id}</span>
                        </div>
                      </div>
                    </td>
                    <td>{t.owner}</td>
                    <td className="demo-table__mono">{t.due}</td>
                    <td>
                      <span className={`demo-chip demo-chip--${t.status}`}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </span>
                    </td>
                    <td className="demo-table__actions">
                      {isHot ? <Cta label="Открыть" emphasis onClick={onAdvance} /> : <span className="demo-table__muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </DemoScreenFrame>
  );
}
