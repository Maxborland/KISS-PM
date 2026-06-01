"use client";

import { useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock3,
  GitCompareArrows,
  LoaderCircle,
  SendHorizontal,
  ShieldCheck
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import type { OperationsCockpitReadModel } from "@/lib/api-types";
import type {
  WorkspaceAgentActionProposal,
  WorkspaceAgentProposalStatus,
  WorkspaceAgentThread
} from "@/lib/api/read-models";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/mock-data/format";

export type AgentCockpitBlockProps = {
  thread: WorkspaceAgentThread;
  operationsCockpit?: OperationsCockpitReadModel | undefined;
  currentUserId?: string | undefined;
  isSending?: boolean;
  isConfirming?: boolean;
  messageError?: unknown;
  actionError?: unknown;
  onSendMessage?: ((body: string) => Promise<unknown>) | undefined;
  onConfirmProposal?: ((proposalId: string, decision: "apply" | "reject") => Promise<unknown>) | undefined;
  variant?: "embedded" | "surface";
};

const THINKING_STEPS = [
  "Читает доступный контекст рабочей области",
  "Собирает риски, сроки и загрузку",
  "Готовит сверку перед действием"
] as const;

export function AgentCockpitBlock({
  thread,
  operationsCockpit,
  currentUserId,
  isSending = false,
  isConfirming = false,
  messageError = null,
  actionError = null,
  onSendMessage,
  onConfirmProposal,
  variant = "embedded"
}: AgentCockpitBlockProps) {
  const [agentInput, setAgentInput] = useState("");
  const proposals = thread.proposals;
  const hasHistory = thread.messages.length > 0;
  const hasProposals = proposals.length > 0;
  const appliedProposal = [...proposals].reverse().find((proposal) => proposal.status === "applied");
  const proposedCount = proposals.filter((proposal) => proposal.status === "proposed").length;

  return (
    <div
      className={cn("runtime-agent", "agent-cockpit", variant === "surface" && "agent-cockpit--surface")}
      aria-label="Единый управленческий агент"
    >
      <section className="runtime-agent__chat" aria-label="Чат с Генри Ганттом">
        <header className="runtime-agent__header">
          <div className="runtime-agent__title">
            <span className="runtime-agent__mark"><Bot aria-hidden /></span>
            <div>
              <h3>Генри Гантт</h3>
              <span>Агент рабочей области</span>
            </div>
          </div>
          <div className="runtime-agent__status">
            <span className="dot dot--success" />
            Ждет подтверждения перед изменениями
          </div>
        </header>

        <div className="runtime-agent__body">
          {!hasHistory ? (
            <EmptyState
              title="История пуста"
              description="Задайте вопрос по портфелю, задачам, срокам или загрузке."
            />
          ) : (
            thread.messages.slice(-8).map((message) => {
              const isOwnMessage =
                message.authorType !== "agent" && (currentUserId ? message.authorUserId === currentUserId : true);
              return (
                <article
                  key={message.id}
                  className={cn("runtime-agent-message", isOwnMessage && "runtime-agent-message--user")}
                >
                  <span className="runtime-agent-message__avatar" aria-hidden>
                    {isOwnMessage ? "Вы" : <Bot aria-hidden />}
                  </span>
                  <div className="runtime-agent-message__content">
                    <div className="runtime-agent-message__meta">
                      <span>{isOwnMessage ? "Вы" : "Генри Гантт"}</span>
                      <time>{formatDate(message.createdAt)}</time>
                    </div>
                    <p>{message.body}</p>
                  </div>
                </article>
              );
            })
          )}
          {isSending ? <AgentThinkingSteps /> : null}
        </div>

        <form
          className="runtime-agent__composer"
          onSubmit={(event) => {
            event.preventDefault();
            const body = agentInput.trim();
            if (!body || !onSendMessage) return;
            void onSendMessage(body).then(() => setAgentInput(""));
          }}
        >
          <Textarea
            aria-label="Сообщение Генри Гантту"
            placeholder="Спросить, что требует внимания сегодня"
            value={agentInput}
            onChange={(event) => setAgentInput(event.target.value)}
          />
          <Button
            type="submit"
            variant="primary"
            size="icon"
            aria-label="Отправить сообщение"
            disabled={!agentInput.trim() || isSending || !onSendMessage}
          >
            {isSending ? <LoaderCircle className="agent-cockpit__spin" aria-hidden /> : <SendHorizontal aria-hidden />}
          </Button>
        </form>
        {messageError ? (
          <p className="runtime-agent__error">Не удалось отправить сообщение агенту.</p>
        ) : null}
      </section>

      <aside className="runtime-agent-review" aria-label="Сверка изменений">
        <header className="runtime-agent-review__header">
          <ShieldCheck aria-hidden />
          <div>
            <span>Сверка изменений</span>
            <strong>{hasProposals ? `${proposals.length} предложений` : "Готова к ревью"}</strong>
          </div>
        </header>

        {operationsCockpit ? <AgentOperationsContextPanel data={operationsCockpit} /> : null}

        {!hasProposals ? (
          <>
            <div className="runtime-agent-review__list">
              <div className="runtime-agent-review__step is-done">
                <CheckCircle2 aria-hidden />
                <span>Контекст рабочей области подключен</span>
              </div>
              <div className="runtime-agent-review__step">
                <Clock3 aria-hidden />
                <span>Отправьте запрос, чтобы Генри подготовил действие</span>
              </div>
            </div>
            <p>Генри не меняет данные без подтверждения. Предложение появится здесь после сообщения.</p>
          </>
        ) : (
          <div className="runtime-agent-review__list">
            {proposals.slice(-5).map((proposal) => (
              <AgentProposalCard
                key={proposal.id}
                proposal={proposal}
                isConfirming={isConfirming}
                onConfirmProposal={onConfirmProposal}
              />
            ))}
          </div>
        )}

        {appliedProposal ? (
          <div className="agent-cockpit__audit-strip">
            <CheckCircle2 aria-hidden />
            <span>Результат применен и записан в аудит рабочей области.</span>
          </div>
        ) : proposedCount > 0 ? (
          <div className="agent-cockpit__audit-strip agent-cockpit__audit-strip--pending">
            <ShieldCheck aria-hidden />
            <span>Перед применением нужна явная сверка пользователя.</span>
          </div>
        ) : null}

        {actionError ? (
          <p className="runtime-agent__error">Не удалось подтвердить действие агента.</p>
        ) : null}
      </aside>
    </div>
  );
}

function AgentOperationsContextPanel({ data }: { data: OperationsCockpitReadModel }) {
  const topAttention = data.attentionItems.slice(0, 3);
  const cockpitUnavailable = data.agentContext.unavailableSources.find(
    (source) => source.source === "operations_cockpit"
  );
  const permissionUnavailable = data.agentContext.unavailableSources.filter(
    (source) => source.source === "opportunity_pipeline" || source.source === "resource_workload"
  );

  return (
    <section className="agent-cockpit-context" aria-label="Контекст агента">
      <div className="agent-cockpit-context__head">
        <BarChart3 aria-hidden />
        <div>
          <span>Контекст cockpit</span>
          <strong>{data.indicators.activeProjects} активных проектов</strong>
        </div>
      </div>
      <div className="agent-cockpit-context__metrics">
        <span>
          <strong>{data.indicators.overdueTasks}</strong>
          просрочено
        </span>
        <span>
          <strong>{data.indicators.criticalTasks}</strong>
          критично
        </span>
        <span>
          <strong>{data.indicators.openDeals}</strong>
          сделок
        </span>
      </div>
      {topAttention.length > 0 ? (
        <div className="agent-cockpit-context__attention">
          {topAttention.map((item) => (
            <div key={item.id} className="agent-cockpit-context__item">
              <AlertTriangle aria-hidden />
              <span>{item.title}</span>
            </div>
          ))}
        </div>
      ) : cockpitUnavailable ? (
        <p>Операционный контекст недоступен: {cockpitUnavailable.reason}.</p>
      ) : (
        <p>Критичных сигналов в доступном контексте нет.</p>
      )}
      {permissionUnavailable.length > 0 ? (
        <p>
          Часть источников скрыта правами:{" "}
          {permissionUnavailable.map((source) => source.source).join(", ")}.
        </p>
      ) : null}
    </section>
  );
}

function AgentThinkingSteps() {
  return (
    <div className="agent-cockpit-thinking" aria-label="Ход работы агента">
      {THINKING_STEPS.map((step, index) => (
        <div
          key={step}
          className={cn(
            "runtime-agent-review__step",
            index < THINKING_STEPS.length - 1 && "is-done",
            index === THINKING_STEPS.length - 1 && "is-active"
          )}
        >
          {index === THINKING_STEPS.length - 1 ? (
            <LoaderCircle className="agent-cockpit__spin" aria-hidden />
          ) : (
            <CheckCircle2 aria-hidden />
          )}
          <span>{step}</span>
        </div>
      ))}
    </div>
  );
}

function AgentProposalCard({
  proposal,
  isConfirming,
  onConfirmProposal
}: {
  proposal: WorkspaceAgentActionProposal;
  isConfirming: boolean;
  onConfirmProposal?: ((proposalId: string, decision: "apply" | "reject") => Promise<unknown>) | undefined;
}) {
  const effectLabel = workspaceAgentProposalEffectLabel(proposal);
  const diffRows = workspaceAgentProposalDiffRows(proposal);

  return (
    <article className="runtime-agent-proposal">
      <div className="runtime-agent-proposal__head">
        <strong>{proposal.title}</strong>
        <span data-status={proposal.status}>{agentProposalStatusLabel(proposal.status)}</span>
      </div>
      <p>{proposal.description}</p>
      {diffRows.length > 0 ? (
        <div className="agent-cockpit-diff" aria-label="До и после">
          <div className="agent-cockpit-diff__title">
            <GitCompareArrows aria-hidden />
            До / после
          </div>
          {diffRows.map((row) => (
            <div key={row.label} className="agent-cockpit-diff__row">
              <span>{row.label}</span>
              <del>{row.before}</del>
              <strong>{row.after}</strong>
            </div>
          ))}
        </div>
      ) : null}
      {effectLabel ? (
        <div className="runtime-agent-proposal__effect">
          <CheckCircle2 aria-hidden />
          {effectLabel}
        </div>
      ) : null}
      {proposal.resultSummary ? <AgentProposalResult summary={proposal.resultSummary} /> : null}
      {proposal.auditEventId ? (
        <div className="runtime-agent-proposal__audit" aria-label={`След аудита: ${proposal.auditEventId}`}>
          <CheckCircle2 aria-hidden />
          <span>
            Записано в аудит: <code>{proposal.auditEventId}</code>
          </span>
        </div>
      ) : null}
      {proposal.status === "proposed" ? (
        <div className="runtime-agent-proposal__actions">
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={isConfirming || !onConfirmProposal}
            onClick={() => void onConfirmProposal?.(proposal.id, "apply")}
          >
            Применить
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isConfirming || !onConfirmProposal}
            onClick={() => void onConfirmProposal?.(proposal.id, "reject")}
          >
            Отклонить
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function AgentProposalResult({
  summary
}: {
  summary: NonNullable<WorkspaceAgentActionProposal["resultSummary"]>;
}) {
  const ResultIcon = workspaceAgentResultStatusIcon(summary.status);
  const changedEntityHref =
    summary.status === "succeeded" && summary.mutationApplied
      ? workspaceAgentChangedEntityHref(summary.changedEntity)
      : null;
  const changedEntityLabel = summary.changedEntity
    ? `${summary.changedEntity.type}:${summary.changedEntity.id} · ${summary.changedEntity.title}`
    : null;

  return (
    <div className="runtime-agent-proposal__result" data-status={summary.status}>
      <ResultIcon aria-hidden />
      <div>
        <strong>{workspaceAgentResultStatusLabel(summary.status)}</strong>
        <span>{summary.description}</span>
        {changedEntityHref && changedEntityLabel ? (
          <a href={changedEntityHref} aria-label={`Открыть результат действия: ${changedEntityLabel}`}>
            <code>{changedEntityLabel}</code>
          </a>
        ) : changedEntityLabel ? (
          <code>{changedEntityLabel}</code>
        ) : null}
      </div>
    </div>
  );
}

function agentProposalStatusLabel(status: WorkspaceAgentProposalStatus): string {
  if (status === "applying") return "применяется";
  if (status === "applied") return "применено";
  if (status === "rejected") return "отклонено";
  return "ожидает";
}

function workspaceAgentResultStatusLabel(status: NonNullable<WorkspaceAgentActionProposal["resultSummary"]>["status"]): string {
  if (status === "succeeded") return "Изменение применено";
  if (status === "rejected") return "Изменение не применено";
  return "Ожидает подтверждения";
}

function workspaceAgentResultStatusIcon(status: NonNullable<WorkspaceAgentActionProposal["resultSummary"]>["status"]) {
  if (status === "succeeded") return CheckCircle2;
  if (status === "rejected") return AlertTriangle;
  return Clock3;
}

function workspaceAgentChangedEntityHref(
  entity: NonNullable<WorkspaceAgentActionProposal["resultSummary"]>["changedEntity"]
): string | null {
  if (entity?.type === "Task") {
    return `/my-work?taskId=${encodeURIComponent(entity.id)}`;
  }
  return null;
}

function workspaceAgentProposalEffectLabel(proposal: WorkspaceAgentActionProposal): string | null {
  if (proposal.actionType !== "workspace.agent.create_task") return null;
  const task = proposal.payload.task;
  if (!isRecord(task) || typeof task.title !== "string") return null;
  if (proposal.status === "applied") return `Создана задача: ${task.title}`;
  if (proposal.status === "rejected") return `Задача не создана: ${task.title}`;
  return `Будет создана задача: ${task.title}`;
}

function workspaceAgentProposalDiffRows(proposal: WorkspaceAgentActionProposal) {
  if (proposal.actionType === "workspace.agent.create_task") {
    const task = proposal.payload.task;
    const title = isRecord(task) && typeof task.title === "string" ? task.title : proposal.title;
    return [
      {
        label: "Задача",
        before: "нет в плане",
        after: title
      },
      {
        label: "Статус",
        before: "не применено",
        after: agentProposalStatusLabel(proposal.status)
      }
    ];
  }

  return [
    {
      label: "Решение",
      before: "только сообщение",
      after: proposal.title
    },
    {
      label: "Статус",
      before: "не применено",
      after: agentProposalStatusLabel(proposal.status)
    }
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
