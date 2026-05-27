import { Cta, ScreenShell } from "../ScreenShell";
import type { DemoFixture } from "../../../demo/fixture";

type Deal = DemoFixture["deals"][number];

interface Props {
  deals: ReadonlyArray<Deal>;
  onAdvance: () => void;
  onExplore: (message: string) => void;
}

export function CrmListScreen({ deals, onAdvance, onExplore }: Props) {
  return (
    <ScreenShell
      title="Портфель · 147 активных проектов"
      subtitle="Новый проектный спрос · фильтр: «готово к оценке»"
      toolbar={
        <Cta
          variant="ghost"
          label="Фильтры (3)"
          onClick={() =>
            onExplore("Фильтры уже применены: показываем входящую работу, которую нужно проверить по ресурсам до обещания срока.")
          }
        />
      }
    >
      <table className="crm-table">
        <thead>
          <tr>
            <th>Спрос</th>
            <th>Стадия</th>
            <th>Сумма</th>
            <th>Владелец</th>
            <th aria-label="Действия"></th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d, i) => (
            <tr
              key={d.id}
              className={i === 0 ? "crm-table__row crm-table__row--hot" : "crm-table__row"}
            >
              <td>
                <div className="crm-table__name">
                  {i === 0 && <span className="crm-table__pulse" aria-hidden="true" />}
                  <span>{d.name}</span>
                  <span className="crm-table__id">{d.id}</span>
                </div>
              </td>
              <td>
                <span className={`crm-table__stage${i === 0 ? " crm-table__stage--hot" : ""}`}>
                  {d.stage}
                </span>
              </td>
              <td className="crm-table__amount">{d.amount}</td>
              <td className="crm-table__owner">{d.owner}</td>
              <td>
                {i === 0 ? (
                  <Cta label="Открыть" onClick={onAdvance} />
                ) : (
                  <button type="button" className="crm-table__ghost" disabled>
                    В очереди
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <style>{`
        .crm-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .crm-table thead th {
          text-align: left;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 600;
          padding: 8px 10px;
          border-bottom: 1px solid var(--border);
        }
        .crm-table__row td {
          padding: 12px 10px;
          border-bottom: 1px solid var(--border-subtle);
          vertical-align: middle;
        }
        .crm-table__row--hot {
          background: linear-gradient(90deg, rgba(37, 99, 235, 0.05), transparent 60%);
        }
        .crm-table__row--hot td:first-child {
          border-left: 2px solid var(--accent);
        }
        .crm-table__name {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: var(--text-strong);
          font-weight: 600;
        }
        .crm-table__id {
          color: var(--muted);
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 500;
        }
        .crm-table__pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 0 4px var(--accent-soft);
          animation: pulse 1.8s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
        .crm-table__stage {
          display: inline-block;
          padding: 4px 10px;
          border-radius: var(--radius-full);
          background: var(--panel-strong);
          color: var(--muted-strong);
          font-size: 11px;
          font-weight: 600;
        }
        .crm-table__stage--hot {
          background: var(--accent-soft);
          color: var(--accent-hover);
        }
        .crm-table__amount {
          font-family: var(--font-mono);
          font-weight: 600;
          color: var(--text-strong);
        }
        .crm-table__owner {
          color: var(--muted-strong);
        }
        .crm-table__ghost {
          font-size: 12px;
          color: var(--muted);
          background: transparent;
          padding: 6px 12px;
          border: 1px dashed var(--border-strong);
          border-radius: var(--radius-md);
          cursor: not-allowed;
        }
      `}</style>
    </ScreenShell>
  );
}
