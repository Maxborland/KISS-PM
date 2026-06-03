"use client";

import { useEffect, useState } from "react";

import { CardPanel } from "@/components/domain/card-panel";
import { CellStack } from "@/components/domain/cell-stack";
import { DataTable } from "@/components/domain/data-table";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import type { Opportunity, Project } from "@/lib/api-types";
import { RoutePageIntro } from "@/views/layout/route-page-intro";

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
  currency: "RUB",
  maximumFractionDigits: 0,
  style: "currency"
});

const numberFormatter = new Intl.NumberFormat("ru-RU");

export function DealDetailRuntimeBlock({
  activatedProject = null,
  activationError,
  activationPending = false,
  canUpdateNextAction = false,
  nextActionError,
  nextActionPending = false,
  onActivateProject,
  onUpdateNextAction,
  opportunity
}: {
  activatedProject?: Project | null;
  activationError?: unknown;
  activationPending?: boolean;
  canUpdateNextAction?: boolean;
  nextActionError?: unknown;
  nextActionPending?: boolean;
  onActivateProject?: () => Promise<Project>;
  onUpdateNextAction?: (nextAction: string) => Promise<Opportunity>;
  opportunity: Opportunity;
}) {
  const [confirmingActivation, setConfirmingActivation] = useState(false);
  const [nextActionDraft, setNextActionDraft] = useState(() => nextActionValue(opportunity));
  const canActivate = opportunity.status === "ready_to_activate";
  const canSaveNextAction = canUpdateNextAction && Boolean(onUpdateNextAction);
  const nextActionDisabledReason = canUpdateNextAction
    ? "Сохранение следующего действия временно недоступно."
    : "Недостаточно прав для изменения сделки.";

  useEffect(() => {
    setNextActionDraft(nextActionValue(opportunity));
  }, [opportunity]);

  async function handleConfirmActivation() {
    if (!onActivateProject) return;
    try {
      await onActivateProject();
      setConfirmingActivation(false);
    } catch {
      // Mutation error is rendered from activationError; keep the confirmation open for retry.
    }
  }

  async function handleSaveNextAction() {
    if (!canSaveNextAction || !onUpdateNextAction) return;
    await onUpdateNextAction(nextActionDraft.trim());
  }

  return (
    <>
      <RoutePageIntro
        lead={`Живая карточка сделки «${opportunity.title}»: клиент, контакт, сроки, бюджет, трудоёмкость и готовность к передаче в проект.`}
      />
      <div className="u-grid u-grid-2 u-gap-4">
        <CardPanel title="Сделка" subtitle={opportunity.id}>
          <div className="u-flex u-flex-col u-gap-3">
            <CellStack title={opportunity.title} subtitle={opportunity.description ?? "Описание не указано"} />
            <div className="u-flex u-flex-wrap u-gap-2">
              <Chip variant="info">{opportunity.status}</Chip>
              <Chip variant={opportunity.feasibilityStatus === "ready" ? "success" : "warning"}>
                {opportunity.feasibilityStatus ?? "оценка не проверена"}
              </Chip>
            </div>
          </div>
        </CardPanel>
        <CardPanel title="Коммерция" subtitle="Оценка и вероятность">
          <div className="u-grid u-grid-2 u-gap-3">
            <CellStack title={currencyFormatter.format(opportunity.contractValue)} subtitle="Бюджет" />
            <CellStack title={`${opportunity.probability}%`} subtitle="Вероятность" />
            <CellStack title={currencyFormatter.format(opportunity.plannedHourlyRate)} subtitle="Ставка/час" />
            <CellStack title={`${numberFormatter.format(opportunity.plannedHours)} ч`} subtitle="Плановая трудоёмкость" />
          </div>
        </CardPanel>
      </div>
      <CardPanel title="Контекст передачи" subtitle="Клиент, контакт, тип проекта и сроки" flush>
        <DataTable>
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Контакт</th>
              <th>Тип проекта</th>
              <th>Сроки</th>
              <th>Шаблон</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <CellStack title={opportunity.clientName} subtitle={opportunity.clientId ?? "клиент не связан"} />
              </td>
              <td>
                <CellStack
                  title={opportunity.contactName}
                  subtitle={opportunity.primaryContactId ?? "контакт не связан"}
                />
              </td>
              <td>
                <CellStack title={opportunity.projectType} subtitle={opportunity.projectTypeId ?? "тип не связан"} />
              </td>
              <td className="mono">{formatDateRange(opportunity.plannedStart, opportunity.plannedFinish)}</td>
              <td className="mono">{opportunity.templateId ?? "без шаблона"}</td>
            </tr>
          </tbody>
        </DataTable>
      </CardPanel>
      <CardPanel title="Потребность в ролях" subtitle={`${opportunity.demand.length} позиций`} flush>
        <DataTable>
          <thead>
            <tr>
              <th>Позиция</th>
              <th>Часы</th>
            </tr>
          </thead>
          <tbody>
            {opportunity.demand.map((demand) => (
              <tr key={demand.positionId}>
                <td className="mono">{demand.positionId}</td>
                <td>{numberFormatter.format(demand.requiredHours)} ч</td>
              </tr>
            ))}
            {opportunity.demand.length === 0 ? (
              <tr>
                <td colSpan={2}>Потребность в ролях не указана.</td>
              </tr>
            ) : null}
          </tbody>
        </DataTable>
      </CardPanel>
      <CardPanel title="Следующее действие" subtitle="Что должно произойти с клиентом дальше">
        <form
          className="u-flex u-flex-col u-gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSaveNextAction();
          }}
        >
          <CellStack
            title={nextActionValue(opportunity) || "Следующее действие не задано"}
            subtitle={canSaveNextAction ? "Обновляется в карточке сделки и попадает в аудит." : nextActionDisabledReason}
          />
          <div className="u-flex u-flex-wrap u-gap-2 u-items-center">
            <Input
              aria-label="Следующее действие по сделке"
              className="u-w-320"
              disabled={!canSaveNextAction || nextActionPending}
              placeholder="Например, согласовать состав альбома с заказчиком"
              value={nextActionDraft}
              onChange={(event) => setNextActionDraft(event.currentTarget.value)}
            />
            <Button
              disabled={!canSaveNextAction || nextActionPending}
              title={!canSaveNextAction ? nextActionDisabledReason : undefined}
              type="submit"
              variant="primary"
            >
              {nextActionPending ? "Сохраняем…" : "Сохранить"}
            </Button>
          </div>
          {!canSaveNextAction ? <span className="u-text-xs u-text-muted">{nextActionDisabledReason}</span> : null}
          {nextActionError ? (
            <div role="alert" className="field__error">
              {formatNextActionError(nextActionError)}
            </div>
          ) : null}
        </form>
      </CardPanel>
      <CardPanel title="Передача в проект" subtitle="Явное подтверждение перед изменением данных">
        <div className="u-flex u-flex-col u-gap-3">
          <CellStack
            title={canActivate ? "Сделку можно передать в проект" : "Передача пока недоступна"}
            subtitle={
              canActivate
                ? "Будет создан или открыт связанный проект с контекстом сделки. Если есть риск по ресурсам, подтверждение зафиксирует его принятие."
                : "Сначала нужна готовность сделки к активации."
            }
          />
          {activatedProject ? (
            <div className="u-flex u-flex-wrap u-gap-2 u-items-center">
              <Chip variant="success">проект готов</Chip>
              <Button asChild variant="primary">
                <a href={`/projects/${activatedProject.id}`}>Открыть проект</a>
              </Button>
            </div>
          ) : null}
          {activationError ? (
            <div role="alert" className="field__error">
              {formatActivationError(activationError)}
            </div>
          ) : null}
          {confirmingActivation ? (
            <div className="u-flex u-flex-wrap u-gap-2 u-items-center">
              <span>Подтвердите: создать или открыть проект по этой сделке?</span>
              <Button disabled={activationPending} variant="primary" onClick={() => void handleConfirmActivation()}>
                {activationPending ? "Передаём…" : "Подтвердить передачу"}
              </Button>
              <Button disabled={activationPending} variant="secondary" onClick={() => setConfirmingActivation(false)}>
                Отмена
              </Button>
            </div>
          ) : (
            <Button
              disabled={!canActivate || activationPending || !onActivateProject}
              variant="primary"
              onClick={() => setConfirmingActivation(true)}
            >
              {activationPending ? "Передаём…" : "Передать в проект"}
            </Button>
          )}
        </div>
      </CardPanel>
    </>
  );
}

function nextActionValue(opportunity: Opportunity): string {
  return opportunity.customFieldValues?.next_action ?? "";
}

function formatDateRange(start: string, finish: string): string {
  const formatter = new Intl.DateTimeFormat("ru-RU");
  return `${formatter.format(new Date(start))} — ${formatter.format(new Date(finish))}`;
}

function formatActivationError(error: unknown): string {
  if (error instanceof Error) return `Не удалось передать сделку: ${error.message}`;
  return "Не удалось передать сделку. Проверьте права и попробуйте снова.";
}

function formatNextActionError(error: unknown): string {
  if (error instanceof Error) return `Не удалось сохранить следующее действие: ${error.message}`;
  return "Не удалось сохранить следующее действие. Проверьте права и попробуйте снова.";
}
