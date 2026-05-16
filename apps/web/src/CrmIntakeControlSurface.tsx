import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { CurrentTenantDto } from "./phase2ApiClient";
import {
  projectDraftIdForOpportunity,
  type CrmIntakeApiClient,
  type FeasibilityBundleDto,
  type OpportunityDto,
  type OpportunityReadinessDto,
  type ProjectDraftDto
} from "./crmIntakeApiClient";
import type { AuditEventDto } from "./phase2ApiClient";

type CrmIntakeControlSurfaceProps = {
  apiClient: CrmIntakeApiClient;
  currentTenant: CurrentTenantDto;
  testUser: string;
};

type OpportunityFormState = {
  title: string;
  accountDisplayName: string;
  contactDisplayName: string;
  contactEmail: string;
  plannedStartDate: string;
  desiredFinishDate: string;
  expectedValue: string;
  probability: string;
  integrationsCount: string;
  modulesCount: string;
};

const defaultFormState: OpportunityFormState = {
  title: "Внедрение клиентского портала",
  accountDisplayName: "Новый клиент",
  contactDisplayName: "Мария Петрова",
  contactEmail: "maria.petrov@example.test",
  plannedStartDate: "2026-06-01",
  desiredFinishDate: "2026-06-30",
  expectedValue: "1200000",
  probability: "0.7",
  integrationsCount: "2",
  modulesCount: "4"
};

function hasPermission(currentTenant: CurrentTenantDto, permissionKey: string): boolean {
  return currentTenant.permissions.includes(permissionKey);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Не удалось выполнить действие";
}

function formatMoney(opportunity: OpportunityDto): string {
  return `${opportunity.expectedValue.amount.toLocaleString("ru-RU")} ${opportunity.expectedValue.currency}`;
}

function formatProbability(opportunity: OpportunityDto): string {
  return `${Math.round(opportunity.probability * 100)}%`;
}

function renderNextAction(nextAction: string): string {
  const labels: Record<string, string> = {
    complete_intake: "Заполнить недостающие данные",
    collect_missing_data: "Заполнить недостающие данные",
    run_feasibility: "Запустить оценку реализуемости",
    review_template_match: "Уточнить шаблон проекта"
  };

  return labels[nextAction] ?? nextAction;
}

const crmQueryKeys = {
  opportunities: (testUser: string) => ["crm-intake", testUser, "opportunities"] as const,
  readiness: (testUser: string, opportunityId: string) => ["crm-intake", testUser, "readiness", opportunityId] as const,
  feasibility: (testUser: string, opportunityId: string) => ["crm-intake", testUser, "feasibility", opportunityId] as const,
  draft: (testUser: string, opportunityId: string) => ["crm-intake", testUser, "project-draft", opportunityId] as const,
  audit: (testUser: string, opportunityId: string) => ["crm-intake", testUser, "audit", opportunityId] as const
};

export function CrmIntakeControlSurface({
  apiClient,
  currentTenant,
  testUser
}: CrmIntakeControlSurfaceProps) {
  const queryClient = useQueryClient();
  const [selectedOpportunityId, setSelectedOpportunityId] = useState("");
  const [formState, setFormState] = useState<OpportunityFormState>(defaultFormState);
  const [status, setStatus] = useState("Готово");
  const [pendingAction, setPendingAction] = useState<
    "load" | "create" | "createIncomplete" | "readiness" | "feasibility" | "draft" | null
  >(null);
  const canCreateOpportunity = hasPermission(currentTenant, "crm.opportunity.write");
  const canRunReadiness = hasPermission(currentTenant, "crm.readiness.run");
  const canRunFeasibility = hasPermission(currentTenant, "crm.feasibility.run");
  const canCreateDraft = hasPermission(currentTenant, "project_draft.create");
  const opportunitiesQuery = useQuery({
    queryKey: crmQueryKeys.opportunities(testUser),
    queryFn: () => apiClient.listOpportunities(testUser)
  });
  const opportunities = opportunitiesQuery.data ?? [];
  const selectedOpportunity = useMemo(
    () => opportunities.find((opportunity) => opportunity.id === selectedOpportunityId) ?? opportunities[0],
    [opportunities, selectedOpportunityId]
  );
  const selectedOpportunityQueryId = selectedOpportunity?.id ?? "";
  const readinessQuery = useQuery<OpportunityReadinessDto | undefined>({
    queryKey: crmQueryKeys.readiness(testUser, selectedOpportunityQueryId),
    queryFn: async () => undefined,
    enabled: false
  });
  const feasibilityQuery = useQuery<FeasibilityBundleDto | undefined>({
    queryKey: crmQueryKeys.feasibility(testUser, selectedOpportunityQueryId),
    queryFn: async () => undefined,
    enabled: false
  });
  const draftQuery = useQuery<ProjectDraftDto | null>({
    queryKey: crmQueryKeys.draft(testUser, selectedOpportunityQueryId),
    queryFn: async () => {
      if (!selectedOpportunity) return null;
      try {
        return await apiClient.getProjectDraft(testUser, projectDraftIdForOpportunity(selectedOpportunity.id));
      } catch {
        return null;
      }
    },
    enabled: selectedOpportunity !== undefined
  });
  const auditQuery = useQuery<AuditEventDto[]>({
    queryKey: crmQueryKeys.audit(testUser, selectedOpportunityQueryId),
    queryFn: () => (selectedOpportunity ? apiClient.listOpportunityAuditEvents(testUser, selectedOpportunity.id) : []),
    enabled: selectedOpportunity !== undefined
  });
  const selectedReadiness = readinessQuery.data;
  const selectedFeasibility = feasibilityQuery.data;
  const selectedDraft = draftQuery.data ?? undefined;
  const selectedAuditEvents = auditQuery.data ?? [];
  const selectedAuditReadbackStatus =
    auditQuery.isError ? `Аудит не подтвержден: ${getErrorMessage(auditQuery.error)}` : "Аудит по возможности пуст";

  const createOpportunityMutation = useMutation({
    mutationFn: (request: Parameters<CrmIntakeApiClient["createOpportunity"]>[1]) =>
      apiClient.createOpportunity(testUser, request),
    onSuccess: async (opportunity) => {
      await queryClient.invalidateQueries({ queryKey: crmQueryKeys.opportunities(testUser) });
      setSelectedOpportunityId(opportunity.id);
    }
  });
  const readinessMutation = useMutation({
    mutationFn: (opportunityId: string) => apiClient.runReadiness(testUser, opportunityId),
    onSuccess: (result, opportunityId) => {
      queryClient.setQueryData(crmQueryKeys.readiness(testUser, opportunityId), result.readiness);
    }
  });
  const feasibilityMutation = useMutation({
    mutationFn: (opportunityId: string) => apiClient.runFeasibility(testUser, opportunityId),
    onSuccess: (result, opportunityId) => {
      queryClient.setQueryData(crmQueryKeys.feasibility(testUser, opportunityId), result);
    }
  });
  const createDraftMutation = useMutation({
    mutationFn: (opportunityId: string) => apiClient.createProjectDraft(testUser, opportunityId),
    onSuccess: async (result, opportunityId) => {
      queryClient.setQueryData(crmQueryKeys.draft(testUser, opportunityId), result.projectDraft);
      await queryClient.invalidateQueries({ queryKey: crmQueryKeys.audit(testUser, opportunityId) });
    }
  });

  useEffect(() => {
    if (opportunitiesQuery.isFetching && opportunitiesQuery.data === undefined) {
      setPendingAction("load");
      return;
    }
    if (opportunitiesQuery.isError) {
      setPendingAction(null);
      setStatus(getErrorMessage(opportunitiesQuery.error));
      return;
    }
    if (opportunitiesQuery.isSuccess) {
      setPendingAction((current) => (current === "load" ? null : current));
      setStatus((current) => (current === "Готово" || current === "Создание возможности" ? "CRM-приемка загружена" : current));
      setSelectedOpportunityId((currentSelectedId) => {
        if (opportunities.some((opportunity) => opportunity.id === currentSelectedId)) {
          return currentSelectedId;
        }

        return opportunities[0]?.id ?? "";
      });
    }
  }, [opportunities, opportunitiesQuery.data, opportunitiesQuery.error, opportunitiesQuery.isError, opportunitiesQuery.isFetching, opportunitiesQuery.isSuccess]);

  function updateFormField(field: keyof OpportunityFormState, value: string) {
    setFormState((current) => ({
      ...current,
      [field]: value
    }));
  }

  async function createCompleteOpportunity() {
    if (pendingAction !== null) return;
    setPendingAction("create");
    setStatus("Создание возможности");
    try {
      const opportunity = await createOpportunityMutation.mutateAsync({
        title: formState.title,
        account: {
          displayName: formState.accountDisplayName
        },
        contacts: [
          {
            displayName: formState.contactDisplayName,
            email: formState.contactEmail,
            roleLabel: "Контакт проекта"
          }
        ],
        plannedStartDate: formState.plannedStartDate,
        desiredFinishDate: formState.desiredFinishDate,
        expectedValue: {
          amount: Number(formState.expectedValue),
          currency: "RUB"
        },
        probability: Number(formState.probability),
        categoryKey: "implementation",
        typologyKey: "integration_heavy",
        scopeHints: [
          {
            key: "integrations_count",
            label: "Количество интеграций",
            value: Number(formState.integrationsCount)
          },
          {
            key: "modules_count",
            label: "Количество модулей",
            value: Number(formState.modulesCount)
          }
        ],
        customFieldRefs: []
      });
      setSelectedOpportunityId(opportunity.id);
      setStatus("Возможность создана");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function createIncompleteOpportunity() {
    if (pendingAction !== null) return;
    setPendingAction("createIncomplete");
    setStatus("Создание возможности с блокерами");
    try {
      const opportunity = await createOpportunityMutation.mutateAsync({
        title: "Неполная возможность для приемки",
        plannedStartDate: "2026-06-01",
        desiredFinishDate: "2026-06-30",
        expectedValue: {
          amount: 500000,
          currency: "RUB"
        },
        probability: 0.4,
        categoryKey: "implementation",
        typologyKey: "integration_heavy",
        scopeHints: [],
        customFieldRefs: []
      });
      setSelectedOpportunityId(opportunity.id);
      setStatus("Возможность с блокерами создана");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function runReadiness() {
    if (!selectedOpportunity || pendingAction !== null) return;
    setPendingAction("readiness");
    setStatus("Проверка готовности");
    try {
      const result = await readinessMutation.mutateAsync(selectedOpportunity.id);
      setStatus(result.readiness.ready ? "Готово к оценке реализуемости" : "Есть блокеры приемки");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function runFeasibility() {
    if (!selectedOpportunity || pendingAction !== null) return;
    setPendingAction("feasibility");
    setStatus("Расчет реализуемости");
    try {
      const result = await feasibilityMutation.mutateAsync(selectedOpportunity.id);
      setStatus(result.feasibility.status === "fit" ? "Ресурсная оценка подходит" : "Есть перегрузка ресурсов");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  async function createProjectDraft() {
    if (!selectedOpportunity || pendingAction !== null) return;
    setPendingAction("draft");
    setStatus("Создание проектного черновика");
    try {
      await createDraftMutation.mutateAsync(selectedOpportunity.id);
      setStatus("Проектный черновик создан");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="crm-intake-surface" data-testid="crm-intake-surface">
      <div className="surface-heading">
        <div>
          <h2>CRM-приемка</h2>
          <p>Управляемый путь: зафиксировать возможность, снять блокеры, оценить реализуемость и создать черновик проекта.</p>
        </div>
        <p className="status-pill" data-testid="crm-intake-status">
          {status}
        </p>
      </div>

      <div className="crm-intake-layout">
        <section className="phase2-panel crm-opportunity-form" aria-label="Создание возможности">
          <h3>Новая возможность</h3>
          {canCreateOpportunity ? (
            <>
              <label className="field-stack">
                <span>Название</span>
                <input
                  aria-label="Название возможности"
                  onChange={(event) => updateFormField("title", event.target.value)}
                  value={formState.title}
                />
              </label>
              <div className="split-fields">
                <label className="field-stack">
                  <span>Клиент</span>
                  <input
                    aria-label="Клиент возможности"
                    onChange={(event) => updateFormField("accountDisplayName", event.target.value)}
                    value={formState.accountDisplayName}
                  />
                </label>
                <label className="field-stack">
                  <span>Контакт</span>
                  <input
                    aria-label="Контакт возможности"
                    onChange={(event) => updateFormField("contactDisplayName", event.target.value)}
                    value={formState.contactDisplayName}
                  />
                </label>
              </div>
              <label className="field-stack">
                <span>Email контакта</span>
                <input
                  aria-label="Email контакта"
                  onChange={(event) => updateFormField("contactEmail", event.target.value)}
                  value={formState.contactEmail}
                />
              </label>
              <div className="split-fields">
                <label className="field-stack">
                  <span>Старт</span>
                  <input
                    aria-label="Дата старта"
                    onChange={(event) => updateFormField("plannedStartDate", event.target.value)}
                    value={formState.plannedStartDate}
                  />
                </label>
                <label className="field-stack">
                  <span>Финиш</span>
                  <input
                    aria-label="Желаемый финиш"
                    onChange={(event) => updateFormField("desiredFinishDate", event.target.value)}
                    value={formState.desiredFinishDate}
                  />
                </label>
              </div>
              <div className="split-fields">
                <label className="field-stack">
                  <span>Бюджет</span>
                  <input
                    aria-label="Бюджет возможности"
                    onChange={(event) => updateFormField("expectedValue", event.target.value)}
                    value={formState.expectedValue}
                  />
                </label>
                <label className="field-stack">
                  <span>Вероятность</span>
                  <input
                    aria-label="Вероятность возможности"
                    onChange={(event) => updateFormField("probability", event.target.value)}
                    value={formState.probability}
                  />
                </label>
              </div>
              <div className="split-fields">
                <label className="field-stack">
                  <span>Интеграции</span>
                  <input
                    aria-label="Количество интеграций"
                    onChange={(event) => updateFormField("integrationsCount", event.target.value)}
                    value={formState.integrationsCount}
                  />
                </label>
                <label className="field-stack">
                  <span>Модули</span>
                  <input
                    aria-label="Количество модулей"
                    onChange={(event) => updateFormField("modulesCount", event.target.value)}
                    value={formState.modulesCount}
                  />
                </label>
              </div>
              <div className="button-row">
                <button disabled={pendingAction !== null} type="button" onClick={() => void createCompleteOpportunity()}>
                  Создать возможность
                </button>
                <button
                  className="secondary-button"
                  disabled={pendingAction !== null}
                  type="button"
                  onClick={() => void createIncompleteOpportunity()}
                >
                  Создать с блокерами
                </button>
              </div>
            </>
          ) : (
            <p className="readonly-notice">У пользователя нет права создавать возможности.</p>
          )}
        </section>

        <section className="phase2-panel">
          <h3>Возможности</h3>
          <div className="opportunity-list" data-testid="opportunity-list">
            {opportunitiesQuery.isFetching && opportunitiesQuery.data === undefined
              ? "Загрузка возможностей"
              : opportunities.length > 0
                ? opportunities.map((opportunity) => (
                  <button
                    className={opportunity.id === selectedOpportunity?.id ? "opportunity-card selected" : "opportunity-card"}
                    key={opportunity.id}
                    type="button"
                    onClick={() => setSelectedOpportunityId(opportunity.id)}
                  >
                    <span>{opportunity.title}</span>
                    <small>
                      {opportunity.plannedStartDate} - {opportunity.desiredFinishDate} · {formatMoney(opportunity)}
                    </small>
                  </button>
                  ))
                : "Возможностей пока нет"}
          </div>
        </section>

        <section className="phase2-panel selected-opportunity-panel">
          <h3>Карточка приемки</h3>
          {selectedOpportunity ? (
            <>
              <p className="selected-title" data-testid="selected-opportunity-title">
                {selectedOpportunity.title}
              </p>
              <dl className="compact-facts">
                <div>
                  <dt>Стадия</dt>
                  <dd>{selectedOpportunity.stageSystemKey}</dd>
                </div>
                <div>
                  <dt>Вероятность</dt>
                  <dd>{formatProbability(selectedOpportunity)}</dd>
                </div>
                <div>
                  <dt>Контакты</dt>
                  <dd>{selectedOpportunity.contactIds.length}</dd>
                </div>
                <div>
                  <dt>Признаки объема</dt>
                  <dd>{selectedOpportunity.scopeHints.length}</dd>
                </div>
              </dl>
            </>
          ) : (
            <p>Выберите возможность.</p>
          )}
        </section>

        <section className="phase2-panel" data-testid="readiness-panel">
          <h3>Готовность к анализу</h3>
          {canRunReadiness ? (
            <button disabled={!selectedOpportunity || pendingAction !== null} type="button" onClick={() => void runReadiness()}>
              Проверить готовность
            </button>
          ) : (
            <p className="readonly-notice">Проверка готовности недоступна по правам.</p>
          )}
          <p data-testid="readiness-next-action">
            {selectedReadiness ? renderNextAction(selectedReadiness.nextAction) : "Проверка еще не запускалась"}
          </p>
          <div className="compact-list" data-testid="readiness-blockers">
            {selectedReadiness
              ? selectedReadiness.blockers.length > 0
                ? selectedReadiness.blockers.map((blocker) => (
                    <span key={blocker.code}>
                      {blocker.code}: {blocker.message}
                    </span>
                  ))
                : "Блокеров нет"
              : "Нет результата"}
          </div>
        </section>

        <section className="phase2-panel" data-testid="feasibility-panel">
          <h3>Ресурсная реализуемость</h3>
          {canRunFeasibility ? (
            <button disabled={!selectedOpportunity || pendingAction !== null} type="button" onClick={() => void runFeasibility()}>
              Рассчитать реализуемость
            </button>
          ) : (
            <p className="readonly-notice">Расчет реализуемости недоступен по правам.</p>
          )}
          <p data-testid="feasibility-status">
            {selectedFeasibility
              ? `${selectedFeasibility.feasibility.status} / ${selectedFeasibility.feasibility.severity}`
              : "Расчет еще не запускался"}
          </p>
          <div className="compact-list" data-testid="demand-summary">
            {selectedFeasibility
              ? selectedFeasibility.demandEstimate.stageRoleDemands.map((demand) => (
                  <span key={`${demand.stageKey}-${demand.roleKey}`}>
                    {demand.stageLabel}: {demand.roleLabel} — {demand.plannedWorkHours} ч
                  </span>
                ))
              : "Нет оценки спроса"}
          </div>
          <div className="compact-list" data-testid="capacity-summary">
            {selectedFeasibility
              ? selectedFeasibility.feasibility.roleResults.map((roleResult) => (
                  <span key={roleResult.roleKey}>
                    {roleResult.roleLabel}: доступно {roleResult.availableHours} ч, нужно {roleResult.demandedHours} ч
                  </span>
                ))
              : "Нет оценки емкости"}
          </div>
        </section>

        <section className="phase2-panel" data-testid="project-draft-panel">
          <h3>Проектный черновик</h3>
          <button disabled={!selectedOpportunity || pendingAction !== null} type="button" onClick={() => void createProjectDraft()}>
            {canCreateDraft ? "Создать проектный черновик" : "Проверить запрет создания черновика"}
          </button>
          <p data-testid="project-draft-result">
            {selectedDraft ? `${selectedDraft.id}: ${selectedDraft.status}` : "Черновик еще не создан"}
          </p>
          <div className="compact-list" data-testid="opportunity-audit-events">
            {selectedAuditEvents.length > 0
              ? selectedAuditEvents.map((event) => (
                  <span key={event.id}>
                    {event.actionKey}: {event.actorId} - {event.target.entityId}
                  </span>
                ))
              : selectedAuditReadbackStatus}
          </div>
        </section>
      </div>
    </section>
  );
}
