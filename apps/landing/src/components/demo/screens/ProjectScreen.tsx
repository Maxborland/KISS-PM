import type { LandingLocale } from "../../../lib/landing-i18n";
import { Cta, DemoScreenFrame } from "../DemoScreenFrame";
import type { DemoFixture } from "../../../demo/fixture";

interface Props {
  project: DemoFixture["project"];
  locale?: LandingLocale;
  onAdvance: () => void;
  onExplore: (message: string) => void;
}

const COPY = {
  ru: {
    meta: "Сводка портфеля · конфликт по роли «ведущий инженер»",
    status: "42% средний прогресс",
    sync: (weeks: number) => `осталось ${weeks} нед. по горизонту`,
    plan: "План",
    planNotice: "Гантт покажет те же зависимости и сроки.",
    resources: "Ресурсы",
    resourcesNotice: "Матрица загрузки — тот же пул, что в проверке ёмкости.",
    progress: "Прогресс",
    signals: "Сигналы",
    openSignals: "3 открытых",
    link: "Связь",
    linked: "ГК Север",
    columns: ["Задача", "Исполнитель", "Срок", "Статус"],
    actions: "Действия",
    signal: "Сигнал",
    open: "Открыть",
    statuses: { "in-progress": "В работе", todo: "К выполнению", done: "Готово" },
  },
  en: {
    meta: "Portfolio summary · lead engineer conflict",
    status: "42% average progress",
    sync: (weeks: number) => `${weeks} weeks left in horizon`,
    plan: "Plan",
    planNotice: "Gantt shows the same dependencies and dates.",
    resources: "Resources",
    resourcesNotice: "The load matrix uses the same pool as the capacity check.",
    progress: "Progress",
    signals: "Signals",
    openSignals: "3 open",
    link: "Link",
    linked: "Northstar",
    columns: ["Task", "Owner", "Due", "Status"],
    actions: "Actions",
    signal: "Signal",
    open: "Open",
    statuses: { "in-progress": "In progress", todo: "To do", done: "Done" },
  },
} as const;

export function ProjectScreen({ project, locale = "ru", onAdvance, onExplore }: Props) {
  const copy = COPY[locale];
  return (
    <DemoScreenFrame title={project.name} meta={copy.meta} status={copy.status} statusTone="neutral" syncNote={copy.sync(project.weeksLeft)} toolbar={<><Cta variant="ghost" label={copy.plan} onClick={() => onExplore(copy.planNotice)} /><Cta variant="ghost" label={copy.resources} onClick={() => onExplore(copy.resourcesNotice)} /></>}>
      <div className="demo-project">
        <div className="demo-project__kpis">
          <div className="demo-kpi"><span className="demo-kpi__label">{copy.progress}</span><span className="demo-kpi__value">{project.progress}%</span></div>
          <div className="demo-kpi"><span className="demo-kpi__label">{copy.signals}</span><span className="demo-kpi__value demo-kpi__value--warn">{copy.openSignals}</span></div>
          <div className="demo-kpi"><span className="demo-kpi__label">{copy.link}</span><span className="demo-kpi__value">{copy.linked}</span></div>
        </div>

        <div className="demo-project__progress" role="progressbar" aria-valuenow={project.progress}>
          <span className="demo-project__progress-fill" style={{ width: `${project.progress}%` }} />
        </div>

        <div className="demo-table-wrap">
          <table className="demo-table">
            <thead><tr><th>{copy.columns[0]}</th><th>{copy.columns[1]}</th><th>{copy.columns[2]}</th><th>{copy.columns[3]}</th><th aria-label={copy.actions} /></tr></thead>
            <tbody>
              {project.tasks.map((t, i) => {
                const isHot = i === 0;
                return (
                  <tr key={t.id} className={isHot ? "demo-table__row demo-table__row--warn" : "demo-table__row"}>
                    <td><div className="demo-table__name">{t.flagged ? <span className="demo-table__flag" aria-label={copy.signal} /> : null}<div><span className="demo-table__title">{t.title}</span><span className="demo-table__id">{t.id}</span></div></div></td>
                    <td>{t.owner}</td>
                    <td className="demo-table__mono">{t.due}</td>
                    <td><span className={`demo-chip demo-chip--${t.status}`}>{copy.statuses[t.status as keyof typeof copy.statuses] ?? t.status}</span></td>
                    <td className="demo-table__actions">{isHot ? <Cta label={copy.open} emphasis onClick={onAdvance} /> : <span className="demo-table__muted">—</span>}</td>
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