import type { LandingLocale } from "../../../lib/landing-i18n";
import { Cta, DemoScreenFrame } from "../DemoScreenFrame";
import type { DemoDeal } from "../../../demo/fixture";

interface Props {
  deals: ReadonlyArray<DemoDeal>;
  locale?: LandingLocale;
  onAdvance: () => void;
  onExplore: (message: string) => void;
}

const COPY = {
  ru: {
    title: "CRM · сделки",
    meta: "Воронка · стадия «Готова к оценке»",
    status: (count: number) => `${count} требуют ёмкости`,
    sync: "обновлено 3 мин назад",
    filter: "Фильтры",
    filterNotice: "Фильтр: сделки без проверки ёмкости перед проектом.",
    export: "Экспорт",
    exportNotice: "Экспорт доступен с правом crm.export.",
    bannerLabel: "Портфель",
    bannerValue: "147 активных проектов",
    bannerHint: "Перед новой сделкой — проверьте загрузку команд",
    columns: ["Сделка", "Стадия", "Сумма", "Владелец"],
    actionsLabel: "Действия",
    open: "Открыть",
    queued: "В очереди",
  },
  en: {
    title: "CRM · opportunities",
    meta: "Pipeline · Ready for estimate",
    status: (count: number) => `${count} need capacity check`,
    sync: "updated 3 min ago",
    filter: "Filters",
    filterNotice: "Filter: opportunities without a capacity check before project creation.",
    export: "Export",
    exportNotice: "Export is available with crm.export permission.",
    bannerLabel: "Portfolio",
    bannerValue: "147 active projects",
    bannerHint: "Before a new deal, check team load",
    columns: ["Opportunity", "Stage", "Value", "Owner"],
    actionsLabel: "Actions",
    open: "Open",
    queued: "Queued",
  },
} as const;

export function CrmListScreen({ deals, locale = "ru", onAdvance, onExplore }: Props) {
  const copy = COPY[locale];
  const hotCount = deals.filter((d) => d.hot).length;

  return (
    <DemoScreenFrame
      title={copy.title}
      meta={copy.meta}
      status={copy.status(hotCount)}
      statusTone="info"
      syncNote={copy.sync}
      toolbar={
        <>
          <button type="button" className="demo-toolbar-chip" onClick={() => onExplore(copy.filterNotice)}>
            {copy.filter} <span className="demo-toolbar-chip__count">3</span>
          </button>
          <Cta variant="ghost" label={copy.export} onClick={() => onExplore(copy.exportNotice)} />
        </>
      }
    >
      <div className="demo-crm-list">
        <div className="demo-crm-list__banner">
          <span className="demo-crm-list__banner-label">{copy.bannerLabel}</span>
          <span className="demo-crm-list__banner-value">{copy.bannerValue}</span>
          <span className="demo-crm-list__banner-hint">{copy.bannerHint}</span>
        </div>

        <div className="demo-table-wrap">
          <table className="demo-table">
            <thead>
              <tr>
                <th>{copy.columns[0]}</th>
                <th>{copy.columns[1]}</th>
                <th>{copy.columns[2]}</th>
                <th>{copy.columns[3]}</th>
                <th aria-label={copy.actionsLabel} />
              </tr>
            </thead>
            <tbody>
              {deals.map((d, i) => {
                const isHot = i === 0;
                return (
                  <tr key={d.id} className={isHot ? "demo-table__row demo-table__row--hot" : "demo-table__row"}>
                    <td>
                      <div className="demo-table__name">
                        {isHot ? <span className="demo-table__pulse" aria-hidden="true" /> : null}
                        <div>
                          <span className="demo-table__title">{d.name}</span>
                          <span className="demo-table__id">{d.id}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`demo-chip${isHot ? " demo-chip--accent" : ""}`}>{d.stage}</span>
                    </td>
                    <td className="demo-table__mono">{d.amount}</td>
                    <td>
                      <span className="demo-owner">
                        <span className="demo-avatar" aria-hidden="true">
                          {d.owner.split(" ").map((part) => part[0]).join("").replace(".", "")}
                        </span>
                        {d.owner}
                      </span>
                    </td>
                    <td className="demo-table__actions">
                      {isHot ? <Cta label={copy.open} emphasis onClick={onAdvance} /> : <span className="demo-table__queued">{copy.queued}</span>}
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