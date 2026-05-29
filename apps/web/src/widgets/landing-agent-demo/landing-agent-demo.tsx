"use client";

import { useEffect, useMemo, useState } from "react";

import {
  AgentChatPanel,
  AgentConversationList,
  AgentWorkspaceFrame,
  ChangeReviewPanel,
  CollapsedAppNav,
  MobileDrawerBackdrop
} from "./components";
import { cn } from "@/lib/cn";
import {
  createAppliedMessage,
  createLandingAgentDemoState,
  SECOND_ANSWER_MESSAGE,
  SECOND_PROMPT
} from "./scenario";
import type { LandingAgentDemoPreset, LandingAgentDemoState } from "./types";

export type LandingAgentDemoProps = {
  preset?: LandingAgentDemoPreset;
  mobile?: boolean;
};

export function LandingAgentDemo({ preset = "initial", mobile = false }: LandingAgentDemoProps) {
  const initialState = useMemo(() => createLandingAgentDemoState(preset), [preset]);
  const [state, setState] = useState<LandingAgentDemoState>(initialState);
  const reviewPanelVisible =
    state.reviewVisible &&
    (state.phase === "review-opening" || state.phase === "review-open" || state.phase === "applied");

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

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
        messages: [
          ...current.messages,
          {
            id: "henry-live",
            author: "henry",
            time: "10:42",
            text: "Проверил. Сдвиг затронул две работы и встречу с клиентом. Подготовил Сверку из 5 изменений."
          }
        ]
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
        phase: "applied",
        messages: current.messages.some((message) => message.id === SECOND_ANSWER_MESSAGE.id)
          ? current.messages
          : [...current.messages, SECOND_ANSWER_MESSAGE]
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
            text
          }
        ]
      }));
      return;
    }

    setState((current) => ({
      ...current,
      phase: "thinking",
      inputValue: "",
      visibleSteps: 0,
      messages:
        current.messages.length > 0
          ? [
              ...current.messages,
              {
                id: `user-live-${current.messages.length + 1}`,
                author: "user",
                time: "10:41",
                text
              }
            ]
          : [
              {
                id: "user-live",
                author: "user",
                time: "10:41",
                text
              }
            ]
    }));
  }

  function applySelected() {
    setState((current) => {
      const appliedCount = current.changes.filter((change) => change.selected).length;

      return {
        ...current,
        phase: "applied",
        inputValue: SECOND_PROMPT,
        reviewVisible: true,
        messages: current.messages.some((message) => message.id === "henry-applied")
          ? current.messages
          : [...current.messages, createAppliedMessage(appliedCount, "henry-applied")],
        changes: current.changes.map((change) =>
          change.selected ? { ...change, status: "применено" } : change
        )
      };
    });
  }

  function resetDemo() {
    setState(createLandingAgentDemoState("reset-demo"));
  }

  return (
    <AgentWorkspaceFrame mobile={mobile}>
      <div
        className={cn(
          "lad-layout",
          state.navExpanded && "lad-layout--nav-expanded",
          reviewPanelVisible && "lad-layout--review-open"
        )}
      >
        <CollapsedAppNav
          expanded={state.navExpanded}
          mobileOpen={state.mobileLeftDrawer}
          onToggle={() => setState((current) => ({ ...current, navExpanded: !current.navExpanded }))}
        />
        <MobileDrawerBackdrop
          visible={state.mobileLeftDrawer || state.mobileReviewDrawer}
          onClick={() =>
            setState((current) => ({
              ...current,
              mobileLeftDrawer: false,
              mobileReviewDrawer: false
            }))
          }
        />
        <AgentConversationList />
        <AgentChatPanel
          messages={state.messages}
          inputValue={state.inputValue}
          visibleSteps={state.visibleSteps}
          phase={state.phase}
          agentMenuOpen={state.agentMenuOpen}
          reviewVisible={reviewPanelVisible}
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
              mobileReviewDrawer: reviewPanelVisible,
              mobileLeftDrawer: false
            }))
          }
        />
        <ChangeReviewPanel
          changes={state.changes}
          visible={reviewPanelVisible}
          opening={state.phase === "review-opening"}
          applied={state.phase === "applied" || state.changes.some((change) => change.status === "применено")}
          activeChangeId={state.activeChangeId}
          editingChangeId={state.editingChangeId}
          mobileOpen={reviewPanelVisible && state.mobileReviewDrawer}
          onCloseMobile={() => setState((current) => ({ ...current, mobileReviewDrawer: false }))}
          onFocusChange={(id) => setState((current) => ({ ...current, activeChangeId: id }))}
          onSelectChange={(id) =>
            setState((current) => ({
              ...current,
              activeChangeId: id,
              changes: current.changes.map((change) =>
                change.id === id
                  ? change.status === "требует прав"
                    ? { ...change, selected: false }
                    : {
                        ...change,
                        selected: !change.selected,
                        status: change.selected ? "отклонено" : "выбрано"
                      }
                  : change
              )
            }))
          }
          onRejectChange={(id) =>
            setState((current) => ({
              ...current,
              activeChangeId: id,
              changes: current.changes.map((change) =>
                change.id === id ? { ...change, selected: false, status: "отклонено" } : change
              )
            }))
          }
          onEditChange={(id) =>
            setState((current) => ({ ...current, activeChangeId: id, editingChangeId: id }))
          }
          onUpdateChange={(id, value) =>
            setState((current) => ({
              ...current,
              changes: current.changes.map((change) =>
                change.id === id
                  ? change.status === "требует прав"
                    ? { ...change, after: value, selected: false }
                    : { ...change, after: value, status: "изменено", selected: true }
                  : change
              )
            }))
          }
          onApply={applySelected}
          onReset={resetDemo}
        />
      </div>
    </AgentWorkspaceFrame>
  );
}
