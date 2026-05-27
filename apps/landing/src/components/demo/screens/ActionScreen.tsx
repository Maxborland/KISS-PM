import { labelPermission } from "../../../demo/labels";
import { Cta, ScreenShell } from "../ScreenShell";
import type { DemoFixture } from "../../../demo/fixture";

interface Props {
  action: DemoFixture["action"];
  onAdvance: () => void;
  onExplore: (message: string) => void;
}

export function ActionScreen({ action, onAdvance, onExplore }: Props) {
  return (
    <ScreenShell
      title={action.title}
      subtitle="Подтверждение управляемого действия"
      toolbar={
        <>
          <Cta
            variant="ghost"
            label="Отменить"
            onClick={() =>
              onExplore("Отмена оставит задачу без изменений. Для демо подтвердите действие, чтобы увидеть запись в истории.")
            }
          />
          <Cta label="Подтвердить и записать в аудит" onClick={onAdvance} />
        </>
      }
    >
      <div className="act">
        <Block title="Требуемые права" data-tone="info">
          <ul>
            {action.permissions.map((p) => (
              <li key={p}>{labelPermission(p)}</li>
            ))}
          </ul>
        </Block>

        <Block title="Что произойдёт" data-tone="warn">
          <ol>
            {action.side_effects.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </Block>

        <p className="act__note">
          KISS PM не выполняет действие, пока пользователь не подтвердил.
          Панель управления вызывает команду приложения, а не меняет данные напрямую.
        </p>
      </div>

      <style>{`
        .act { display: grid; gap: 12px; }
        .block {
          padding: 12px 14px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border);
        }
        .block[data-tone="info"] {
          background: var(--info-soft);
          border-color: #bae6fd;
        }
        .block[data-tone="warn"] {
          background: var(--warning-soft);
          border-color: #fcd34d;
        }
        .block__title {
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .block[data-tone="info"] .block__title { color: #0369a1; }
        .block[data-tone="warn"] .block__title { color: #b45309; }
        .block ul, .block ol {
          margin: 0;
          padding-left: 22px;
          font-size: 13px;
          color: var(--text);
          line-height: 1.6;
          display: grid;
          gap: 4px;
        }
        .act__note {
          font-size: 12.5px;
          color: var(--muted-strong);
          line-height: 1.55;
          border-top: 1px dashed var(--border-strong);
          padding-top: 12px;
        }
      `}</style>
    </ScreenShell>
  );
}

function Block({
  title,
  children,
  "data-tone": tone,
}: {
  title: string;
  children: React.ReactNode;
  "data-tone": "info" | "warn";
}) {
  return (
    <div className="block" data-tone={tone}>
      <p className="block__title">{title}</p>
      {children}
    </div>
  );
}
