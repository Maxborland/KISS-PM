import type {
  ControlSignal,
  ControlSignalStatus,
  CorrectiveAction,
  KpiDefinition,
  KpiEvaluation,
  ManagementActionCandidate,
  PlanDelta,
  ProjectClosureSnapshot,
  RetrospectiveLesson,
  TemplateImprovementAction
} from "@kiss-pm/domain";

import { createRequestJson, DomainApiError } from "../../lib/domain-client";

/* ============================================================
   Клиент контура управления проектом (controlRoutes + retrospectiveRoutes).
   Только реальные серверные контракты: read-model, evaluate,
   preview→apply management action, статус сигнала, corrective action,
   read ретроспективы (closure). Contract-mock'а для контура нет —
   транспорт всегда боевой fetch (инъекция fetchImpl оставлена для юнитов).
   ============================================================ */

/** Журнальная запись запуска действия (project-scoped ответ read-model/preview/apply). */
export type ActionExecutionView = {
  id: string;
  actionType: string;
  targetEntity: { type: string; id: string };
  actorUserId: string;
  status: string;
  auditEventId: string | null;
  createdAt?: string;
};

export type ControlReadModel = {
  definitions: KpiDefinition[];
  evaluations: KpiEvaluation[];
  signals: ControlSignal[];
  correctiveActions: CorrectiveAction[];
  actionExecutions: ActionExecutionView[];
};

export type ControlEvaluateResponse = {
  evaluations: KpiEvaluation[];
  signals: ControlSignal[];
  actionCandidates: ManagementActionCandidate[];
  auditEventId: string;
};

export type ActionPreviewResponse = {
  action: ManagementActionCandidate;
  execution: ActionExecutionView;
  auditEventId: string;
};

export type ActionApplyResponse = {
  applied: PlanDelta;
  newPlanVersion: number;
  auditEventId: string;
  actionExecution: ActionExecutionView;
};

export type SignalStatusResponse = { signal: ControlSignal; auditEventId: string };

export type CorrectiveActionCreateInput = {
  title: string;
  description?: string;
  responsibleUserId?: string;
  dueDate?: string;
};

export type CorrectiveActionCreateResponse = {
  correctiveAction: CorrectiveAction;
  actionExecution: ActionExecutionView | null;
  auditEventId: string;
};

export type RetrospectiveView = {
  snapshot: ProjectClosureSnapshot | null;
  lessons: RetrospectiveLesson[];
  templateImprovementActions: TemplateImprovementAction[];
};

const projectBase = (projectId: string) => `/api/workspace/projects/${encodeURIComponent(projectId)}`;
const actionBase = (projectId: string, signalId: string, actionId: string) =>
  `${projectBase(projectId)}/control/signals/${encodeURIComponent(signalId)}/actions/${encodeURIComponent(actionId)}`;

export function createControlClient(options?: { fetchImpl?: typeof fetch }) {
  const requestJson = createRequestJson({
    apiOrigin: "",
    credentials: "same-origin",
    ...(options?.fetchImpl ? { fetchImpl: options.fetchImpl } : {})
  });

  return {
    /** GET read-model контура: KPI-определения, оценки, сигналы, corrective actions, журнал. */
    getReadModel: (projectId: string) =>
      requestJson<ControlReadModel>(`${projectBase(projectId)}/control/read-model`),

    /** POST evaluate: пересчёт KPI → новые оценки и сигналы (audit «kpi.evaluated»). */
    evaluate: (projectId: string) =>
      requestJson<ControlEvaluateResponse>(`${projectBase(projectId)}/control/evaluate`, {
        method: "POST"
      }),

    /** POST preview management action: ничего не меняет в плане, создаёт execution «previewed». */
    previewAction: (projectId: string, signalId: string, actionId: string) =>
      requestJson<ActionPreviewResponse>(`${actionBase(projectId, signalId, actionId)}/preview`, {
        method: "POST"
      }),

    /** POST apply management action: применяет planDelta одним коммитом (optimistic lock по planVersion). */
    applyAction: (projectId: string, signalId: string, actionId: string, clientPlanVersion: number) =>
      requestJson<ActionApplyResponse>(`${actionBase(projectId, signalId, actionId)}/apply`, {
        method: "POST",
        body: JSON.stringify({ clientPlanVersion })
      }),

    /** POST статус сигнала (open/acknowledged/resolved/accepted_risk — последний требует причину). */
    setSignalStatus: (
      projectId: string,
      signalId: string,
      status: ControlSignalStatus,
      acceptedRiskReason?: string
    ) =>
      requestJson<SignalStatusResponse>(
        `${projectBase(projectId)}/control/signals/${encodeURIComponent(signalId)}/status`,
        {
          method: "POST",
          body: JSON.stringify(acceptedRiskReason ? { status, acceptedRiskReason } : { status })
        }
      ),

    /** POST corrective action к сигналу (title обязателен, статус всегда open). */
    createCorrectiveAction: (
      projectId: string,
      signalId: string,
      input: CorrectiveActionCreateInput
    ) =>
      requestJson<CorrectiveActionCreateResponse>(
        `${projectBase(projectId)}/control/signals/${encodeURIComponent(signalId)}/corrective-actions`,
        { method: "POST", body: JSON.stringify(input) }
      ),

    /** GET ретроспектива закрытия (snapshot + уроки + улучшения шаблона); snapshot=null — проект не закрыт. */
    getRetrospective: (projectId: string) =>
      requestJson<RetrospectiveView>(`${projectBase(projectId)}/closure`)
  };
}

export type ControlClient = ReturnType<typeof createControlClient>;

/* ── Ошибки: сырой серверный код → честный RU-текст (код показываем рядом) ── */

export type ControlUiError = { code: string; message: string; status?: number };

const SESSION_REQUIRED_MESSAGE = "Сессия истекла. Войдите снова, чтобы продолжить";
const PERMISSION_MISSING_MESSAGE = "Недостаточно прав для контура управления проектом";
const TRANSPORT_FAILURE_MESSAGE = "Не удалось связаться с сервером. Проверьте подключение и повторите";

const CONTROL_ERROR_MESSAGES: Record<string, string> = {
  session_required: SESSION_REQUIRED_MESSAGE,
  unauthorized: SESSION_REQUIRED_MESSAGE,
  permission_missing: PERMISSION_MISSING_MESSAGE,
  forbidden: PERMISSION_MISSING_MESSAGE,
  project_not_found: "Проект не найден: возможно, он удалён или ссылка устарела",
  persistence_not_configured: "Сервис контура временно недоступен",
  transport_failure: TRANSPORT_FAILURE_MESSAGE,
  network_error: TRANSPORT_FAILURE_MESSAGE,
  invalid_json_response: "Сервер вернул некорректный ответ",
  plan_version_conflict: "План уже изменился. Данные обновлены, повторите действие",
  planning_precondition_failed: "Действие нельзя применить к текущему состоянию плана",
  action_candidate_not_found: "Предложенное действие устарело. Пересчитайте показатели",
  action_candidate_has_no_plan_delta: "У этого действия нет изменений плана для применения",
  control_signal_not_found: "Сигнал не найден: возможно, он пересоздан пересчётом",
  control_signal_status_invalid: "Недопустимый статус сигнала",
  accepted_risk_reason_required: "Укажите причину принятия риска",
  corrective_action_invalid: "Заполните название корректирующего действия",
  corrective_action_not_found: "Корректирующее действие не найдено",
  kpi_definition_invalid: "Определение KPI заполнено некорректно",
  closure_snapshot_not_found: "Проект ещё не закрыт — ретроспективы нет"
};

const STATUS_ERROR_MESSAGES: Record<number, string> = {
  401: SESSION_REQUIRED_MESSAGE,
  403: PERMISSION_MISSING_MESSAGE,
  404: "Данные не найдены: возможно, они удалены или ссылка устарела",
  409: "Данные уже изменились. Обновите страницу и повторите действие",
  501: "Сервис контура временно недоступен"
};

const FALLBACK_ERROR_MESSAGES: Record<string, string> = {
  load_failed: "Не удалось загрузить контур управления",
  evaluate_failed: "Не удалось пересчитать показатели",
  preview_failed: "Не удалось рассчитать предпросмотр действия",
  apply_failed: "Не удалось применить действие",
  status_failed: "Не удалось обновить статус сигнала",
  corrective_failed: "Не удалось создать корректирующее действие",
  retrospective_failed: "Не удалось загрузить ретроспективу",
  request_failed: "Не удалось выполнить запрос"
};

export function mapControlError(error: unknown, fallbackCode = "request_failed"): ControlUiError {
  const status = error instanceof DomainApiError ? error.status : undefined;
  const code =
    typeof error === "string"
      ? error
      : error instanceof DomainApiError
        ? error.code
        : error instanceof TypeError
          ? "transport_failure"
          : fallbackCode;
  const message =
    CONTROL_ERROR_MESSAGES[code] ??
    (status === undefined ? undefined : STATUS_ERROR_MESSAGES[status]) ??
    FALLBACK_ERROR_MESSAGES[code] ??
    FALLBACK_ERROR_MESSAGES[fallbackCode] ??
    FALLBACK_ERROR_MESSAGES.request_failed!;
  return { code, message, ...(status === undefined ? {} : { status }) };
}

export const controlErr = (code?: string): string =>
  mapControlError(code ?? "load_failed", "load_failed").message;
