import type { ReactNode } from "react";
import { labelPermission } from "../../../demo/labels";
import { Cta, DemoScreenFrame } from "../DemoScreenFrame";
import type { DemoFixture } from "../../../demo/fixture";

interface Props {
  action: DemoFixture["action"];
  onAdvance: () => void;
  onExplore: (message: string) => void;
}

export function ActionScreen({ action, onAdvance, onExplore }: Props) {
  return (
    <DemoScreenFrame
      title={action.title}
      meta="DEAL-204 · ведущий инженер · сбалансированный сценарий"
      status="Ожидает подтверждения"
      statusTone="info"
      toolbar={
        <>
          <Cta variant="ghost" label="Отменить" onClick={() => onExplore("Отмена не изменит план и не создаст запись в аудите.")} />
          <Cta label="Подтвердить и записать" emphasis onClick={onAdvance} />
        </>
      }
    >
      <div className="demo-action">
        <ActionBlock title="Требуемые права" tone="info">
          <ul>
            {action.permissions.map((p) => (
              <li key={p}>{labelPermission(p)}</li>
            ))}
          </ul>
        </ActionBlock>

        <ActionBlock title="Что изменится" tone="warn">
          <ol>
            {action.side_effects.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </ActionBlock>

        <div className="demo-action__preview">
          <span className="demo-action__preview-label">После подтверждения</span>
          <span className="demo-action__preview-value">112% → 94% · запись #4128 в аудите</span>
        </div>

        <p className="demo-action__note">
          Control surface вызывает команду приложения. Данные плана не меняются до явного подтверждения пользователем с нужными правами.
        </p>
      </div>
    </DemoScreenFrame>
  );
}

function ActionBlock({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "info" | "warn";
  children: ReactNode;
}) {
  return (
    <section className={`demo-action-block demo-action-block--${tone}`}>
      <h3 className="demo-action-block__title">{title}</h3>
      {children}
    </section>
  );
}
