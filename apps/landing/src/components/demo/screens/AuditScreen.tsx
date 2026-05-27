import { formatAuditEntry, labelActionType } from "../../../demo/labels";
import { ScreenShell } from "../ScreenShell";
import type { DemoFixture } from "../../../demo/fixture";

interface Props {
  audit: DemoFixture["audit"];
}

export function AuditScreen({ audit }: Props) {
  return (
    <ScreenShell
      title={`След решения · ${formatAuditEntry(audit.entry)}`}
      subtitle={`${audit.timestamp} · ${audit.actor}`}
    >
      <div className="audit">
        <div className="audit__row">
          <span className="audit__k">Действие</span>
          <span className="audit__v">{labelActionType(audit.action)}</span>
        </div>
        <div className="audit__row">
          <span className="audit__k">Цель</span>
          <span className="audit__v">{audit.target}</span>
        </div>
        <div className="audit__row">
          <span className="audit__k">Причина</span>
          <span className="audit__v">{audit.reason}</span>
        </div>

        <p className="audit__seal">
          ✓ Запись неизменяема. Видно, кто выбрал сценарий и что изменилось.
        </p>
      </div>

      <style>{`
        .audit {
          display: grid;
          gap: 10px;
          font-size: 13px;
          background: #0f172a;
          color: #cbd5f5;
          padding: 16px 18px;
          border-radius: var(--radius-md);
        }
        .audit__row {
          display: grid;
          grid-template-columns: 88px 1fr;
          gap: 14px;
          align-items: baseline;
        }
        .audit__k {
          color: #94a3b8;
          font-weight: 600;
          font-size: 12px;
        }
        .audit__v {
          color: #e2e8f0;
          line-height: 1.45;
        }
        .audit__seal {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px dashed rgba(148, 163, 184, 0.3);
          font-size: 12px;
          color: #94a3b8;
          font-family: var(--font-ui);
        }
      `}</style>
    </ScreenShell>
  );
}
