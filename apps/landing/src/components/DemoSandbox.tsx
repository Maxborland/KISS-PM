import { useCallback, useMemo, useReducer, useState } from "react";
import { DEMO_FIXTURE } from "../demo/fixture";
import {
  ORDER,
  STEP_META,
  type DemoState,
  type DemoStep,
  goTo,
  initialState,
  next,
  reset,
} from "../demo/machine";
import { DemoStage } from "./demo/DemoStage";
import { DemoContextPanel } from "./demo/DemoContextPanel";

type Action =
  | { type: "next" }
  | { type: "goto"; step: DemoStep }
  | { type: "reset" };

function reducer(state: DemoState, action: Action): DemoState {
  switch (action.type) {
    case "next":
      return next(state);
    case "goto":
      return goTo(state, action.step);
    case "reset":
      return reset();
  }
}

export default function DemoSandbox() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [notice, setNotice] = useState<string | null>(null);
  const meta = STEP_META[state.step];
  const currentIdx = ORDER.indexOf(state.step);
  const progress = useMemo(
    () => Math.round(((currentIdx + 1) / ORDER.length) * 100),
    [currentIdx],
  );

  const onAdvance = useCallback(() => {
    setNotice(null);
    dispatch({ type: "next" });
  }, []);
  const onReset = useCallback(() => dispatch({ type: "reset" }), []);
  const onExplore = useCallback((message: string) => setNotice(message), []);

  const dockPrimaryLabel: Partial<Record<DemoStep, string>> = {
    "crm-list": "Открыть DEAL-204 →",
    "crm-deal": "Проверить ёмкость →",
    intake: "К задаче T-1041 →",
    project: "Открыть задачу →",
    task: "Открыть сигнал →",
    signal: "Перейти к действию →",
    action: "Подтвердить и записать →",
  };
  const dockPrimary = dockPrimaryLabel[state.step];
  const dockEmphasis = state.step !== "audit";

  return (
    <div className="sandbox" data-demo-step={state.step}>
      <aside className="sandbox__rail" aria-label="Сценарий и шаги">
        <div className="sandbox__brand">KISS PM</div>

        <header className="sandbox__rail-head">
          <span className="sandbox__rail-eyebrow">Сценарий · портфель</span>
          <div className="sandbox__progress-row">
            <p className="sandbox__rail-progress">
              <span>{progress}%</span> пройдено
            </p>
            <div className="sandbox__progress-bar" aria-hidden="true">
              <span className="sandbox__progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <p className="sandbox__portfolio-chip">
            <span className="sandbox__portfolio-dot" aria-hidden="true" />
            147 проектов в работе
          </p>
        </header>

        <ol className="sandbox__steps">
          {ORDER.map((step, idx) => {
            const m = STEP_META[step];
            const isActive = step === state.step;
            const isVisited = state.visited.includes(step);
            const isLocked = idx > currentIdx;
            const isComplete = isVisited && !isActive && idx < currentIdx;

            return (
              <li key={step}>
                <button
                  type="button"
                  className={`sandbox__step${isActive ? " is-active" : ""}${
                    isVisited ? " is-visited" : ""
                  }${isLocked ? " is-locked" : ""}${isComplete ? " is-complete" : ""}`}
                  onClick={() => {
                    if (isLocked) {
                      return;
                    }
                    setNotice(null);
                    dispatch({ type: "goto", step });
                  }}
                  aria-current={isActive ? "step" : undefined}
                  aria-disabled={isLocked ? true : undefined}
                  disabled={isLocked}
                >
                  <span className="sandbox__step-marker" aria-hidden="true">
                    {isComplete ? "✓" : String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="sandbox__step-text">
                    <span className="sandbox__step-title">{m.title}</span>
                    {isActive && step === "crm-deal" ? (
                      <span className="sandbox__step-sub">
                        ГК Север · ₽ 8.4 млн · Текущий шаг
                      </span>
                    ) : null}
                    {isLocked && idx === currentIdx + 1 ? (
                      <span className="sandbox__step-sub sandbox__step-sub--muted">
                        {m.hint}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <button type="button" className="sandbox__reset" onClick={onReset}>
          ↺ Начать сначала
        </button>
      </aside>

      <div className="sandbox__main">
        <section className="sandbox__stage" aria-live="polite">
          <DemoStage
            step={state.step}
            fixture={DEMO_FIXTURE}
            onAdvance={onAdvance}
            onExplore={onExplore}
          />

          {notice ? (
            <div className="sandbox__notice" role="status">
              <span aria-hidden="true">↳</span>
              <p>{notice}</p>
            </div>
          ) : null}
        </section>

        <footer className="sandbox__dock">
          <div className="sandbox__dock-copy">
            <span className="sandbox__dock-badge">{meta.badge}</span>
            <p className="sandbox__dock-hint">{meta.hint}</p>
          </div>
          <div className="sandbox__dock-actions">
            <div className="sandbox__dock-disabled-action">
              <button
                type="button"
                className="sandbox__dock-secondary"
                disabled
                aria-describedby="sandbox-save-disabled-reason"
              >
                Сохранить и выйти
              </button>
              <span id="sandbox-save-disabled-reason" className="sandbox__dock-action-note">
                Доступно после входа в рабочий продукт
              </span>
            </div>
            {dockPrimary ? (
              <button
                type="button"
                className={`sandbox__dock-primary${dockEmphasis ? " sandbox__dock-primary--emphasis" : ""}`}
                onClick={onAdvance}
              >
                {dockPrimary}
              </button>
            ) : null}
          </div>
        </footer>
      </div>

      <DemoContextPanel step={state.step} fixture={DEMO_FIXTURE} onExplore={onExplore} />
    </div>
  );
}
