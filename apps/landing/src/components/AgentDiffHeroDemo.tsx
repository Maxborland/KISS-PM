import { useMemo, useState } from "react";

const hunks = [
  {
    id: "H-102",
    title: "Создать ревью макетов",
    target: "Task",
    text: "Owner: Анна · 2 дня · связать с клиентским демо.",
  },
  {
    id: "H-103",
    title: "Сдвинуть демо на 4 дня",
    target: "Milestone",
    text: "Внешний deadline не меняется, клиентский чек-ин добавлен.",
  },
  {
    id: "H-104",
    title: "Добавить зависимость API",
    target: "Dependency",
    text: "UI-сборка стартует после принятого API-контракта.",
  },
];

export default function AgentDiffHeroDemo() {
  const [selected, setSelected] = useState(() => new Set(["H-102", "H-103"]));
  const [applied, setApplied] = useState(false);

  const selectedCount = selected.size;
  const status = useMemo(() => {
    if (applied) return "audit trail обновлен";
    if (selectedCount === 0) return "выберите hunks";
    return `${selectedCount} hunk готово`;
  }, [applied, selectedCount]);

  function toggle(id: string) {
    setApplied(false);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="hero-agent-demo" aria-label="Демо разговора с проектным агентом">
      <div className="hero-agent-demo__bar">
        <span>project agent</span>
        <b>{status}</b>
      </div>

      <div className="hero-agent-demo__chat">
        <article className="hero-agent-msg hero-agent-msg--user">
          <span>Вы</span>
          <p>Проверь задержку дизайна и подготовь план на следующую неделю.</p>
        </article>
        <article className="hero-agent-msg hero-agent-msg--agent">
          <span>Агент</span>
          <p>Нашел сдвиг макетов, перегруз frontend и зависимость демо. Собрал proposed project diff для ревью.</p>
        </article>
      </div>

      <div className="hero-agent-diff">
        <header>
          <span>proposed project diff</span>
          <b>Редизайн кабинета</b>
        </header>

        <div className="hero-agent-hunks">
          {hunks.map((hunk) => {
            const checked = selected.has(hunk.id);
            return (
              <label className={`hero-agent-hunk ${checked ? "is-selected" : ""}`} key={hunk.id}>
                <input type="checkbox" checked={checked} onChange={() => toggle(hunk.id)} />
                <span className="hero-agent-hunk__check" />
                <span className="hero-agent-hunk__body">
                  <small>{hunk.id} · {hunk.target}</small>
                  <b>{hunk.title}</b>
                  <em>{hunk.text}</em>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="hero-agent-demo__actions">
        <button className="l-btn l-btn--primary" type="button" onClick={() => setApplied(true)}>
          OK, применить выбранное
        </button>
        <button className="l-btn l-btn--ghost" type="button" onClick={() => setApplied(false)}>
          Редактировать diff
        </button>
      </div>

      <div className="hero-agent-audit">
        <span>audit preview</span>
        <b>{applied ? "Ирина применила выбранные hunks · запись создана" : "Применение ожидает ревью"}</b>
      </div>
    </div>
  );
}
