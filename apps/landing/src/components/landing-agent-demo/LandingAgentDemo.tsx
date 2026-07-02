import { useEffect, useMemo, useRef, useState } from "react";

import {
  AgentChatPanel,
  AgentConversationList,
  AgentWorkspaceFrame,
  ChangeReviewPanel,
  CollapsedAppNav,
  MobileDrawerBackdrop,
} from "./components";
import { createLandingAgentDemoState, SECOND_ANSWER_MESSAGE, SECOND_PROMPT } from "./scenario";
import type { LandingAgentDemoPreset, LandingAgentDemoState } from "./types";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export type LandingAgentDemoProps = {
  preset?: LandingAgentDemoPreset;
  mobile?: boolean;
};

export function LandingAgentDemo({ preset = "initial", mobile = false }: LandingAgentDemoProps) {
  const initialState = useMemo(() => createLandingAgentDemoState(preset), [preset]);
  const [state, setState] = useState<LandingAgentDemoState>(initialState);
  const [note, setNote] = useState<string | null>(null);
  const [filterSelected, setFilterSelected] = useState(false);
  const noteTimer = useRef<number | undefined>(undefined);

  const showNote = (text: string) => {
    setNote(text);
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 4500);
  };

  useEffect(() => {
    return () => {
      if (noteTimer.current) window.clearTimeout(noteTimer.current);
    };
  }, []);
  const reviewPending =
    state.reviewVisible &&
    (state.phase === "review-opening" ||
      state.phase === "review-open" ||
      state.phase === "applying" ||
      state.phase === "applied");

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  const hostRef = useRef<HTMLDivElement | null>(null);

  // Автозапуск сценария, когда демо видно: пустой чат не встречает посетителя.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let startTimer: number | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        startTimer = window.setTimeout(() => {
          setState((current) => {
            if (current.phase !== "draft" || current.messages.length > 0) return current;
            const text = current.inputValue.trim();
            if (!text) return current;
            return {
              ...current,
              phase: "thinking",
              inputValue: "",
              visibleSteps: 0,
              messages: [{ id: "user-live-1", author: "user", time: "10:41", text }],
            };
          });
        }, 700);
      },
      { threshold: 0.55 }
    );
    io.observe(host);

    return () => {
      io.disconnect();
      if (startTimer) window.clearTimeout(startTimer);
    };
  }, []);

  useEffect(() => {
    if (state.phase !== "thinking") {
      return;
    }

    const stepTimers = [1, 2, 3, 4, 5].map((step) =>
      window.setTimeout(() => {
        setState((current) => ({ ...current, visibleSteps: step }));
      }, step * 360)
    );
    const answerTimer = window.setTimeout(() => {
      setState((current) => ({
        ...current,
        phase: "review-opening",
        reviewVisible: true,
        messages: current.messages.some((message) => message.id === "henry-live")
          ? current.messages
          : [
              ...current.messages,
              {
                id: "henry-live",
                author: "henry",
                time: "10:42",
                text: "Проверил. Задержка затронула две задачи и клиентскую демонстрацию. Подготовил сверку из 5 изменений.",
              },
            ],
      }));
    }, 2300);
    const openTimer = window.setTimeout(() => {
      setState((current) => ({ ...current, phase: "review-open" }));
    }, 2650);

    return () => {
      stepTimers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(answerTimer);
      window.clearTimeout(openTimer);
    };
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "second-thinking") {
      return;
    }

    const timers = [1, 2, 3, 4, 5].map((step) =>
      window.setTimeout(() => {
        setState((current) => ({ ...current, visibleSteps: step }));
      }, step * 320)
    );
    const answerTimer = window.setTimeout(() => {
      setState((current) => ({
        ...current,
        messages: current.messages.some((message) => message.id === SECOND_ANSWER_MESSAGE.id)
          ? current.messages
          : [...current.messages, SECOND_ANSWER_MESSAGE],
      }));
    }, 2050);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(answerTimer);
    };
  }, [state.phase]);

  function sendMessage() {
    const text = state.inputValue.trim();
    if (!text) {
      return;
    }

    if (state.reviewVisible || state.phase === "applied" || state.phase === "second-thinking") {
      setState((current) => ({
        ...current,
        phase: "second-thinking",
        inputValue: "",
        visibleSteps: 0,
        messages: [
          ...current.messages,
          {
            id: "user-second-live",
            author: "user",
            time: "10:45",
            text,
          },
        ],
      }));
      return;
    }

    setState((current) => ({
      ...current,
      phase: "thinking",
      inputValue: "",
      visibleSteps: 0,
      messages: [
        ...current.messages,
        {
          id: `user-live-${current.messages.length + 1}`,
          author: "user",
          time: "10:41",
          text,
        },
      ],
    }));
  }

  function applySelected() {
    setState((current) => ({ ...current, phase: "applying" }));
    window.setTimeout(() => {
      setState((current) => ({
        ...current,
        phase: "applied",
        inputValue: SECOND_PROMPT,
        reviewVisible: true,
        mobileReviewDrawer: false,
        messages: current.messages.some((message) => message.id === "henry-applied")
          ? current.messages
          : [
              ...current.messages,
              {
                id: "henry-applied",
                author: "henry",
                time: "10:44",
                text: "Готово. Применил 4 изменения и оставил запись в журнале. Одно изменение осталось отклоненным.",
              },
            ],
        changes: current.changes.map((change) =>
          change.selected ? { ...change, status: "применено" } : change
        ),
      }));
    }, 650);
  }

  function resetDemo() {
    setState(createLandingAgentDemoState("reset-demo"));
  }

  return (
    <AgentWorkspaceFrame mobile={mobile}>
      <div
        ref={hostRef}
        className={cx(
          "lad-layout",
          state.navExpanded && "lad-layout--nav-expanded",
          reviewPending && "lad-layout--review-open"
        )}
      >
        <CollapsedAppNav
          expanded={state.navExpanded}
          mobileOpen={state.mobileLeftDrawer}
          onToggle={() => setState((current) => ({ ...current, navExpanded: !current.navExpanded }))}
          onNote={showNote}
        />
        <MobileDrawerBackdrop
          visible={state.mobileLeftDrawer || state.mobileReviewDrawer}
          onClick={() =>
            setState((current) => ({
              ...current,
              mobileLeftDrawer: false,
              mobileReviewDrawer: false,
            }))
          }
        />
        <AgentConversationList onNote={showNote} />
        <AgentChatPanel
          messages={state.messages}
          inputValue={state.inputValue}
          visibleSteps={state.visibleSteps}
          phase={state.phase}
          agentMenuOpen={state.agentMenuOpen}
          reviewVisible={reviewPending}
          note={note}
          onNote={showNote}
          onInputChange={(value) => setState((current) => ({ ...current, inputValue: value }))}
          onSend={sendMessage}
          onToggleAgentMenu={() =>
            setState((current) => ({ ...current, agentMenuOpen: !current.agentMenuOpen }))
          }
          onOpenMobileLeft={() =>
            setState((current) => ({ ...current, mobileLeftDrawer: true, mobileReviewDrawer: false }))
          }
          onOpenMobileReview={() =>
            setState((current) => ({
              ...current,
              mobileReviewDrawer: reviewPending,
              mobileLeftDrawer: false,
            }))
          }
        />
        <ChangeReviewPanel
          changes={state.changes}
          filterSelected={filterSelected}
          onToggleFilter={() => setFilterSelected((value) => !value)}
          visible={reviewPending}
          opening={state.phase === "review-opening"}
          applying={state.phase === "applying"}
          applied={state.phase === "applied" || state.changes.some((change) => change.status === "применено")}
          activeChangeId={state.activeChangeId}
          editingChangeId={state.editingChangeId}
          mobileOpen={reviewPending && state.mobileReviewDrawer}
          onCloseMobile={() => setState((current) => ({ ...current, mobileReviewDrawer: false }))}
          onSelectChange={(id) =>
            setState((current) => ({
              ...current,
              activeChangeId: id,
              changes: current.changes.map((change) =>
                change.id === id
                  ? {
                      ...change,
                      selected: !change.selected,
                      status: change.selected ? "отклонено" : "выбрано",
                    }
                  : change
              ),
            }))
          }
          onFocusChange={(id) => setState((current) => ({ ...current, activeChangeId: id }))}
          onRejectChange={(id) =>
            setState((current) => ({
              ...current,
              activeChangeId: id,
              changes: current.changes.map((change) =>
                change.id === id ? { ...change, selected: false, status: "отклонено" } : change
              ),
            }))
          }
          onEditChange={(id) =>
            setState((current) => ({ ...current, activeChangeId: id, editingChangeId: id }))
          }
          onUpdateChange={(id, value) =>
            setState((current) => ({
              ...current,
              changes: current.changes.map((change) =>
                change.id === id ? { ...change, after: value, status: "изменено", selected: true } : change
              ),
            }))
          }
          onApply={applySelected}
          onReset={resetDemo}
        />
      </div>
    </AgentWorkspaceFrame>
  );
}

export default LandingAgentDemo;
