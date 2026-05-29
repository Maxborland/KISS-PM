import { Cta, DemoScreenFrame } from "../DemoScreenFrame";
import type { DemoDeal } from "../../../demo/fixture";

interface Props {
  deals: ReadonlyArray<DemoDeal>;
  onAdvance: () => void;
  onExplore: (message: string) => void;
}

export function CrmListScreen({ deals, onAdvance, onExplore }: Props) {
  const hotCount = deals.filter((d) => d.hot).length;

  return (
    <DemoScreenFrame
      title="CRM · сделки"
      meta="Воронка · стадия «Готова к оценке»"
      status={`${hotCount} требуют ёмкости`}
      statusTone="info"
      syncNote="обновлено 3 мин назад"
      toolbar={
        <>
          <button
            type="button"
            className="demo-toolbar-chip"
            onClick={() => onExplore("Фильтр: сделки без проверки ёмкости перед проектом.")}
          >
            Фильтры <span className="demo-toolbar-chip__count">3</span>
          </button>
          <Cta variant="ghost" label="Экспорт" onClick={() => onExplore("Экспорт доступен с правом crm.export.")} />
        </>
      }
    >
      <div className="demo-crm-list">
        <div className="demo-crm-list__banner">
          <span className="demo-crm-list__banner-label">Портфель</span>
          <span className="demo-crm-list__banner-value">147 активных проектов</span>
          <span className="demo-crm-list__banner-hint">Перед новой сделкой — проверьте загрузку команд</span>
        </div>

        <div className="demo-table-wrap">
          <table className="demo-table">
            <thead>
              <tr>
                <th>Сделка</th>
                <th>Стадия</th>
                <th>Сумма</th>
                <th>Владелец</th>
                <th aria-label="Действия" />
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
                    <td>{d.owner}</td>
                    <td className="demo-table__actions">
                      {isHot ? (
                        <Cta label="Открыть" emphasis onClick={onAdvance} />
                      ) : (
                        <span className="demo-table__queued">В очереди</span>
                      )}
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
