import { Cta, ScreenShell } from "../ScreenShell";
import type { DemoFixture } from "../../../demo/fixture";

interface Props {
  project: DemoFixture["project"];
  onAdvance: () => void;
  onExplore: (message: string) => void;
}

export function ProjectScreen({ project, onAdvance, onExplore }: Props) {
  return (
    <ScreenShell
      title={project.name}
      subtitle={`Прогресс: ${project.progress}% · осталось ${project.weeksLeft} нед.`}
      toolbar={
        <>
          <Cta
            variant="ghost"
            label="План"
            onClick={() =>
              onExplore("План покажет те же сроки и зависимости. В этом маршруте идём через задачу, которая создаёт давление.")
            }
          />
          <Cta
            variant="ghost"
            label="Ресурсы"
            onClick={() =>
              onExplore("Ресурсная матрица показывает ту же роль во времени. Сейчас важен источник будущего перегруза.")
            }
          />
        </>
      }
    >
      <div className="proj-bar" role="progressbar" aria-valuenow={project.progress}>
        <div className="proj-bar__fill" style={{ width: `${project.progress}%` }} />
      </div>

      <table className="proj-table">
        <thead>
          <tr>
            <th>Задача</th>
            <th>Исполнитель</th>
            <th>Срок</th>
            <th>Статус</th>
            <th aria-label="Действия"></th>
          </tr>
        </thead>
        <tbody>
          {project.tasks.map((t, i) => (
            <tr key={t.id} className={i === 0 ? "proj-table__row--hot" : ""}>
              <td>
                <div className="proj-table__title">
                  {t.flagged && <span className="proj-table__flag" aria-label="Сигнал" />}
                  <span>{t.title}</span>
                  <span className="proj-table__id">{t.id}</span>
                </div>
              </td>
              <td>{t.owner}</td>
              <td className="proj-table__due">{t.due}</td>
              <td>
                <StatusChip status={t.status} />
              </td>
              <td>
                {i === 0 ? (
                  <Cta label="Открыть" onClick={onAdvance} />
                ) : (
                  <span className="proj-table__muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <style>{`
        .proj-bar {
          height: 8px;
          background: var(--panel-strong);
          border: 1px solid var(--border);
          border-radius: var(--radius-full);
          overflow: hidden;
        }
        .proj-bar__fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent) 0%, #60a5fa 100%);
        }
        .proj-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          margin-top: 4px;
        }
        .proj-table th {
          text-align: left;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 600;
          padding: 8px 10px;
          border-bottom: 1px solid var(--border);
        }
        .proj-table td {
          padding: 12px 10px;
          border-bottom: 1px solid var(--border-subtle);
          vertical-align: middle;
        }
        .proj-table__row--hot {
          background: linear-gradient(90deg, rgba(245, 158, 11, 0.08), transparent 60%);
        }
        .proj-table__row--hot td:first-child {
          border-left: 2px solid var(--warning);
        }
        .proj-table__title {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: var(--text-strong);
          font-weight: 600;
        }
        .proj-table__flag {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--warning);
          box-shadow: 0 0 0 4px var(--warning-soft);
          animation: pulse 1.8s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
        .proj-table__id {
          color: var(--muted);
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 500;
        }
        .proj-table__due { font-family: var(--font-mono); color: var(--muted-strong); }
        .proj-table__muted { color: var(--muted); }
      `}</style>
    </ScreenShell>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string; border: string }> = {
    "in-progress": {
      label: "В работе",
      bg: "var(--accent-soft)",
      color: "var(--accent-hover)",
      border: "var(--accent-muted)",
    },
    todo: {
      label: "К выполнению",
      bg: "var(--panel-strong)",
      color: "var(--muted-strong)",
      border: "var(--border)",
    },
    done: {
      label: "Готово",
      bg: "var(--success-soft)",
      color: "#065f46",
      border: "#a7f3d0",
    },
  };
  const m = map[status] ?? map["todo"]!;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: "var(--radius-full)",
        background: m.bg,
        color: m.color,
        border: `1px solid ${m.border}`,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {m.label}
    </span>
  );
}
