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
import { CAPSULES_BY_STEP, KIND_LABEL, type Capsule } from "../demo/capsules";
import { DemoStage } from "./demo/DemoStage";

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
  const capsules = CAPSULES_BY_STEP[state.step];
  const progress = useMemo(
    () => Math.round(((ORDER.indexOf(state.step) + 1) / ORDER.length) * 100),
    [state.step],
  );

  const onAdvance = useCallback(() => {
    setNotice(null);
    dispatch({ type: "next" });
  }, []);
  const onReset = useCallback(() => dispatch({ type: "reset" }), []);
  const onExplore = useCallback((message: string) => setNotice(message), []);

  return (
    <div className="sandbox">
      <aside className="sandbox__rail" aria-label="Шаги контура">
        <header className="sandbox__rail-head">
          <span className="sandbox__rail-eyebrow">Контур KISS PM</span>
          <p className="sandbox__rail-progress">
            <span>{progress}%</span> пройдено
          </p>
        </header>

        <ol className="sandbox__steps">
          {ORDER.map((step, idx) => {
            const m = STEP_META[step];
            const isActive = step === state.step;
            const isVisited = state.visited.includes(step);
            return (
              <li key={step}>
                <button
                  type="button"
                  className={`sandbox__step${isActive ? " is-active" : ""}${
                    isVisited ? " is-visited" : ""
                  }`}
                  onClick={() => {
                    setNotice(null);
                    dispatch({ type: "goto", step });
                  }}
                  aria-current={isActive ? "step" : undefined}
                >
                  <span className="sandbox__step-no">{String(idx + 1).padStart(2, "0")}</span>
                  <span className="sandbox__step-title">{m.title}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <button type="button" className="sandbox__reset" onClick={onReset}>
          Начать сначала
        </button>
      </aside>

      <section className="sandbox__stage" aria-live="polite">
        <DemoStage
          step={state.step}
          fixture={DEMO_FIXTURE}
          onAdvance={onAdvance}
          onExplore={onExplore}
        />

        {notice && (
          <div className="sandbox__notice" role="status">
            <span aria-hidden="true">↳</span>
            <p>{notice}</p>
          </div>
        )}

        <div className="sandbox__hint" role="status">
          <span className="sandbox__hint-dot" aria-hidden="true" />
          <span className="sandbox__hint-label">{meta.badge}</span>
          <span className="sandbox__hint-text">{meta.hint}</span>
          {state.step !== "audit" && (
            <button type="button" className="sandbox__hint-cta" onClick={onAdvance}>
              Следующий шаг →
            </button>
          )}
        </div>
      </section>

      <aside className="sandbox__narrator" aria-label="Что внутри">
        <header className="sandbox__narrator-head">
          <span className="l-eyebrow">Что поддерживает шаг</span>
          <h3 className="sandbox__narrator-title">
            Сейчас важно: <em>{meta.title}</em>
          </h3>
        </header>

        <div className="sandbox__narrator-list">
          {capsules.map((c) => (
            <CapsuleCard key={c.id} capsule={c} />
          ))}
        </div>

        <p className="sandbox__narrator-foot">
          Показываем только то, что помогает принять решение:
          <br />
          сигнал, контекст, сценарий, права и след.
        </p>
      </aside>

      <style>{styles}</style>
    </div>
  );
}

function CapsuleCard({ capsule }: { capsule: Capsule }) {
  return (
    <article className={`capsule capsule--${capsule.kind}`}>
      <header className="capsule__head">
        <span className="capsule__kind">{KIND_LABEL[capsule.kind]}</span>
      </header>
      <h4 className="capsule__title">{capsule.title}</h4>
      <p className="capsule__body">{capsule.body}</p>
    </article>
  );
}

const styles = `
.sandbox {
  display: grid;
  gap: 0;
  background: var(--panel);
  border: 0;
  border-radius: 0;
  overflow: hidden;
  box-shadow: none;
  grid-template-columns: 1fr;
  min-height: inherit;
  height: 100%;
}

@media (min-width: 980px) {
  .sandbox {
    grid-template-columns: 220px minmax(0, 1fr) 272px;
    min-height: inherit;
  }
}

.sandbox__rail {
  background: var(--panel-strong);
  border-bottom: 1px solid var(--border);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

@media (min-width: 980px) {
  .sandbox__rail {
    border-bottom: 0;
    border-right: 1px solid var(--border);
  }
}

.sandbox__rail-eyebrow {
  display: block;
  font-size: 11px;
  letter-spacing: var(--letter-eyebrow);
  text-transform: uppercase;
  color: var(--muted-strong);
  font-weight: 700;
  margin-bottom: 6px;
}

.sandbox__rail-progress {
  font-size: 13px;
  color: var(--muted-strong);
}

.sandbox__rail-progress span {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 28px;
  color: var(--text-strong);
  display: inline-block;
  margin-right: 6px;
}

.sandbox__steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
}

.sandbox__step {
  width: 100%;
  display: grid;
  grid-template-columns: 32px 1fr;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: transparent;
  border: 1px solid transparent;
  text-align: left;
  color: var(--muted-strong);
  transition:
    background var(--duration-ui) var(--ease-ui),
    color var(--duration-ui) var(--ease-ui),
    border-color var(--duration-ui) var(--ease-ui);
  font-size: 13px;
  cursor: pointer;
}

.sandbox__step:hover {
  background: var(--panel);
  color: var(--text-strong);
}

.sandbox__step.is-visited {
  color: var(--text);
}

.sandbox__step.is-active {
  background: var(--accent-soft);
  border-color: var(--accent-muted);
  color: var(--accent-hover);
  font-weight: 600;
}

.sandbox__step-no {
  font-family: var(--font-mono);
  font-size: 11px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 4px 0;
  text-align: center;
  font-weight: 600;
}

.sandbox__step.is-active .sandbox__step-no {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.sandbox__reset {
  margin-top: auto;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted-strong);
  border-radius: var(--radius-md);
  background: var(--panel);
  border: 1px solid var(--border);
  cursor: pointer;
  transition:
    color var(--duration-ui) var(--ease-ui),
    border-color var(--duration-ui) var(--ease-ui);
}

.sandbox__reset:hover {
  color: var(--text-strong);
  border-color: var(--border-strong);
}

.sandbox__stage {
  padding: clamp(16px, 2vw, 22px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--canvas-tint);
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.sandbox__notice {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 10px;
  align-items: start;
  padding: 10px 14px;
  background: var(--panel);
  color: var(--muted-strong);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 13px;
  line-height: 1.5;
  box-shadow: var(--shadow-sm);
}

.sandbox__notice span {
  color: var(--accent);
  font-weight: 700;
}

.sandbox__hint {
  display: grid;
  grid-template-columns: 8px max-content 1fr max-content;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #0f172a;
  color: #f1f5f9;
  border-radius: var(--radius-lg);
  box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.45);
}

.sandbox__hint-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.22);
  animation: pulse 1.8s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.75; }
}

.sandbox__hint-label {
  font-size: 11px;
  letter-spacing: var(--letter-eyebrow);
  text-transform: uppercase;
  color: #94a3b8;
  font-weight: 700;
}

.sandbox__hint-text {
  font-size: 14px;
  font-weight: 500;
}

.sandbox__hint-cta {
  background: #f1f5f9;
  color: #0f172a;
  padding: 6px 12px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 600;
  border: 0;
  cursor: pointer;
  transition: background var(--duration-ui) var(--ease-ui);
}

.sandbox__hint-cta:hover {
  background: #fff;
}

.sandbox__narrator {
  background: var(--panel);
  padding: 20px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

@media (min-width: 980px) {
  .sandbox__narrator {
    border-top: 0;
    border-left: 1px solid var(--border);
  }
}

.sandbox__narrator-head .l-eyebrow {
  margin-bottom: 6px;
}

.sandbox__narrator-title {
  font-family: var(--font-display);
  font-size: 16px;
  line-height: 1.3;
  font-weight: 700;
  color: var(--text-strong);
}

.sandbox__narrator-title em {
  font-style: normal;
  color: var(--accent);
}

.sandbox__narrator-list {
  display: grid;
  gap: 10px;
}

.sandbox__narrator-foot {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.5;
  border-top: 1px dashed var(--border);
  padding-top: 12px;
}

.capsule {
  position: relative;
  padding: 12px 14px;
  background: var(--panel-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  display: grid;
  gap: 6px;
  animation: capsule-in var(--duration-ui) var(--ease-out) both;
}

@keyframes capsule-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.capsule__head {
  display: flex;
  justify-content: space-between;
}

.capsule__kind {
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  background: var(--accent-soft);
  color: var(--accent-hover);
}

.capsule--rbac .capsule__kind { background: var(--violet-soft); color: #6d28d9; }
.capsule--audit .capsule__kind { background: var(--warning-soft); color: #b45309; }
.capsule--tenant .capsule__kind { background: var(--info-soft); color: #0369a1; }
.capsule--comms .capsule__kind { background: #fef3f2; color: #b91c1c; }
.capsule--calls .capsule__kind { background: #fef3f2; color: #b91c1c; }
.capsule--video .capsule__kind { background: var(--success-soft); color: #047857; }
.capsule--notify .capsule__kind { background: #fff7ed; color: #c2410c; }
.capsule--kpi .capsule__kind { background: var(--accent-soft); color: var(--accent-hover); }
.capsule--ai .capsule__kind { background: #f5f3ff; color: #6d28d9; }

.capsule__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-strong);
  margin: 0;
}

.capsule__body {
  font-size: 12px;
  color: var(--muted-strong);
  line-height: 1.5;
}
`;
