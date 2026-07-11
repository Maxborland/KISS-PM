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


// Какое поле action редактируется ручной правкой в панели сверки. Структурные действия
// (статус/ресурсы/план) сюда НЕ входят — их значение нельзя безопасно вывести из текста, поэтому
// inline-правка для них блокируется (иначе apply молча слал бы оригинал — дыра доверия).
const EDITABLE_FIELD: Record<string, string> = { comment_task: "body", create_task: "title" };

const KIND_BY_TOOL: Record<string, DemoChange["kind"]> = {
  change_task_status: "status",
  update_task: "text",
  comment_task: "text",
  create_task: "text",
  apply_resource_resolution: "date",
  apply_plan_commands: "date"
};

const PRODUCT_NAV_ITEMS = [
  { label: "Агент", href: "/agent" },
  { label: "Проекты", href: "/projects" },
  { label: "Мои задачи", href: "/my-work" },
  { label: "Дашборд", href: "/dashboard" },
  { label: "Коммуникации", href: "/communications/chat" },
  { label: "Администрирование", href: "/admin" }
];

function actionToChange(action: ProposedAction, index: number): DemoChange {
  const allowed = action.capability.allowed;
  return {
    id: `chg-${index}`,
    number: index + 1,
    title: action.title,
    before: action.preview.before,
    after: action.preview.after,
    status: allowed ? "выбрано" : "требует прав",
    selected: allowed,
    kind: KIND_BY_TOOL[action.tool] ?? "text"
  };
}
const CHANGE_STATUS_BY_EXECUTION = {
  applied: "применено",
  skipped: "пропущено",
  denied: "отказано",
  conflict: "конфликт",
  failed: "ошибка"
} as const;

const formatMessageTime = (date = new Date()): string =>
  date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });


/**
 * Агент — полноценный чат с AI-ассистентом, действующим в рамках прав сотрудника.
 * Дизайн — SSOT `LandingAgentDemo` (чат-тред + панель сверки изменений), но на БОЕВОМ
 * контракте: сообщение → POST /agent/propose (LLM-цикл, ничего не меняется) → изменения в
 * панели сверки → подтверждение → POST /agent/execute (governed-команды + audit).
 * live → реальный LLM (ключ на сервере); mock/Storybook → детерминированный демо-«мозг».
 */
export function AgentSurface() {
  const { proposeStream, execute, uploadAttachment, listProjects, status, provider } = useAgent();

  const [phase, setPhase] = useState<DemoPhase>("draft");
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<DemoMessage[]>([]);
  const [liveSteps, setLiveSteps] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string }>>([]);
  const [anchorId, setAnchorId] = useState("");
  const [projects, setProjects] = useState<Array<{ id: string; label: string }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const applyInFlight = useRef(false);
  const [changes, setChanges] = useState<DemoChange[]>([]);
  const [activeChangeId, setActiveChangeId] = useState("");
  const [editingChangeId, setEditingChangeId] = useState<string | undefined>(undefined);
  const [actionMap, setActionMap] = useState<Record<string, AgentActionInput>>({});
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);
  const [navExpanded, setNavExpanded] = useState(false);
  const [mobileLeft, setMobileLeft] = useState(false);
  const [mobileReview, setMobileReview] = useState(false);

  const reviewVisible = changes.length > 0 && phase !== "draft" && phase !== "thinking";
  const now = () => formatMessageTime();

  const addMessage = (author: "user" | "henry", text: string) =>
    setMessages((m) => [...m, { id: `${author}-${m.length}`, author, time: now(), text }]);

  // Проекты-якоря для вложений грузим один раз.
  useEffect(() => {
    let active = true;
    void listProjects().then((list) => { if (active) setProjects(list); });
    return () => { active = false; };
  }, [listProjects]);

  function openFilePicker() {
    if (!anchorId) {
      addMessage("henry", projects.length === 0
        ? "Нет доступных проектов для привязки файла — вложения требуют проекта, которым вы управляете."
        : "Сначала выберите проект, к которому привязать файл.");
      return;
    }
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
    if (applyInFlight.current) return;
    const goal = inputValue.trim();
    if (goal.length === 0) return;
    if (provider?.configured === false) {
      addMessage("henry", `LLM-провайдер не настроен (провайдер ${provider.model}) — задайте OPENROUTER_API_KEY или ANTHROPIC_API_KEY на сервере.`);
      return;
    }
    // Историю собираем ДО добавления текущей реплики (память чата: прошлые ходы → контекст агента).
    const history = messages.map((message) => ({ role: message.author === "user" ? ("user" as const) : ("assistant" as const), text: message.text }));
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
    }, attachmentIds, history);
    if (!res.ok) {
      // НЕ стираем вложения при сбое — пользователь сможет повторить, не загружая файл заново.
      addMessage("henry", `Не удалось обработать запрос: ${res.code}`);
      setPhase("draft");
      setLiveSteps([]);
      return;
    }
    setAttachments([]); // успех — вложения учтены агентом, чистим панель
    setEditingChangeId(undefined);
    const data = res.data;
    const newChanges = data.proposedActions.map(actionToChange);
    const map: Record<string, AgentActionInput> = {};
    data.proposedActions.forEach((action, i) => {
      map[`chg-${i}`] = {
        tool: action.tool,
        input: action.input,
        ...(action.preconditionVersions ? { preconditionVersions: action.preconditionVersions } : {})
      };
    });
    setActionMap(map);
    setChanges(newChanges);
    setActiveChangeId(newChanges[0]?.id ?? "");
    addMessage("henry", data.reasoning || (newChanges.length ? "Подготовил предложение — проверьте сверку справа." : "Безопасных действий не нашёл."));
    setPhase(newChanges.length ? "review-open" : "applied");
  }

  async function applySelected() {
    if (applyInFlight.current) return;
    const selected = changes.filter((change) =>
      change.selected && ["выбрано", "изменено", "ошибка"].includes(change.status)
    );
    const actions = selected.map((change) => actionMap[change.id]).filter((action): action is AgentActionInput => Boolean(action));
    if (actions.length === 0) return;
    applyInFlight.current = true;
    const res = await execute(actions).finally(() => {
      applyInFlight.current = false;
    });
    if (!res.ok) {
      setEditingChangeId(undefined);
      if (res.uncertain) {
        setChanges((current) => current.map((change) =>
          selected.some((sent) => sent.id === change.id)
            ? { ...change, status: "неизвестно", selected: false }
            : change
        ));
        addMessage(
          "henry",
          `Ответ на применение потерян (${res.code}). Итог отправленных изменений неизвестен — обновите данные и сформируйте предложение заново.`
        );
      } else {
        setChanges((current) => current.map((change) =>
          selected.some((sent) => sent.id === change.id) ? { ...change, status: "ошибка" } : change
        ));
        addMessage("henry", `Изменения не применены: ${res.code}. Исправьте причину и повторите только отмеченные действия.`);
      }
      return;
    }
    setEditingChangeId(undefined);

    const resultByChangeId = new Map(selected.map((change, index) => [change.id, res.data.results[index]]));
    setChanges((current) => current.map((change) => {
      const result = resultByChangeId.get(change.id);
      if (!result) return change;
      return {
        ...change,
        status: CHANGE_STATUS_BY_EXECUTION[result.status],
        selected: result.status === "failed"
      };
    }));
    setPhase(res.data.summary.failed > 0 ? "review-open" : "applied");
    const { applied, skipped, denied, conflict, failed } = res.data.summary;
    addMessage(
      "henry",
      `Результат: применено ${applied}, пропущено ${skipped}, отказано ${denied}, конфликтов ${conflict}, ошибок ${failed}.`
    );
    if (res.data.results.some((result) => result.error === "task_version_conflict")) {
      addMessage(
        "henry",
        "Предложение по задаче устарело: данные изменились после проверки. Обновите данные и сформируйте предложение заново — конфликт не будет применён повторно."
      );
    }
  }

  function resetDemo() {
    if (applyInFlight.current) return;
    setMessages([]);
    setLiveSteps([]);
    setAttachments([]);
    setAnchorId("");
    setChanges([]);
    setActionMap({});
    setActiveChangeId("");
    setEditingChangeId(undefined);
    setPhase("draft");
  }

  return (
    <AgentWorkspaceFrame>
      {/* Честная деградация (G7-01): без LLM-ключа агент отвечает детерминированной
          заглушкой — иначе «Предложений нет» неотличимо от нормальной работы. */}
      {provider && !provider.live ? (
        <div
          role="status"
          className="flex items-baseline gap-2 border-b border-[var(--warning)] bg-[var(--warning-soft)] px-4 py-2 text-[length:var(--text-sm)] text-[var(--warning-text)]"
        >
          <strong className="whitespace-nowrap">Демо-режим</strong>
          <span>
            LLM-ключ не настроен (провайдер {provider.model}) — агент отвечает заглушкой и реальных предложений не даст.
            Задайте OPENROUTER_API_KEY или ANTHROPIC_API_KEY в конфигурации сервера.
          </span>
        </div>
      ) : null}
      <div className={cn("lad-layout", navExpanded && "lad-layout--nav-expanded", reviewVisible && "lad-layout--review-open")}>
        <CollapsedAppNav
          expanded={navExpanded}
          mobileOpen={mobileLeft}
          onToggle={() => setNavExpanded((v) => !v)}
          items={PRODUCT_NAV_ITEMS}
          activeHref="/agent"
        />
        <MobileDrawerBackdrop visible={mobileLeft || mobileReview} onClick={() => { setMobileLeft(false); setMobileReview(false); }} />
        <AgentConversationList items={[]} />
        <AgentChatPanel
          messages={messages}
          inputValue={inputValue}
          visibleSteps={3}
          liveSteps={liveSteps}
          phase={status === "proposing" ? "thinking" : phase}
          agentMenuOpen={agentMenuOpen}
          reviewVisible={reviewVisible}
          disabled={status === "executing"}
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
          busy={status === "executing"}
          onSelectChange={(id) => {
            if (applyInFlight.current) return;
            setChanges((cs) => cs.map((c) =>
              c.id === id && !["требует прав", "применено", "пропущено", "отказано", "конфликт", "неизвестно"].includes(c.status)
                ? { ...c, selected: !c.selected, status: c.selected ? "отклонено" : "выбрано" }
                : c
            ));
          }}
          onFocusChange={setActiveChangeId}
          onRejectChange={(id) => {
            if (applyInFlight.current) return;
            setChanges((cs) => cs.map((c) =>
              c.id === id && !["применено", "пропущено", "отказано", "конфликт", "неизвестно"].includes(c.status)
                ? { ...c, selected: false, status: "отклонено" }
                : c
            ));
          }}
          onEditChange={(id) => {
            if (applyInFlight.current) return;
            const change = changes.find((item) => item.id === id);
            if (!change || ["применено", "пропущено", "отказано", "конфликт", "неизвестно"].includes(change.status)) return;
            // Правка возможна только для действий с явным редактируемым полем (текст).
            if (!EDITABLE_FIELD[actionMap[id]?.tool ?? ""]) {
              addMessage("henry", "Это действие нельзя отредактировать вручную — отклоните его и уточните запрос, и я предложу новый вариант.");
              return;
            }
            setActiveChangeId(id);
            setEditingChangeId(id);
          }}
          onUpdateChange={(id, value) => {
            if (applyInFlight.current) return;
            // Правка реально попадает в action (а не только в отображение) — закрывает дыру доверия.
            const field = EDITABLE_FIELD[actionMap[id]?.tool ?? ""];
            if (field) {
              setActionMap((m) => (m[id] ? { ...m, [id]: { ...m[id]!, input: { ...m[id]!.input, [field]: value } } } : m));
              setChanges((cs) => cs.map((c) => (c.id === id ? { ...c, after: value, status: "изменено", selected: true } : c)));
            }
          }}
          onApply={() => void applySelected()}
          onReset={resetDemo}
        />
      </div>
    </AgentWorkspaceFrame>
  );
}
