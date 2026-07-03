import { useMemo, useState } from "react";

export type DiffReviewState =
  | "default"
  | "selected"
  | "edited"
  | "rejected"
  | "permission"
  | "stale";

type HunkStatus = "ready" | "selected" | "edited" | "rejected" | "warning";

interface Hunk {
  id: string;
  entity: string;
  title: string;
  before: string;
  after: string;
  reason: string;
  status: HunkStatus;
}

const baseHunks: Hunk[] = [
  {
    id: "H-102",
    entity: "Task",
    title: "Создать задачу для финального ревью макетов",
    before: "В плане нет отдельной проверки после задержки дизайна.",
    after: "Добавить задачу на 2 дня, owner: Анна, связать с клиентским демо.",
    reason: "Снижает риск повторной переделки перед показом.",
    status: "selected",
  },
  {
    id: "H-103",
    entity: "Milestone",
    title: "Сдвинуть демо кабинета на 4 рабочих дня",
    before: "Демо запланировано на пятницу текущей недели.",
    after: "Перенести на среду следующей недели, сохранить внешний deadline без изменения.",
    reason: "Сдвиг выравнивает дизайн, frontend и подготовку клиента.",
    status: "ready",
  },
  {
    id: "H-104",
    entity: "Dependency",
    title: "Добавить зависимость API перед сборкой UI",
    before: "Frontend-задачи стартуют до готовности API-контракта.",
    after: "Заблокировать сборку UI до принятого API hunk.",
    reason: "Убирает скрытую причину повторного цикла ревью.",
    status: "ready",
  },
  {
    id: "H-105",
    entity: "Risk",
    title: "Зафиксировать риск перегруза frontend-команды",
    before: "Нагрузка держится на уровне 118% без управленческого решения.",
    after: "Создать риск с owner: Илья, срок ревью: завтра 12:00.",
    reason: "Риск получает владельца и дату следующего решения.",
    status: "ready",
  },
];

function getStateHunks(state: DiffReviewState): Hunk[] {
  return baseHunks.map((hunk, index) => {
    if (state === "default") {
      return { ...hunk, status: index === 0 ? "selected" : "ready" };
    }

    if (state === "selected") {
      return { ...hunk, status: index < 3 ? "selected" : "ready" };
    }

    if (state === "edited" && hunk.id === "H-103") {
      return {
        ...hunk,
        after: "Перенести на вторник следующей недели, добавить короткий клиентский чек-ин.",
        status: "edited",
      };
    }

    if (state === "rejected" && hunk.id === "H-104") {
      return { ...hunk, status: "rejected" };
    }

    if (state === "permission" && hunk.id === "H-105") {
      return { ...hunk, status: "warning" };
    }

    return hunk;
  });
}

function stateLabel(status: HunkStatus) {
  const labels: Record<HunkStatus, string> = {
    ready: "Готово к ревью",
    selected: "Выбрано",
    edited: "Отредактировано",
    rejected: "Отклонено",
    warning: "Нужны права",
  };

  return labels[status];
}

export function DiffReviewMock({
  state = "default",
  compact = false,
}: {
  state?: DiffReviewState;
  compact?: boolean;
}) {
  const hunks = useMemo(() => getStateHunks(state), [state]);
  const initialSelected = useMemo(
    () => new Set(hunks.filter((hunk) => hunk.status === "selected").map((hunk) => hunk.id)),
    [hunks],
  );
  const [selected, setSelected] = useState(initialSelected);
  const [reviewNote, setReviewNote] = useState("Demo mode: hunks можно выбрать локально, данные не применяются.");

  const selectedCount = selected.size;

  function toggleHunk(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <section className={`alpha-diff ${compact ? "alpha-diff--compact" : ""}`} id="diff-review" aria-label="Project diff">
      <div className="alpha-diff__toolbar">
        <div>
          <span className="alpha-kicker">Proposed project diff</span>
          <h3>Редизайн кабинета / неделя 24</h3>
        </div>
        <div className="alpha-diff__summary">
          <b>{selectedCount}</b>
          <span>выбрано</span>
        </div>
      </div>

      {state === "permission" ? (
        <div className="alpha-warning alpha-warning--permission">
          <b>Требуется подтверждение роли</b>
          <span>Изменение риска затрагивает внешний deadline и доступно только владельцу проекта.</span>
        </div>
      ) : null}

      {state === "stale" ? (
        <div className="alpha-warning alpha-warning--stale">
          <b>Контекст устарел</b>
          <span>После подготовки diff появились новые комментарии. Перед применением агент обновит расчет.</span>
        </div>
      ) : null}

      <div className="alpha-hunks">
        {hunks.map((hunk) => {
          const isSelected = selected.has(hunk.id);

          return (
            <article
              className={`alpha-hunk alpha-hunk--${hunk.status} ${isSelected ? "is-selected" : ""}`}
              key={hunk.id}
            >
              <header className="alpha-hunk__header">
                <label className="alpha-check">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleHunk(hunk.id)}
                    aria-label={`Выбрать ${hunk.id}`}
                    disabled={hunk.status === "rejected" || hunk.status === "warning"}
                  />
                  <span />
                </label>
                <div>
                  <span className="alpha-hunk__id">{hunk.id}</span>
                  <h4>{hunk.title}</h4>
                </div>
                <span className="alpha-pill">{stateLabel(hunk.status)}</span>
              </header>
              <div className="alpha-hunk__body">
                <span>{hunk.entity}</span>
                <p>{hunk.before}</p>
                <p>{hunk.after}</p>
              </div>
              <footer className="alpha-hunk__footer">
                <span>{hunk.reason}</span>
              </footer>
            </article>
          );
        })}
      </div>

      <div className="alpha-diff__actions">
        <button className="alpha-btn alpha-btn--light" type="button" onClick={() => setReviewNote("Demo: все hunks отмечены для применения.")}>
          Принять все
        </button>
        <button className="alpha-btn alpha-btn--dark" type="button" onClick={() => setReviewNote(`Demo: к применению подготовлено ${selectedCount} hunk.`)}>
          Применить выбранное
        </button>
        <button className="alpha-btn alpha-btn--light" type="button" onClick={() => setReviewNote("Demo: выбранный hunk можно отредактировать перед применением.")}>
          Редактировать
        </button>
        <button className="alpha-btn alpha-btn--ghost" type="button" onClick={() => setReviewNote("Demo: выбранные изменения отклонены только в макете.")}>
          Отклонить
        </button>
      </div>

      <div className="alpha-audit-preview">
        <span>audit trail preview</span>
        <b>AGT-248 подготовил diff · Ирина выбрала hunks · применение ожидает ревью</b>
        <small>{reviewNote}</small>
      </div>
    </section>
  );
}
