"use client";

import { useEffect, useRef, useState } from "react";

import { BannerInline } from "@/components/ui/banner-inline";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { useAgent } from "@/workspace/agent/use-agent";
import type { AgentActionInput, ProposedAction } from "@/workspace/agent/agent-client";
import type { AgentChange, AgentMessage, AgentPhase } from "@/workspace/agent/agent-model";
import { TERMINAL_STATUSES } from "@/workspace/agent/agent-model";
import { AgentComposer } from "@/workspace/agent/ui/agent-composer";
import { AgentHeader } from "@/workspace/agent/ui/agent-header";
import { ChatThread } from "@/workspace/agent/ui/agent-messages";
import { ChangeReviewPanel } from "@/workspace/agent/ui/agent-review";

// Какое поле action редактируется ручной правкой в панели сверки. Структурные действия
// (статус/ресурсы/план) сюда НЕ входят — их значение нельзя безопасно вывести из текста, поэтому
// inline-правка для них блокируется (иначе apply молча слал бы оригинал — дыра доверия).
const EDITABLE_FIELD: Record<string, string> = { comment_task: "body", create_task: "title" };

function actionToChange(action: ProposedAction, index: number): AgentChange {
  const allowed = action.capability.allowed;
  return {
    id: `chg-${index}`,
    number: index + 1,
    title: action.title,
    before: action.preview.before,
    after: action.preview.after,
    status: allowed ? "выбрано" : "требует прав",
    selected: allowed,
    editable: Boolean(EDITABLE_FIELD[action.tool])
  };
}

const CHANGE_STATUS_BY_EXECUTION = {
  applied: "применено",
  denied: "отказано",
  conflict: "конфликт",
  failed: "ошибка"
} as const;

const formatMessageTime = (date = new Date()): string =>
  date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

/**
 * Агент — чат с AI-ассистентом, действующим в рамках прав сотрудника, на боевом
 * контракте: сообщение → POST /agent/propose (LLM-цикл, ничего не меняется) →
 * изменения в панели сверки → подтверждение → POST /agent/execute (governed-команды
 * + audit). Первый визуальный эталон KISS Operational: канонические токены,
 * ролевая модель сообщений (user/agent/trace/result/error), честные состояния.
 * Оболочку (WorkspaceShell) даёт route — поверхность рендерится и в Storybook standalone.
 */
export function AgentSurface() {
  const { proposeStream, execute, uploadAttachment, listProjects, status, provider, tools, toolsError, toolsReloading, reloadTools } = useAgent();

  const [phase, setPhase] = useState<AgentPhase>("draft");
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [liveSteps, setLiveSteps] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Array<{ id: string; name: string }>>([]);
  const [anchorId, setAnchorId] = useState("");
  const [projects, setProjects] = useState<Array<{ id: string; label: string }>>([]);
  const applyInFlight = useRef(false);
  const [changes, setChanges] = useState<AgentChange[]>([]);
  const [activeChangeId, setActiveChangeId] = useState("");
  const [editingChangeId, setEditingChangeId] = useState<string | undefined>(undefined);
  const [actionMap, setActionMap] = useState<Record<string, AgentActionInput>>({});
  const [mobileReview, setMobileReview] = useState(false);
  const reviewButtonRef = useRef<HTMLButtonElement | null>(null);
  const composerInputRef = useRef<HTMLInputElement | null>(null);

  const thinking = phase === "thinking" || status === "proposing";
  const reviewVisible = changes.length > 0 && !thinking && phase !== "draft";
  const now = () => formatMessageTime();

  const addMessage = (role: "user" | "agent", text: string, kind?: "error" | "result") =>
    setMessages((m) => [
      ...m,
      role === "user"
        ? { id: `user-${m.length}`, role, time: now(), text }
        : { id: `agent-${m.length}`, role, time: now(), text, ...(kind ? { kind } : {}) }
    ]);

  // Проекты-якоря для вложений грузим один раз.
  useEffect(() => {
    let active = true;
    void listProjects().then((list) => { if (active) setProjects(list); });
    return () => { active = false; };
  }, [listProjects]);

  async function onFilePicked(file: File) {
    const res = await uploadAttachment(file, "project", anchorId);
    if (res.ok) { setAttachments((list) => [...list, res.data]); return; }
    // Загрузка вложений требует прав на управление проектом (canManageProjects); для
    // read-only/участника якорь недоступен — честно сообщаем, а не молча роняем.
    const denied = res.code === "permission_missing" || res.code === "cross_tenant_denied" || res.code === "forbidden";
    addMessage("agent", denied
      ? "Нет прав на добавление файла в этот проект — выберите проект, которым вы управляете."
      : `Не удалось загрузить файл: ${res.code}.`, "error");
  }

  async function sendMessage() {
    if (applyInFlight.current) return;
    if (status === "proposing") return; // второй submit во время thinking перемешал бы два хода
    const goal = inputValue.trim();
    if (goal.length === 0) return;
    addMessage("user", goal);
    setInputValue("");
    composerInputRef.current?.focus();
    if (provider?.configured === false) {
      addMessage("agent", `LLM-провайдер не настроен (провайдер ${provider.model}) — задайте OPENROUTER_API_KEY или ANTHROPIC_API_KEY на сервере.`, "error");
      return;
    }
    // Историю собираем без текущей реплики: messages — снимок до addMessage этого submit.
    const history = messages
      .filter((message): message is Extract<AgentMessage, { role: "user" | "agent" }> => message.role !== "trace")
      .map((message) => ({ role: message.role === "user" ? ("user" as const) : ("assistant" as const), text: message.text }));
    setPhase("thinking");
    setLiveSteps([]);
    const attachmentIds = attachments.map((file) => file.id);
    // Живой CoT-трейс по SSE: только реальные шаги (анализ/рассуждение/предложение);
    // до первого события — честный индикатор, никаких выдуманных шагов.
    const collectedSteps: string[] = [];
    const res = await proposeStream(goal, (event) => {
      const label =
        event.type === "analyze" ? `Анализ: ${event.title}${event.ok ? "" : " (ошибка)"}`
        : event.type === "proposal" ? `Предложение: ${event.title}`
        : event.text.length > 80 ? `${event.text.slice(0, 80)}…` : event.text;
      collectedSteps.push(label);
      setLiveSteps((steps) => [...steps, label]);
    }, attachmentIds, history);
    // Завершённый трейс остаётся в треде сообщением-ролью trace (история хода агента);
    // прерванный ошибкой ход помечается честно, а не зелёными галочками.
    if (collectedSteps.length > 0) {
      setMessages((m) => [
        ...m,
        { id: `trace-${m.length}`, role: "trace", time: now(), steps: collectedSteps, ...(res.ok ? {} : { failed: true }) }
      ]);
    }
    setLiveSteps([]);
    if (!res.ok) {
      // НЕ стираем вложения при сбое — пользователь сможет повторить, не загружая файл заново.
      addMessage("agent", `Не удалось обработать запрос: ${res.code}`, "error");
      setPhase("draft");
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
    addMessage("agent", data.reasoning || (newChanges.length ? "Подготовил предложение — проверьте сверку справа." : "Безопасных действий не нашёл."));
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
          "agent",
          `Ответ на применение потерян (${res.code}). Итог отправленных изменений неизвестен — обновите данные и сформируйте предложение заново.`,
          "error"
        );
      } else {
        setChanges((current) => current.map((change) =>
          selected.some((sent) => sent.id === change.id) ? { ...change, status: "ошибка" } : change
        ));
        addMessage("agent", `Изменения не применены: ${res.code}. Исправьте причину и повторите только отмеченные действия.`, "error");
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
    const { applied, denied, conflict, failed } = res.data.summary;
    addMessage(
      "agent",
      `Результат: применено ${applied}, отказано ${denied}, конфликтов ${conflict}, ошибок ${failed}.`,
      "result"
    );
    if (res.data.results.some((result) => result.error === "task_version_conflict")) {
      addMessage(
        "agent",
        "Предложение по задаче устарело: данные изменились после проверки. Обновите данные и сформируйте предложение заново — конфликт не будет применён повторно."
      );
    }
  }

  function resetConversation() {
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
    setMobileReview(false);
  }

  // Первичная загрузка возможностей агента (GET /agent/tools): skeleton вместо
  // немого пустого чата, composer заблокирован до ответа.
  if (status === "loading") {
    return (
      <div className="flex h-[calc(100dvh-var(--shell-topbar-h))] flex-col" data-testid="agent-loading">
        <span role="status" className="sr-only">Загрузка агента…</span>
        <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[var(--panel)] px-4 py-2.5 md:px-6">
          <Skeleton className="size-8 rounded-full" />
          <SkeletonText className="w-40" />
        </div>
        <div className="flex flex-1 flex-col gap-3 px-6 py-6">
          <SkeletonText className="w-72" />
          <SkeletonText className="w-56" />
        </div>
      </div>
    );
  }

  return (
    // 3.5rem = h-14 топбара WorkspaceShell: чат скроллится внутри, страница — нет.
    <div className="flex h-[calc(100dvh-var(--shell-topbar-h))] flex-col bg-[var(--canvas)]">
      {/* Честная деградация (G7-01): без LLM-ключа агент отвечает детерминированной
          заглушкой — иначе «Предложений нет» неотличимо от нормальной работы. */}
      {provider && !provider.live ? (
        <div
          role="status"
          className="flex items-baseline gap-2 border-b border-[var(--warning)] bg-[var(--warning-soft)] px-4 py-2 text-[length:var(--text-sm)] text-[var(--warning-text)]"
        >
          <strong className="whitespace-nowrap">Демо-режим</strong>
          <span>
            LLM-ключ не настроен (провайдер {provider.model}) — ответы детерминированные, это не настоящий LLM.
            Задайте OPENROUTER_API_KEY или ANTHROPIC_API_KEY в конфигурации сервера.
          </span>
        </div>
      ) : null}
      {toolsError ? (
        // role=alert: баннер появляется асинхронно — иначе SR его не озвучит.
        // Сырой код ошибки — только в title (в тексте страницы запрещённые литералы
        // вроде permission_missing ловит гейт shell-role-nav).
        <div role="alert" title={toolsError}>
          <BannerInline variant="danger" className="m-3">
            <span>
              {toolsError === "permission_missing" || toolsError === "forbidden"
                ? "Нет прав на просмотр возможностей агента."
                : "Не удалось загрузить возможности агента — предложения могут быть неполными."}
            </span>
            <Button type="button" size="sm" variant="secondary" disabled={toolsReloading} onClick={() => void reloadTools()}>
              {toolsReloading ? "Повторяем…" : "Повторить"}
            </Button>
          </BannerInline>
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col" aria-label="Чат с Генри Ганттом">
          <AgentHeader
            provider={provider}
            tools={tools}
            reviewVisible={reviewVisible}
            onOpenMobileReview={() => setMobileReview(true)}
            reviewButtonRef={reviewButtonRef}
          />
          <ChatThread messages={messages} thinking={thinking} liveSteps={liveSteps} />
          <AgentComposer
            value={inputValue}
            inputRef={composerInputRef}
            disabled={status === "executing"}
            projects={projects}
            anchorId={anchorId}
            attachments={attachments}
            onChange={setInputValue}
            onSend={() => void sendMessage()}
            onAnchorChange={setAnchorId}
            onFilePicked={(file) => void onFilePicked(file)}
            onRemoveAttachment={(id) => setAttachments((list) => list.filter((f) => f.id !== id))}
            onAttachDenied={() => addMessage("agent", projects.length === 0
              ? "Нет доступных проектов для привязки файла — вложения требуют проекта, которым вы управляете."
              : "Сначала выберите проект, к которому привязать файл.")}
          />
        </section>
        <ChangeReviewPanel
          visible={reviewVisible}
          mobileOpen={reviewVisible && mobileReview}
          onCloseMobile={() => setMobileReview(false)}
          returnFocusRef={reviewButtonRef}
          state={{ changes, busy: status === "executing", activeChangeId, editingChangeId }}
          handlers={{
            onSelectChange: (id) => {
              if (applyInFlight.current) return;
              setChanges((cs) => cs.map((c) =>
                c.id === id && !TERMINAL_STATUSES.includes(c.status)
                  ? { ...c, selected: !c.selected, status: c.selected ? "отклонено" : "выбрано" }
                  : c
              ));
            },
            onFocusChange: setActiveChangeId,
            onRejectChange: (id) => {
              if (applyInFlight.current) return;
              setChanges((cs) => cs.map((c) =>
                c.id === id && !["применено", "отказано", "конфликт", "неизвестно"].includes(c.status)
                  ? { ...c, selected: false, status: "отклонено" }
                  : c
              ));
            },
            onEditChange: (id) => {
              if (applyInFlight.current) return;
              const change = changes.find((item) => item.id === id);
              if (!change || ["применено", "отказано", "конфликт", "неизвестно"].includes(change.status)) return;
              // Правка возможна только для действий с явным редактируемым полем (текст).
              if (!change.editable) {
                addMessage("agent", "Это действие нельзя отредактировать вручную — отклоните его и уточните запрос, и я предложу новый вариант.");
                return;
              }
              setActiveChangeId(id);
              setEditingChangeId(id);
            },
            onUpdateChange: (id, value) => {
              if (applyInFlight.current) return;
              // Правка реально попадает в action (а не только в отображение) — закрывает дыру доверия.
              const field = EDITABLE_FIELD[actionMap[id]?.tool ?? ""];
              if (field) {
                setActionMap((m) => (m[id] ? { ...m, [id]: { ...m[id]!, input: { ...m[id]!.input, [field]: value } } } : m));
                setChanges((cs) => cs.map((c) => (c.id === id ? { ...c, after: value, status: "изменено", selected: true } : c)));
              }
            },
            onApply: () => void applySelected(),
            onReset: resetConversation
          }}
        />
      </div>
    </div>
  );
}
