import { useCallback, useMemo, useReducer, useState } from "react";
import type { LandingLocale } from "../lib/landing-i18n";
import { DEMO_FIXTURE_BY_LOCALE } from "../demo/fixture";
import { DEMO_SANDBOX_COPY } from "../demo/sandbox-copy";
import {
  ORDER,
  STEP_META_BY_LOCALE,
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

export default function DemoSandbox({ locale = "ru" }: { locale?: LandingLocale }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [notice, setNotice] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const copy = DEMO_SANDBOX_COPY[locale];
  const fixture = DEMO_FIXTURE_BY_LOCALE[locale];
  const metaByStep = STEP_META_BY_LOCALE[locale];
  const meta = metaByStep[state.step];
  const currentIdx = ORDER.indexOf(state.step);
  const progress = useMemo(
    () => Math.round(((currentIdx + 1) / ORDER.length) * 100),
    [currentIdx],
  );

  const onAdvance = useCallback(() => {
    setNotice(null);
    dispatch({ type: "next" });
  }, []);
  const onReset = useCallback(() => {
    setNotice(null);
    dispatch({ type: "reset" });
  }, []);
  const onExplore = useCallback((message: string) => setNotice(message), []);

  const goToStep = useCallback((step: DemoStep) => {
    setNotice(null);
    dispatch({ type: "goto", step });
  }, []);

  const onNavClick = useCallback(
    (item: { label: string; steps: ReadonlyArray<DemoStep> }) => {
      const unlocked = item.steps.filter(
        (s) => ORDER.indexOf(s) <= currentIdx || state.visited.includes(s),
      );
      if (unlocked.length > 0) {
        goToStep(unlocked[unlocked.length - 1]!);
        return;
      }
      const firstIdx = Math.min(...item.steps.map((s) => ORDER.indexOf(s)));
      setNotice(copy.lockedNotice(item.label, firstIdx + 1));
    },
    [copy, currentIdx, state.visited, goToStep],
  );

  const dockPrimary = copy.dockPrimary[state.step];
  const dockEmphasis = state.step !== "audit";

  return (
    <div className="sandbox" data-demo-step={state.step}>
      <aside className="sandbox__rail" aria-label={copy.navLabel}>
        <button
          type="button"
          className="sandbox__burger"
          aria-label={navOpen ? copy.closeMenu : copy.openMenu}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((value) => !value)}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path
              d="M2 4h12M2 8h12M2 12h12"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className="sandbox__brand">
          <span className="sandbox__brand-mark" aria-hidden="true">
            K
          </span>
          KISS PM
        </div>

        {navOpen ? (
          <button
            type="button"
            className="sandbox__nav-backdrop"
            aria-label={copy.closeBackdrop}
            onClick={() => setNavOpen(false)}
          />
        ) : null}

        <nav className={`sandbox__nav${navOpen ? " is-open" : ""}`}>
          {copy.navSections.map((section) => (
            <div key={section.label} className="sandbox__nav-section">
              <p className="sandbox__nav-label">{section.label}</p>
              {section.items.map((item) => {
                const isActive = item.steps.includes(state.step);
                const isUnlocked = item.steps.some(
                  (s) => ORDER.indexOf(s) <= currentIdx || state.visited.includes(s),
                );
                return (
                  <button
                    key={item.label}
                    type="button"
                    className={`sandbox__nav-item${isActive ? " is-active" : ""}${
                      isUnlocked ? "" : " is-upcoming"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => {
                      setNavOpen(false);
                      onNavClick(item);
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sandbox__rail-foot">
          <p className="sandbox__portfolio-chip">
            <span className="sandbox__portfolio-dot" aria-hidden="true" />
            {copy.portfolioChip}
          </p>
          <button type="button" className="sandbox__reset" onClick={onReset}>
            {copy.reset}
          </button>
        </div>
      </aside>

      <div className="sandbox__main">
        <div className="sandbox__topbar">
          <button type="button" className="sandbox__search" onClick={() => onExplore(copy.searchNotice)}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>{copy.search}</span>
          </button>
          <span className="sandbox__avatar" aria-hidden="true">
            {copy.avatar}
          </span>
        </div>

        <section className="sandbox__stage" aria-live="polite">
          <DemoStage
            step={state.step}
            fixture={fixture}
            locale={locale}
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
            <button type="button" className="sandbox__dock-secondary" onClick={() => onExplore(copy.draftNotice)}>
              {copy.draft}
            </button>
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

      <div className="sandbox__side">
        <div className="sandbox__scenario" aria-label={copy.scenarioLabel}>
          <div className="sandbox__scenario-head">
            <span className="sandbox__rail-eyebrow">{copy.scenarioTitle}</span>
            <p className="sandbox__rail-progress">
              <span>{progress}%</span> {copy.progressDone}
            </p>
            <div className="sandbox__progress-bar" aria-hidden="true">
              <span className="sandbox__progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <ol className="sandbox__scenario-steps">
            {ORDER.map((step, idx) => {
              const m = metaByStep[step];
              const isActive = step === state.step;
              const isLocked = idx > currentIdx && !state.visited.includes(step);
              const isComplete = !isActive && state.visited.includes(step);

              return (
                <li key={step}>
                  <button
                    type="button"
                    className={`sandbox__scenario-step${isActive ? " is-active" : ""}${
                      isLocked ? " is-locked" : ""
                    }${isComplete ? " is-complete" : ""}`}
                    onClick={() => {
                      if (!isLocked) goToStep(step);
                    }}
                    aria-current={isActive ? "step" : undefined}
                    disabled={isLocked}
                  >
                    <span className="sandbox__scenario-marker" aria-hidden="true">
                      {isComplete ? "✓" : idx + 1}
                    </span>
                    <span className="sandbox__scenario-title">{m.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <DemoContextPanel step={state.step} fixture={fixture} locale={locale} onExplore={onExplore} />
      </div>
    </div>
  );
}