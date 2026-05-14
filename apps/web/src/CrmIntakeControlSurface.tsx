import { useCallback, useEffect, useMemo, useState } from "react";

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

export function CrmIntakeControlSurface({
  apiClient,
  currentTenant,
  testUser
}: CrmIntakeControlSurfaceProps) {
  const [opportunities, setOpportunities] = useState<OpportunityDto[]>([]);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState("");
  const [formState, setFormState] = useState<OpportunityFormState>(defaultFormState);
  const [readinessByOpportunityId, setReadinessByOpportunityId] = useState<Record<string, OpportunityReadinessDto>>({});
  const [feasibilityByOpportunityId, setFeasibilityByOpportunityId] = useState<Record<string, FeasibilityBundleDto>>({});
  const [draftByOpportunityId, setDraftByOpportunityId] = useState<Record<string, ProjectDraftDto>>({});
  const [auditEventsByOpportunityId, setAuditEventsByOpportunityId] = useState<Record<string, AuditEventDto[]>>({});
  const [auditReadbackStatusByOpportunityId, setAuditReadbackStatusByOpportunityId] = useState<Record<string, string>>({});
  const [status, setStatus] = useState("Готово");
  const [pendingAction, setPendingAction] = useState<
    "load" | "create" | "createIncomplete" | "readiness" | "feasibility" | "draft" | null
  >(null);
  const canCreateOpportunity = hasPermission(currentTenant, "crm.opportunity.write");
  const canRunReadiness = hasPermission(currentTenant, "crm.readiness.run");
  const canRunFeasibility = hasPermission(currentTenant, "crm.feasibility.run");
  const canCreateDraft = hasPermission(currentTenant, "project_draft.create");
  const selectedOpportunity = useMemo(
    () => opportunities.find((opportunity) => opportunity.id === selectedOpportunityId) ?? opportunities[0],
    [opportunities, selectedOpportunityId]
  );
  const selectedReadiness = selectedOpportunity ? readinessByOpportunityId[selectedOpportunity.id] : undefined;
  const selectedFeasibility = selectedOpportunity ? feasibilityByOpportunityId[selectedOpportunity.id] : undefined;
  const selectedDraft = selectedOpportunity ? draftByOpportunityId[selectedOpportunity.id] : undefined;
  const selectedAuditEvents = selectedOpportunity ? auditEventsByOpportunityId[selectedOpportunity.id] ?? [] : [];
  const selectedAuditReadbackStatus = selectedOpportunity
    ? auditReadbackStatusByOpportunityId[selectedOpportunity.id] ?? "Аудит по возможности пуст"
    : "Аудит по возможности пуст";

  const loadOpportunityAudit = useCallback(
    async (opportunityId: string) => {
      try {
        const events = await apiClient.listOpportunityAuditEvents(testUser, opportunityId);
        setAuditEventsByOpportunityId((current) => ({
          ...current,
          [opportunityId]: events
        }));
        setAuditReadbackStatusByOpportunityId((current) => ({
          ...current,
          [opportunityId]: events.length > 0 ? "Аудит подтвержден" : "Аудит по возможности пуст"
        }));
      } catch (error) {
        setAuditEventsByOpportunityId((current) => ({
          ...current,
          [opportunityId]: []
        }));
        setAuditReadbackStatusByOpportunityId((current) => ({
          ...current,
          [opportunityId]: `Аудит не подтвержден: ${getErrorMessage(error)}`
        }));
      }
    },
    [apiClient, testUser]
  );

  const loadKnownProjectDrafts = useCallback(
    async (nextOpportunities: OpportunityDto[]) => {
      const readbacks = await Promise.allSettled(
        nextOpportunities.map(async (opportunity) => ({
          opportunityId: opportunity.id,
          projectDraft: await apiClient.getProjectDraft(testUser, projectDraftIdForOpportunity(opportunity.id))
        }))
      );
      const nextDrafts: Record<string, ProjectDraftDto> = {};
      for (const readback of readbacks) {
        if (readback.status === "fulfilled") {
          nextDrafts[readback.value.opportunityId] = readback.value.projectDraft;
        }
      }
      setDraftByOpportunityId(nextDrafts);
    },
    [apiClient, testUser]
  );

  const refreshOpportunities = useCallback(async () => {
    setPendingAction("load");
    try {
      const nextOpportunities = await apiClient.listOpportunities(testUser);
      setOpportunities(nextOpportunities);
      setSelectedOpportunityId((currentSelectedId) => {
        if (nextOpportunities.some((opportunity) => opportunity.id === currentSelectedId)) {
          return currentSelectedId;
        }

        return nextOpportunities[0]?.id ?? "";
      });
      await loadKnownProjectDrafts(nextOpportunities);
      setStatus("CRM-приемка загружена");
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }, [apiClient, loadKnownProjectDrafts, testUser]);

  useEffect(() => {
    void refreshOpportunities();
  }, [refreshOpportunities]);

  useEffect(() => {
    if (selectedOpportunity) {
      void loadOpportunityAudit(selectedOpportunity.id);
    }
  }, [loadOpportunityAudit, selectedOpportunity]);

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
      const opportunity = await apiClient.createOpportunity(testUser, {
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
      const nextOpportunities = await apiClient.listOpportunities(testUser);
      setOpportunities(nextOpportunities);
      setSelectedOpportunityId(opportunity.id);
      await loadKnownProjectDrafts(nextOpportunities);
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
      const opportunity = await apiClient.createOpportunity(testUser, {
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
      const nextOpportunities = await apiClient.listOpportunities(testUser);
      setOpportunities(nextOpportunities);
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
      const result = await apiClient.runReadiness(testUser, selectedOpportunity.id);
      setReadinessByOpportunityId((current) => ({
        ...current,
        [selectedOpportunity.id]: result.readiness
      }));
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
      const result = await apiClient.runFeasibility(testUser, selectedOpportunity.id);
      setFeasibilityByOpportunityId((current) => ({
        ...current,
        [selectedOpportunity.id]: result
      }));
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
      const result = await apiClient.createProjectDraft(testUser, selectedOpportunity.id);
      setDraftByOpportunityId((current) => ({
        ...current,
        [selectedOpportunity.id]: result.projectDraft
      }));
      await loadOpportunityAudit(selectedOpportunity.id);
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
            {opportunities.length > 0
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
