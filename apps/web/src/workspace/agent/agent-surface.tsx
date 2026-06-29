"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";
import {
  AgentChatPanel,
  AgentConversationList,
  AgentWorkspaceFrame,
  ChangeReviewPanel,
  CollapsedAppNav,
  MobileDrawerBackdrop
} from "@/widgets/landing-agent-demo/components";
import type { DemoChange, DemoMessage, DemoPhase } from "@/widgets/landing-agent-demo/types";
import { useAgent } from "@/workspace/agent/use-agent";
import type { AgentActionInput, ProposedAction } from "@/workspace/agent/agent-client";

// Человекочитаемое имя статуса (mock: status-*, боевой: task-status-*).
const STATUS_NAME: Record<string, string> = {
  new: "Новая", waiting: "Ожидание", "in-progress": "В работе", inprogress: "В работе", review: "На проверке", done: "Готово"
};
const humanizeStatus = (id: string): string => {
  const key = id.replace(/^(task-)?status-/, "");
  return STATUS_NAME[key] ?? key.replace(/-/g, " ");
};

const summarize = (input: Record<string, unknown>): string =>
  Object.entries(input)
    .filter(([, v]) => typeof v === "string" || typeof v === "number")
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(" · ");

const KIND_BY_TOOL: Record<string, DemoChange["kind"]> = {
  change_task_status: "status",
  update_task: "text",
  comment_task: "text",
  create_task: "text",
  apply_resource_resolution: "date",
  apply_plan_commands: "date"
};

function actionToChange(action: ProposedAction, index: number): DemoChange {
  const allowed = action.capability.allowed;
  const kind = KIND_BY_TOOL[action.tool] ?? "text";
  let before = "—";
  let after = summarize(action.input);
  if (action.tool === "change_task_status") {
    before = "текущий статус";
    after = humanizeStatus(String(action.input.statusId ?? ""));
  }
  return {
    id: `chg-${index}`,
    number: index + 1,
    title: action.title,
    before,
    after,
    status: allowed ? "выбрано" : "требует прав",
    selected: allowed,
    kind
  };
}

const clock = (offsetMs: number): string => new Date(offsetMs).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

/**
 * Агент — полноценный чат с AI-ассистентом, действующим в рамках прав сотрудника.
 * Дизайн — SSOT `LandingAgentDemo` (чат-тред + панель сверки изменений), но на БОЕВОМ
 * контракте: сообщение → POST /agent/propose (LLM-цикл, ничего не меняется) → изменения в
 * панели сверки → подтверждение → POST /agent/execute (governed-команды + audit).
 * live → реальный LLM (ключ на сервере); mock/Storybook → детерминированный демо-«мозг».
 */
export function AgentSurface() {
  const { propose, execute, status } = useAgent();

  const [phase, setPhase] = useState<DemoPhase>("draft");
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [changes, setChanges] = useState<DemoChange[]>([]);
  const [activeChangeId, setActiveChangeId] = useState("");
  const [editingChangeId, setEditingChangeId] = useState<string | undefined>(undefined);
  const [actionMap, setActionMap] = useState<Record<string, AgentActionInput>>({});
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [navExpanded, setNavExpanded] = useState(false);
  const [mobileLeft, setMobileLeft] = useState(false);
  const [mobileReview, setMobileReview] = useState(false);
  const [seq, setSeq] = useState(0);

  const reviewVisible = changes.length > 0 && phase !== "draft" && phase !== "thinking";
  const now = () => { const t = 10 * 3600_000 + 41 * 60_000 + seq * 60_000; setSeq((s) => s + 1); return clock(t); };

  const addMessage = (author: "user" | "henry", text: string) =>
    setMessages((m) => [...m, { id: `${author}-${m.length}`, author, time: now(), text }]);

  async function sendMessage() {
    const goal = inputValue.trim();
    if (goal.length === 0) return;
    addMessage("user", goal);
    setInputValue("");
    setPhase("thinking");
    const res = await propose(goal);
    if (!res.ok) {
      addMessage("henry", `Не удалось обработать запрос: ${res.code}`);
      setPhase("draft");
      return;
    }
    const data = res.data;
    const newChanges = data.proposedActions.map(actionToChange);
    const map: Record<string, AgentActionInput> = {};
    data.proposedActions.forEach((action, i) => { map[`chg-${i}`] = { tool: action.tool, input: action.input }; });
    setActionMap(map);
    setChanges(newChanges);
    setActiveChangeId(newChanges[0]?.id ?? "");
    addMessage("henry", data.reasoning || (newChanges.length ? "Подготовил предложение — проверьте сверку справа." : "Безопасных действий не нашёл."));
    setPhase(newChanges.length ? "review-open" : "applied");
  }

  async function applySelected() {
    const selected = changes.filter((c) => c.selected && c.status !== "отклонено" && c.status !== "требует прав" && c.status !== "применено");
    const actions = selected.map((c) => actionMap[c.id]).filter((a): a is AgentActionInput => Boolean(a));
    if (actions.length === 0) return;
    const res = await execute(actions);
    if (res.ok && res.data.applied) {
      const okCount = res.data.results.filter((r) => r.ok).length;
      setChanges((cs) => cs.map((c) => (selected.includes(c) ? { ...c, status: "применено" } : c)));
      setPhase("applied");
      addMessage("henry", `Применил ${okCount} изменени${okCount === 1 ? "е" : "я"}. Готово — данные обновлены.`);
    } else {
      const failure = res.ok ? res.data.results.find((r) => !r.ok)?.error ?? "не применено" : res.code;
      addMessage("henry", `Не удалось применить: ${failure}.`);
    }
  }

  function resetDemo() {
    setMessages([]);
    setChanges([]);
    setActionMap({});
    setActiveChangeId("");
    setEditingChangeId(undefined);
    setPhase("draft");
    setSeq(0);
  }

  return (
    <AgentWorkspaceFrame>
      <div className={cn("lad-layout", navExpanded && "lad-layout--nav-expanded", reviewVisible && "lad-layout--review-open")}>
        <CollapsedAppNav expanded={navExpanded} mobileOpen={mobileLeft} onToggle={() => setNavExpanded((v) => !v)} />
        <MobileDrawerBackdrop visible={mobileLeft || mobileReview} onClick={() => { setMobileLeft(false); setMobileReview(false); }} />
        <AgentConversationList />
        <AgentChatPanel
          messages={messages}
          inputValue={inputValue}
          visibleSteps={3}
          phase={status === "proposing" ? "thinking" : phase}
          agentMenuOpen={agentMenuOpen}
          reviewVisible={reviewVisible}
          onInputChange={setInputValue}
          onSend={() => void sendMessage()}
          onToggleAgentMenu={() => setAgentMenuOpen((v) => !v)}
          onOpenMobileLeft={() => { setMobileLeft(true); setMobileReview(false); }}
          onOpenMobileReview={() => { setMobileReview(reviewVisible); setMobileLeft(false); }}
        />
        <ChangeReviewPanel
          changes={changes}
          visible={reviewVisible}
          opening={phase === "review-opening"}
          applied={phase === "applied" || changes.some((c) => c.status === "применено")}
          activeChangeId={activeChangeId}
          editingChangeId={editingChangeId}
          mobileOpen={reviewVisible && mobileReview}
          onCloseMobile={() => setMobileReview(false)}
          onSelectChange={(id) =>
            setChanges((cs) => cs.map((c) => (c.id === id && c.status !== "требует прав" && c.status !== "применено"
              ? { ...c, selected: !c.selected, status: c.selected ? "отклонено" : "выбрано" }
              : c)))
          }
          onFocusChange={setActiveChangeId}
          onRejectChange={(id) =>
            setChanges((cs) => cs.map((c) => (c.id === id ? { ...c, selected: false, status: "отклонено" } : c)))
          }
          onEditChange={(id) => { setActiveChangeId(id); setEditingChangeId(id); }}
          onUpdateChange={(id, value) =>
            setChanges((cs) => cs.map((c) => (c.id === id ? { ...c, after: value, status: "изменено", selected: true } : c)))
          }
          onApply={() => void applySelected()}
          onReset={resetDemo}
        />
      </div>
    </AgentWorkspaceFrame>
  );
}
