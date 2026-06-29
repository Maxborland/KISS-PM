"use client";

import { useEffect, useRef, useState } from "react";

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
  } else if (action.tool === "apply_resource_resolution") {
    before = "ресурсная перегрузка";
    after = "план разрешения";
  } else if (action.tool === "apply_plan_commands") {
    before = "текущий план";
    const count = Array.isArray(action.input.commands) ? action.input.commands.length : 0;
    after = `${count} изменени${count === 1 ? "е" : "я"} плана`;
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
  const { proposeStream, execute, uploadAttachment, listProjects, status } = useAgent();

  const [phase, setPhase] = useState<DemoPhase>("draft");
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [liveSteps, setLiveSteps] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string }>>([]);
  const [anchorId, setAnchorId] = useState("");
  const [projects, setProjects] = useState<Array<{ id: string; label: string }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);
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

  // Проекты-якоря для вложений грузим один раз.
  useEffect(() => {
    let active = true;
    void listProjects().then((list) => { if (active) setProjects(list); });
    return () => { active = false; };
  }, [listProjects]);

  function openFilePicker() {
    if (!anchorId) { addMessage("henry", "Сначала выберите проект, к которому привязать файл."); return; }
    fileRef.current?.click();
  }

  async function onFilePicked(file: File) {
    const res = await uploadAttachment(file, "project", anchorId);
    if (res.ok) { setAttachments((list) => [...list, res.data]); return; }
    // Загрузка вложений требует прав на управление проектом (canManageProjects); для
    // read-only/участника якорь недоступен — честно сообщаем, а не молча роняем.
    const denied = res.code === "permission_missing" || res.code === "cross_tenant_denied" || res.code === "forbidden";
    addMessage("henry", denied
      ? "Нет прав на добавление файла в этот проект — выберите проект, которым вы управляете."
      : `Не удалось загрузить файл: ${res.code}.`);
  }

  async function sendMessage() {
    const goal = inputValue.trim();
    if (goal.length === 0) return;
    addMessage("user", goal);
    setInputValue("");
    setPhase("thinking");
    setLiveSteps([]);
    const attachmentIds = attachments.map((file) => file.id);
    // Живой CoT-трейс по SSE: показываем реальные шаги (анализ/рассуждение/предложение) по мере работы.
    const res = await proposeStream(goal, (event) => {
      const label =
        event.type === "analyze" ? `Анализ: ${event.title}${event.ok ? "" : " (ошибка)"}`
        : event.type === "proposal" ? `Предложение: ${event.title}`
        : event.text.length > 80 ? `${event.text.slice(0, 80)}…` : event.text;
      setLiveSteps((steps) => [...steps, label]);
    }, attachmentIds);
    setAttachments([]);
    if (!res.ok) {
      addMessage("henry", `Не удалось обработать запрос: ${res.code}`);
      setPhase("draft");
      setLiveSteps([]);
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
    setLiveSteps([]);
    setAttachments([]);
    setAnchorId("");
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
          liveSteps={liveSteps}
          phase={status === "proposing" ? "thinking" : phase}
          agentMenuOpen={agentMenuOpen}
          reviewVisible={reviewVisible}
          attachSlot={
            projects.length > 0 || attachments.length > 0 ? (
              <div className="lad-attach-bar">
                <select
                  className="lad-attach-anchor"
                  value={anchorId}
                  onChange={(event) => setAnchorId(event.target.value)}
                  aria-label="Проект-якорь для файла"
                >
                  <option value="">Привязать файл к проекту…</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.label}</option>
                  ))}
                </select>
                {attachments.map((file) => (
                  <span key={file.id} className="lad-attach-chip">
                    {file.name}
                    <button type="button" aria-label="Убрать файл" onClick={() => setAttachments((list) => list.filter((f) => f.id !== file.id))}>×</button>
                  </span>
                ))}
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept=".txt,.md,.markdown,.csv,.json,.yaml,.yml,text/*,application/json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void onFilePicked(file);
                    event.target.value = "";
                  }}
                />
              </div>
            ) : undefined
          }
          onInputChange={setInputValue}
          onSend={() => void sendMessage()}
          onAttachClick={openFilePicker}
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
