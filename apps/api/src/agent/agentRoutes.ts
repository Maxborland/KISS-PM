import { randomUUID } from "node:crypto";

import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

import { canManageClients, canManageOpportunities, canManageProjects, type AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";

import type { ApiApp, ApiRouteDeps } from "../routeTypes";
import { invalidateCapacityCacheForTenant } from "../capacity/registerCapacityRoutes";
import { createUploadConcurrencyLimiter } from "../attachmentUploadRequest";
import { parseClientBody, parseDealStageChangeBody } from "../crmParsers";
import { readLimitedJsonBody } from "../jsonBody";
import { createPlanningReadModel } from "../planning/planningReadModel";
import { canReadPlanningReadModel } from "../planning/planningRouteAuth";
import { createTaskCommandWorkspace } from "../project-work/taskCommandWorkspace";
import { canEditTaskFields, canParticipateInTaskActivity, canParticipantTransitionTask } from "../project-work/taskCommandGuards";
import { evaluateOpportunityStageTransition } from "../projectIntakeService/changeOpportunityStageCommand";
import { isFinalOpportunityStatus } from "../projectIntakeService/opportunityStatus";
import { parseUpdateTaskBody } from "../projectWorkParsers";
import { parseClientIdParam, parseOpportunityIdParam } from "../routeParamParsers";
import { emitMessageCreated } from "../workspaceEventBus";
import { runAgentLoop, type AgentLoopEvent, type AnalyzeExecutor } from "./agentLoop";
import {
  agentThreadConfigured,
  agentThreadId,
  appendAgentTurn,
  capTraceSteps,
  ensureAgentThread,
  historyFromThreadMessages,
  proposalSnapshot,
  serializeAgentConversation
} from "./agentThread";
import { createAgentLlmProviderFromEnv } from "./llmProvider";
import { AGENT_TOOLS, allowedToolsForActor, findAgentTool, listToolAvailability, type AgentTool } from "./toolRegistry";

// Лимит одновременных LLM-циклов на (тенант:пользователь): без него аутентифицированный юзер
// скриптует параллельные /propose и жжёт платный LLM-бюджет (denial-of-wallet). 2 одновременно.
const agentLlmConcurrency = createUploadConcurrencyLimiter(2);

const AGENT_SYSTEM_PROMPT = [
  "Ты — ассистент-агент в системе управления проектами KISS-PM.",
  "Помогай сотруднику, используя ТОЛЬКО предоставленные инструменты — они уже отфильтрованы по",
  "его уровню доступа: ты не можешь делать то, что сотруднику не разрешено.",
  "Сначала используй analyze-инструменты (только чтение), чтобы понять ситуацию.",
  "Затем ПРЕДЛОЖИ конкретные действия через mutation-инструменты — они НЕ применяются сразу,",
  "сотрудник подтвердит каждое действие. Если предлагаешь создать/изменить/применить что-либо,",
  "обязательно вызови mutation-инструмент; нельзя просить подтверждение только текстом.",
  "Не выдумывай идентификаторы — бери их из результатов",
  "analyze. Объясняй кратко и по-русски."
].join(" ");

// analyze-инструменты, подключённые к данным/контракту. preview_resource_resolution
// исполняется вживую через governed-эндпоинт scenarios/preview (он стейджит сценарные run'ы,
// плана не меняет) — агент получает их id, чтобы предложить применение.
const WIRED_ANALYZE = new Set(["list_my_tasks", "read_project_plan", "detect_resource_overloads", "preview_resource_resolution", "list_task_statuses"]);
// Mutation-инструменты с ручным /execute. OFFERABLE_MUTATIONS — более узкий набор: только
// действия, для которых review-карточка уже показывает полный честный before/after.
const EXECUTABLE_MUTATIONS = new Set(["change_task_status", "comment_task", "create_task", "apply_resource_resolution", "apply_plan_commands"]);
// create_task и apply_resource_resolution стали offerable после появления полных
// payload-backed карточек (D2/D3); apply_plan_commands остаётся вне набора —
// его generic-preview («число команд») недостаточно честен для review.
// Н15: change_opportunity_stage и update_crm_client получили payload-backed
// карточки «было → станет» из текущего состояния и собственные execute-ветки.
const OFFERABLE_MUTATIONS = new Set([
  "change_task_status",
  "comment_task",
  "create_task",
  "apply_resource_resolution",
  "update_task",
  "change_opportunity_stage",
  "update_crm_client"
]);

// Поля, которые агент может частично обновлять в update_task: остальное (участники,
// статус) — отдельные инструменты; неизвестное поле в execute — fail-closed 400.
const UPDATE_TASK_FIELDS = new Set(["title", "description", "priority", "plannedStart", "plannedFinish", "plannedWork", "durationWorkingDays"]);

// Мёрж частичных fields поверх текущей задачи в ПОЛНОЕ тело governed PATCH.
// СТРУКТУРНОЕ ОГРАНИЧЕНИЕ: parseUpdateTaskBody дефолтит отсутствующие поля, поэтому
// каждое читаемое парсером поле обязано быть перечислено здесь явно — пропуск молча
// сбросит незатронутое поле в дефолт (прецедент: requiresAcceptance → false).
// Глубокое решение — честный partial-update в governed-слое; до него этот helper —
// единственная точка мёржа (используется и propose-карточкой, и execute).
// Типовой гард ПРИСУТСТВУЮЩИХ полей: parseUpdateTaskBody лоялен к нестроковым
// description/priority (нормализует в null/"normal"), поэтому без этого гарда
// карточка «описание → 123» молча ОЧИЩАЛА бы описание вместо fail-closed отказа.
// Границы/enum/целочисленность — зона парсера; здесь только типы значений.
function invalidUpdateTaskFieldType(fields: Record<string, unknown>): boolean {
  return Object.entries(fields).some(([field, value]) =>
    field === "plannedWork" || field === "durationWorkingDays"
      ? typeof value !== "number"
      : typeof value !== "string"
  );
}

function buildUpdateTaskPatchBody(
  task: {
    title: string;
    description: string | null;
    priority: string;
    plannedStart: Date;
    plannedFinish: Date;
    durationWorkingDays: number;
    plannedWork: number;
    requiresAcceptance: boolean;
    participants: ReadonlyArray<{ userId: string; role: string }>;
    statusId: string | null;
  },
  fields: Record<string, unknown>,
  clientUpdatedAt: string
): Record<string, unknown> {
  const description = "description" in fields ? fields.description : task.description;
  return {
    title: "title" in fields ? fields.title : task.title,
    ...(description !== null && description !== undefined ? { description } : {}),
    priority: "priority" in fields ? fields.priority : task.priority,
    plannedStart: "plannedStart" in fields ? fields.plannedStart : task.plannedStart.toISOString().slice(0, 10),
    plannedFinish: "plannedFinish" in fields ? fields.plannedFinish : task.plannedFinish.toISOString().slice(0, 10),
    durationWorkingDays: "durationWorkingDays" in fields ? fields.durationWorkingDays : task.durationWorkingDays,
    plannedWork: "plannedWork" in fields ? fields.plannedWork : task.plannedWork,
    requiresAcceptance: task.requiresAcceptance,
    participants: task.participants,
    statusId: task.statusId,
    clientUpdatedAt
  };
}

// Н15: поля, которые агент может частично обновлять в update_crm_client — ровно те,
// что читает governed-парсер parseClientBody (name/description/status). Описание
// инструмента раньше обещало email/phone/website/address — таких полей в контракте
// клиента НЕТ, execute их отвергает fail-closed (unsupported_update_field).
// Optimistic-lock у CRM-сущностей отсутствует: governed PATCH /clients/:id и
// PATCH /opportunities/:id/stage не принимают версию записи (updatedAt), поэтому
// review-карточка честно пишет «версия записи не проверяется», а execute идёт без
// preconditionVersions (в отличие от update_task/change_task_status).
const UPDATE_CLIENT_FIELDS = new Set(["name", "description", "status"]);

// Типовой гард ПРИСУТСТВУЮЩИХ полей (урок ревью #257): getOptionalString в
// parseClientBody лоялен к нестроковым значениям (молча превращает их в null/дефолт),
// поэтому без гарда карточка «описание → 123» молча ОЧИЩАЛА бы описание вместо
// fail-closed отказа. Enum статуса, длины и безопасность текста — зона парсера.
function invalidClientFieldType(fields: Record<string, unknown>): boolean {
  return Object.values(fields).some((value) => typeof value !== "string");
}

// Мёрж частичных fields поверх текущего клиента в ПОЛНОЕ тело governed PATCH.
// СТРУКТУРНОЕ ОГРАНИЧЕНИЕ (как у buildUpdateTaskPatchBody): parseClientBody дефолтит
// отсутствующие поля (description → null, status → active), поэтому каждое читаемое
// парсером поле обязано быть перечислено здесь явно — пропуск молча сбросил бы
// незатронутое поле в дефолт.
function buildClientPatchBody(
  client: { name: string; description: string | null; status: string },
  fields: Record<string, unknown>
): Record<string, unknown> {
  const description = "description" in fields ? fields.description : client.description;
  return {
    name: "name" in fields ? fields.name : client.name,
    ...(description !== null && description !== undefined ? { description } : {}),
    status: "status" in fields ? fields.status : client.status
  };
}

const CLIENT_FIELD_LABELS: Record<string, string> = {
  name: "название",
  description: "описание",
  status: "статус"
};

// Field-level пары «было/станет» для карточки и audit-превью update_crm_client.
// Структурные пары, а не парсинг форматированной строки (значение может содержать « → »);
// hasOwnProperty-гард — против ключей из Object.prototype (прецедент update_task).
function clientFieldChangePairs(
  client: { name: string; description: string | null; status: string },
  fields: Record<string, unknown>
): Array<{ before: string; after: string }> {
  const current: Record<string, string> = {
    name: client.name,
    description: client.description ?? "—",
    status: client.status
  };
  const capValue = (value: string) => value.length > 120 ? `${value.slice(0, 120)}…` : value;
  return Object.entries(fields).map(([field, next]) => {
    if (!Object.prototype.hasOwnProperty.call(CLIENT_FIELD_LABELS, field)) {
      // Неизвестное поле честно видно в карточке — execute его отвергнет (fail-closed).
      return { before: `${field}: не поддерживается`, after: `${field}: не поддерживается` };
    }
    const label = CLIENT_FIELD_LABELS[field]!;
    const value = capValue(current[field] ?? "—");
    return { before: `${label}: ${value}`, after: `${label}: ${value} → ${capValue(String(next))}` };
  });
}

export function isAgentToolOfferable(tool: AgentTool): boolean {
  return (Boolean(tool.binding) && tool.kind === "analyze")
    || (tool.kind === "mutation" && OFFERABLE_MUTATIONS.has(tool.name))
    || WIRED_ANALYZE.has(tool.name);
}

const OVERLOAD_CAP = 30; // ponytail: режем payload до топ-N перегрузок (по минутам), upgrade — пагинация если мало

const ATTACH_MAX_COUNT = 5;
const ATTACH_MAX_TOTAL_CHARS = 50_000; // ponytail: inline-контекст для LLM; крупнее — не тянем
// Текстовые типы. Плюс octet-stream/пустой MIME (частый случай для .md/.csv из браузера) пробуем
// прочитать и отбраковываем по эвристике бинарности (null-байт), а не по одному Content-Type.
const TEXT_MIME_RE = /^(text\/|application\/(json|ld\+json|xml|csv|x-yaml|yaml|markdown|x-ndjson))/i;
const MAYBE_TEXT_MIME_RE = /^(application\/octet-stream|$)/i;

type PreviewableAction = { tool: string; input: Record<string, unknown> };

/**
 * Контракт ручной правки карточки сверки (ревью F2).
 *
 * `after` у части действий — СВОДНАЯ фраза превью («Название» · проект «X» · даты · часы …),
 * а не значение поля. Клиент, посадив редактор на `after`, писал всю фразу в `input.title` —
 * задача создавалась с именем-предложением, и валидация 160 символов это пропускала.
 * Поэтому сервер сам объявляет, какое поле редактируемо и чему оно сейчас равно, а превью
 * раскладывает на `prefix + value + suffix`, чтобы клиент честно пересобрал отображение
 * после правки. Инвариант: `after === prefix + value + suffix`.
 */
export type AgentActionPreviewEditable = {
  /** Имя поля в `action.input`, которое реально уйдёт в execute. */
  field: string;
  /** Подпись поля для редактора (ru). */
  label: string;
  /** Текущее сырое значение поля — им и засевается редактор. */
  value: string;
  /** Неизменяемая часть превью до значения. */
  prefix: string;
  /** Неизменяемая часть превью после значения. */
  suffix: string;
};
export type AgentActionPreview = { before: string; after: string; editable?: AgentActionPreviewEditable };

/** Сборка превью с редактируемым полем — единственный источник инварианта after = prefix+value+suffix. */
function editablePreview(
  before: string,
  editable: { field: string; label: string; value: string; prefix?: string; suffix?: string }
): AgentActionPreview {
  const prefix = editable.prefix ?? "";
  const suffix = editable.suffix ?? "";
  return {
    before,
    after: `${prefix}${editable.value}${suffix}`,
    editable: { field: editable.field, label: editable.label, value: editable.value, prefix, suffix }
  };
}
export type AgentActionPreconditionVersions = { taskUpdatedAt?: string; planVersion?: number };

export async function buildProposalActionMetadata(
  dataSource: ApiRouteDeps["dataSource"],
  actor: TenantUser,
  profile: AccessProfile,
  action: PreviewableAction
): Promise<{
  title?: string;
  preview: AgentActionPreview;
  preconditionVersions: AgentActionPreconditionVersions;
  capability?: { allowed: boolean; reason: string };
}> {
  if (action.tool === "comment_task") {
    const taskId = typeof action.input.taskId === "string" ? action.input.taskId : "";
    const task = taskId ? await dataSource.findTaskById?.(actor.tenantId, taskId) : undefined;
    const canReadTaskMetadata = task && (
      canParticipateInTaskActivity(actor.id, task) ||
      canEditTaskFields(actor, profile, task).allowed
    );
    return {
      ...(canReadTaskMetadata && task
        ? { title: `Прокомментировать задачу: «${task.title}» · проект ${task.projectId}, задача ${task.id}` }
        : {}),
      // Деградированная ветка (нет права видеть счётчик комментариев) тоже объявляет
      // редактируемое поле: текст комментария принадлежит автору, и правка обязана
      // оставаться доступной — но править нужно input.body, а не отрисованное превью.
      preview: canReadTaskMetadata
        ? await buildActionPreview(dataSource, actor.tenantId, action)
        : editablePreview("Количество комментариев недоступно", {
            field: "body",
            label: "Текст комментария",
            value: typeof action.input.body === "string" ? action.input.body : ""
          }),
      preconditionVersions: {},
      ...(!canReadTaskMetadata
        ? { capability: { allowed: false, reason: "task_participant_required" } }
        : {})
    };
  }
  if (action.tool === "apply_plan_commands" || action.tool === "apply_resource_resolution") {
    const planRead = canReadPlanningReadModel({ actor, profile });
    if (!planRead.allowed) {
      const commandCount = Array.isArray(action.input.commands) ? action.input.commands.length : 1;
      return {
        preview: {
          before: "Версия плана недоступна",
          after: action.tool === "apply_plan_commands"
            ? `Команд плана: ${commandCount}`
            : "Применить проверенный сценарий"
        },
        preconditionVersions: {},
        capability: { allowed: false, reason: planRead.reason }
      };
    }
  }
  // D3: payload-backed карточка применения сценария — из persisted scenario run
  // (тот же источник, что и governed apply): профиль, последствия, TTL, версия плана.
  if (action.tool === "apply_resource_resolution") {
    const projectId = typeof action.input.projectId === "string" ? action.input.projectId : "";
    const scenarioId = typeof action.input.scenarioId === "string" ? action.input.scenarioId : "";
    const run = projectId && scenarioId
      ? await dataSource.findPlanningScenarioRun?.(actor.tenantId, projectId, scenarioId)
      : undefined;
    if (!run) {
      // Не найден = и «нет такого», и «чужой проект/тенант» — форма ответа одинаковая,
      // существование чужих run'ов не раскрываем.
      return {
        preview: { before: "Сценарий не найден или недоступен", after: "Постройте сценарии заново (preview_resource_resolution)" },
        preconditionVersions: {},
        capability: { allowed: false, reason: "scenario_not_found" }
      };
    }
    const payload = run.proposalPayload as Partial<import("@kiss-pm/domain").ScenarioProposal>;
    const target = run.targetConflict as { resourceId?: unknown; date?: unknown; overloadMinutes?: unknown };
    const explain = payload.explainability;
    if (run.appliedAt) {
      return {
        preview: { before: `План v${run.planVersion}`, after: "Сценарий уже применён — повторное применение невозможно" },
        preconditionVersions: {},
        capability: { allowed: false, reason: "scenario_already_applied" }
      };
    }
    if (run.rejectedAt) {
      return {
        preview: { before: `План v${run.planVersion}`, after: "Сценарий отклонён — применение невозможно, постройте сценарии заново" },
        preconditionVersions: {},
        capability: { allowed: false, reason: "scenario_rejected" }
      };
    }
    if (run.expiresAt.getTime() <= Date.now()) {
      return {
        preview: { before: `План v${run.planVersion}`, after: "Срок действия сценария истёк — постройте сценарии заново" },
        preconditionVersions: {},
        capability: { allowed: false, reason: "scenario_expired" }
      };
    }
    const commandCount = payload.planDelta?.commands?.length ?? 0;
    const conflictEffectLabel =
      payload.conflictEffect === "removed" ? "перегруз устранён"
      : payload.conflictEffect === "reduced" ? "перегруз снижен"
      : "перегруз принят как риск";
    const expiresHhMm = run.expiresAt.toISOString().slice(11, 16);
    // Entity-последствия обязаны быть видны ДО подтверждения: какие задачи и
    // назначения меняет сценарий, а не только счётчик команд.
    const listWithCap = (ids: string[], cap = 5) =>
      ids.length === 0 ? "" : ` (${ids.slice(0, cap).join(", ")}${ids.length > cap ? ` и ещё ${ids.length - cap}` : ""})`;
    const changedTaskIds = explain?.changedTaskIds ?? [];
    const changedAssignmentIds = explain?.changedAssignmentIds ?? [];
    return {
      title: `Применить сценарий разрешения перегрузки: профиль «${payload.profile ?? "?"}» · проект ${projectId}`,
      preview: {
        before: `План v${run.planVersion}; перегруз ${typeof target.overloadMinutes === "number" ? `${target.overloadMinutes} мин` : "—"} · ресурс ${typeof target.resourceId === "string" ? target.resourceId : "—"} · ${typeof target.date === "string" ? target.date : "—"}`,
        after: `Команд плана: ${commandCount}; ${conflictEffectLabel}`
          + `; задач затронуто: ${changedTaskIds.length}${listWithCap(changedTaskIds)}`
          + `; назначений: ${changedAssignmentIds.length}${listWithCap(changedAssignmentIds)}`
          + (explain && explain.deadlineDeltaDays !== 0 ? `; сдвиг финиша: ${explain.deadlineDeltaDays > 0 ? "+" : ""}${explain.deadlineDeltaDays} дн` : "")
          + (explain && explain.riskScore > 0 ? `; риск ${explain.riskScore}` : "")
          + (explain && explain.requiredApprovals.length > 0 ? `; согласования: ${explain.requiredApprovals.join(", ")}` : "")
          + `; действует до ${expiresHhMm} UTC`
      },
      // Версия плана — precondition применения: /execute требует её явно (A1, без
      // серверной подстановки); review-карточка показывает её пользователю.
      preconditionVersions: { planVersion: run.planVersion }
    };
  }
  // Честный частичный update_task: карточка показывает ТОЛЬКО изменяемые поля в виде
  // «поле: было → станет»; участники и статус не затрагиваются (мёрж на execute).
  if (action.tool === "update_task") {
    const taskId = typeof action.input.taskId === "string" ? action.input.taskId : "";
    const fields = (action.input.fields && typeof action.input.fields === "object" ? action.input.fields : {}) as Record<string, unknown>;
    const task = taskId ? await dataSource.findTaskById?.(actor.tenantId, taskId) : undefined;
    const canEdit = task ? canEditTaskFields(actor, profile, task).allowed : false;
    if (!task || !canEdit) {
      return {
        preview: { before: "Данные задачи недоступны", after: `Изменить поля: ${Object.keys(fields).join(", ") || "—"}` },
        preconditionVersions: {},
        capability: { allowed: false, reason: "task_edit_permission_required" }
      };
    }
    const FIELD_LABELS: Record<string, { label: string; current: () => string }> = {
      title: { label: "название", current: () => task.title },
      description: { label: "описание", current: () => task.description ?? "—" },
      priority: { label: "приоритет", current: () => task.priority },
      plannedStart: { label: "старт", current: () => task.plannedStart.toISOString().slice(0, 10) },
      plannedFinish: { label: "финиш", current: () => task.plannedFinish.toISOString().slice(0, 10) },
      plannedWork: { label: "работа (ч)", current: () => String(task.plannedWork) },
      durationWorkingDays: { label: "длительность (дн)", current: () => String(task.durationWorkingDays) }
    };
    const capValue = (value: string) => value.length > 120 ? `${value.slice(0, 120)}…` : value;
    // Структурные пары «было/станет»: before не восстанавливается парсингом
    // форматированной строки — значение поля может само содержать « → ».
    const changes = Object.entries(fields).map(([field, next]) => {
      // hasOwnProperty-гард: ключ вроде "toString" резолвился бы в член
      // Object.prototype и обходил ветку «не поддерживается», роняя current().
      const known = Object.prototype.hasOwnProperty.call(FIELD_LABELS, field) ? FIELD_LABELS[field] : undefined;
      // Неизвестное поле честно видно в карточке — execute его отвергнет (fail-closed).
      if (!known) return { before: `${field}: не поддерживается`, after: `${field}: не поддерживается` };
      const current = capValue(known.current());
      return { before: `${known.label}: ${current}`, after: `${known.label}: ${current} → ${capValue(String(next))}` };
    });
    // Карточка не обещает изменение, которое execute гарантированно отвергнет:
    // мёрж-тело валидируется ТЕМ ЖЕ парсером, что и governed PATCH (целые числа,
    // границы, длина названия, enum приоритета, порядок дат).
    const unsupportedField = Object.keys(fields).find((field) => !UPDATE_TASK_FIELDS.has(field));
    const invalidFieldType = invalidUpdateTaskFieldType(fields);
    const parsedBody = parseUpdateTaskBody(buildUpdateTaskPatchBody(task, fields, task.updatedAt.toISOString()));
    return {
      title: `Изменить задачу: «${task.title}» · проект ${task.projectId}, задача ${task.id}`,
      preview: {
        before: changes.length > 0 ? changes.map((change) => change.before).join("; ") : "Без изменений",
        after: changes.length > 0 ? changes.map((change) => change.after).join("; ") : "Поля не указаны"
      },
      // Версия задачи — обязательный precondition применения (fail-closed на execute).
      preconditionVersions: { taskUpdatedAt: task.updatedAt.toISOString() },
      ...(unsupportedField
        ? { capability: { allowed: false, reason: "unsupported_update_field" } }
        : invalidFieldType
          ? { capability: { allowed: false, reason: "invalid_update_field_value" } }
          : parsedBody.ok
            ? {}
            : { capability: { allowed: false, reason: parsedBody.error } })
    };
  }
  // Н15: payload-backed карточка изменения клиента — field-level diff из ТЕКУЩЕГО
  // состояния. Optimistic-lock у клиентов нет (governed PATCH не принимает версию) —
  // карточка честно говорит об этом, preconditionVersions пуст.
  if (action.tool === "update_crm_client") {
    const clientId = typeof action.input.clientId === "string" ? action.input.clientId : "";
    const fields = (action.input.fields && typeof action.input.fields === "object" ? action.input.fields : {}) as Record<string, unknown>;
    const canManage = canManageClients({ actor, profile, targetTenantId: actor.tenantId }).allowed;
    const client = canManage && clientId ? await dataSource.findClientById?.(actor.tenantId, clientId) : undefined;
    if (!client) {
      // «Нет прав» и «не найден» отвечают одинаково — существование клиентов не раскрываем.
      return {
        preview: { before: "Данные клиента недоступны", after: `Изменить поля: ${Object.keys(fields).join(", ") || "—"}` },
        preconditionVersions: {},
        capability: { allowed: false, reason: "client_manage_permission_required" }
      };
    }
    const changes = clientFieldChangePairs(client, fields);
    // Карточка не обещает изменение, которое execute гарантированно отвергнет:
    // мёрж-тело валидируется ТЕМ ЖЕ парсером, что и governed PATCH (длины, enum
    // статуса, безопасность текста).
    const unsupportedField = Object.keys(fields).find((field) => !UPDATE_CLIENT_FIELDS.has(field));
    const invalidFieldType = invalidClientFieldType(fields);
    const parsedBody = parseClientBody({ ...buildClientPatchBody(client, fields), id: client.id }, actor.tenantId);
    return {
      title: `Изменить клиента: «${client.name}» · клиент ${client.id}`,
      preview: {
        before: changes.length > 0 ? changes.map((change) => change.before).join("; ") : "Без изменений",
        after: `${changes.length > 0 ? changes.map((change) => change.after).join("; ") : "Поля не указаны"}; версия записи не проверяется`
      },
      preconditionVersions: {},
      ...(unsupportedField
        ? { capability: { allowed: false, reason: "unsupported_update_field" } }
        : invalidFieldType
          ? { capability: { allowed: false, reason: "invalid_update_field_value" } }
          : parsedBody.ok
            ? {}
            : { capability: { allowed: false, reason: parsedBody.error } })
    };
  }
  // Н15: payload-backed карточка смены стадии сделки — «было → станет» из текущего
  // состояния сделки и справочника стадий. Optimistic-lock у сделок отсутствует —
  // карточка честно говорит об этом, preconditionVersions пуст.
  if (action.tool === "change_opportunity_stage") {
    const opportunityId = typeof action.input.opportunityId === "string" ? action.input.opportunityId : "";
    const stageId = typeof action.input.stageId === "string" ? action.input.stageId : "";
    const canManage = canManageOpportunities({ actor, profile, targetTenantId: actor.tenantId }).allowed;
    const opportunity = canManage && opportunityId ? await dataSource.findOpportunityById?.(actor.tenantId, opportunityId) : undefined;
    if (!opportunity) {
      // «Нет прав» и «не найдена» отвечают одинаково — существование сделок не раскрываем.
      return {
        preview: { before: "Данные сделки недоступны", after: `Стадия: ${stageId || "—"}` },
        preconditionVersions: {},
        capability: { allowed: false, reason: "opportunity_manage_permission_required" }
      };
    }
    const [currentStage, targetStage] = await Promise.all([
      opportunity.stageId ? dataSource.findDealStageById?.(actor.tenantId, opportunity.stageId) : undefined,
      stageId ? dataSource.findDealStageById?.(actor.tenantId, stageId) : undefined
    ]);
    const currentLabel = currentStage?.name ?? opportunity.stageId ?? "без стадии";
    // Карточка не обещает переход, который execute гарантированно отвергнет:
    // невалидный id — кодом governed-парсера; финальный статус сделки и
    // несуществующая/архивная стадия — теми же причинами, что и governed-роут.
    const parsedStage = parseDealStageChangeBody({ stageId });
    // Правила перехода воронки (кросс-воронка, transition-rule, вероятность,
    // реализуемость) — тем же evaluateOpportunityStageTransition, что и governed
    // PATCH (ревью #262): иначе карточка звала бы одобрить переход, который
    // execute отвергнет. Проверяем только когда базовые условия прошли.
    const baseReason = !parsedStage.ok
      ? parsedStage.error
      : isFinalOpportunityStatus(opportunity.status)
        ? "opportunity_stage_locked"
        : !targetStage || targetStage.status !== "active"
          ? "deal_stage_not_found"
          : null;
    let transitionReason: string | null = null;
    if (!baseReason && targetStage && dataSource.listStageTransitions && dataSource.findDealStageById) {
      const guard = await evaluateOpportunityStageTransition(
        { findDealStageById: dataSource.findDealStageById, listStageTransitions: dataSource.listStageTransitions },
        actor.tenantId,
        opportunity,
        { id: targetStage.id, pipelineId: targetStage.pipelineId ?? null }
      );
      if (!guard.ok) transitionReason = guard.error;
    }
    const stageCapReason = baseReason ?? transitionReason;
    return {
      title: `Сменить стадию сделки: «${opportunity.title}» · сделка ${opportunity.id}`,
      preview: {
        before: `стадия: ${currentLabel}`,
        after: `стадия: ${currentLabel} → ${targetStage?.name ?? stageId}; версия записи не проверяется`
      },
      preconditionVersions: {},
      ...(stageCapReason ? { capability: { allowed: false, reason: stageCapReason } } : {})
    };
  }
  // D2: payload-backed карточка создания задачи — показывает ВСЁ, что реально будет
  // создано, включая серверные дефолты (даты/работа/участники) из execute-ветки.
  if (action.tool === "create_task") {
    const title = typeof action.input.title === "string" ? action.input.title : "";
    const projectId = typeof action.input.projectId === "string" ? action.input.projectId : "";
    const project = projectId
      ? (await dataSource.listProjects?.(actor.tenantId))?.find((candidate) => candidate.id === projectId)
      : undefined;
    const plannedStart = typeof action.input.plannedStart === "string" ? action.input.plannedStart : isoDate();
    const plannedFinish = typeof action.input.plannedFinish === "string" ? action.input.plannedFinish : plannedStart;
    const plannedWork = numberInput(action.input.plannedWork, 8);
    // ВСЕ поля, которые execute передаст в governed-роут, видны до подтверждения:
    // скрытые участники/приоритет/описание = одобрение вслепую (ревью #248).
    const priority = typeof action.input.priority === "string" ? action.input.priority : "normal";
    const rawParticipants = Array.isArray(action.input.participants) ? action.input.participants : [];
    const participantLabels = rawParticipants
      .map((entry) => {
        const record = (entry && typeof entry === "object" ? entry : {}) as { userId?: unknown; role?: unknown };
        if (typeof record.userId !== "string") return null;
        return typeof record.role === "string" ? `${record.userId} (${record.role})` : record.userId;
      })
      .filter((label): label is string => label !== null);
    const participants = participantLabels.length > 0
      ? `участники: ${participantLabels.slice(0, 5).join(", ")}${participantLabels.length > 5 ? ` и ещё ${participantLabels.length - 5}` : ""}`
      : "исполнитель: вы";
    const description = typeof action.input.description === "string" && action.input.description.trim().length > 0
      ? action.input.description.trim()
      : "";
    const descriptionPart = description
      ? `; описание: «${description.length > 120 ? `${description.slice(0, 120)}…` : description}»`
      : "";
    const projectLabel = project
      ? `проект «${project.title}»`
      : projectId
        ? `проект ${projectId} (не найден — создание завершится ошибкой)`
        : "входящая задача (без проекта)";
    return {
      title: `Создать задачу: «${title}»${project ? ` · проект «${project.title}»` : ""}`,
      // Редактируется ИМЕННО title, а не сводная фраза: раньше клиент писал всю фразу
      // целиком в input.title (ревью F2) — она укладывалась в лимит 160 символов и задача
      // создавалась с именем «„X“ · проект … · 8 ч · приоритет: normal · исполнитель: вы».
      preview: editablePreview("Задачи не существует", {
        field: "title",
        label: "Название задачи",
        value: title,
        prefix: "«",
        suffix: `» · ${projectLabel} · ${plannedStart} → ${plannedFinish} · ${plannedWork} ч · приоритет: ${priority} · ${participants}${descriptionPart}`
      }),
      preconditionVersions: {}
    };
  }
  if (action.tool !== "change_task_status") {
    return { preview: await buildActionPreview(dataSource, actor.tenantId, action), preconditionVersions: {} };
  }
  const taskId = typeof action.input.taskId === "string" ? action.input.taskId : "";
  const statusId = typeof action.input.statusId === "string" ? action.input.statusId : "";
  const [task, statuses] = await Promise.all([
    taskId ? dataSource.findTaskById?.(actor.tenantId, taskId) : undefined,
    dataSource.listTaskStatuses?.(actor.tenantId) ?? []
  ]);
  const canReadTaskMetadata = task && (
    canManageProjects({ actor, profile, targetTenantId: actor.tenantId }).allowed ||
    canParticipantTransitionTask(actor.id, task)
  );
  return {
    ...(canReadTaskMetadata && task
      ? { title: `Сменить статус задачи: «${task.title}» · проект ${task.projectId}, задача ${task.id}` }
      : {}),
    preview: {
      before: canReadTaskMetadata ? (task.statusName ?? task.statusId) : taskId,
      after: statuses.find((status) => status.id === statusId)?.name ?? statusId
    },
    preconditionVersions: canReadTaskMetadata ? { taskUpdatedAt: task.updatedAt.toISOString() } : {},
    ...(!canReadTaskMetadata
      ? { capability: { allowed: false, reason: "task_participant_role_required" } }
      : {})
  };
}

/**
 * Payload-backed preview used by both JSON/SSE proposals and execution audit.
 * Missing optional repositories degrade to explicit identifiers, never invented labels.
 */
export async function buildActionPreview(
  dataSource: ApiRouteDeps["dataSource"],
  tenantId: string,
  action: PreviewableAction
): Promise<AgentActionPreview> {
  const { input } = action;
  if (action.tool === "change_task_status") {
    const taskId = typeof input.taskId === "string" ? input.taskId : "";
    const statusId = typeof input.statusId === "string" ? input.statusId : "";
    const [task, statuses] = await Promise.all([
      taskId ? dataSource.findTaskById?.(tenantId, taskId) : undefined,
      dataSource.listTaskStatuses?.(tenantId) ?? []
    ]);
    return {
      before: task?.statusName ?? task?.statusId ?? taskId,
      after: statuses.find((status) => status.id === statusId)?.name ?? statusId
    };
  }
  if (action.tool === "comment_task") {
    const taskId = typeof input.taskId === "string" ? input.taskId : "";
    const activities = taskId
      ? await dataSource.listTaskActivities?.(tenantId, taskId)
      : undefined;
    const comments = activities?.filter((activity) => activity.type === "comment").length;
    // Тело комментария — само по себе значение поля: prefix/suffix пусты, но поле
    // объявлено явно, чтобы редактор писал в input.body, а не угадывал его по превью.
    return editablePreview(
      comments === undefined ? "Количество комментариев недоступно" : `Комментариев: ${comments}`,
      { field: "body", label: "Текст комментария", value: typeof input.body === "string" ? input.body : "" }
    );
  }
  if (action.tool === "create_task") {
    return editablePreview("Задача отсутствует", {
      field: "title",
      label: "Название задачи",
      value: typeof input.title === "string" ? input.title : ""
    });
  }
  if (action.tool === "apply_plan_commands" || action.tool === "apply_resource_resolution") {
    const projectId = typeof input.projectId === "string" ? input.projectId : "";
    const snapshot = projectId
      ? await dataSource.getPlanSnapshot?.(tenantId, projectId)
      : undefined;
    const commandCount = Array.isArray(input.commands) ? input.commands.length : 1;
    return {
      before: snapshot ? `Версия плана ${snapshot.planVersion}` : "Версия плана недоступна",
      after: action.tool === "apply_plan_commands"
        ? `Команд плана: ${commandCount}`
        : "Применить проверенный сценарий"
    };
  }
  // Н15: честные before/after для audit-провенанса CRM-мутаций агента —
  // из текущего состояния, а не generic-эхо входа.
  if (action.tool === "change_opportunity_stage") {
    const opportunityId = typeof input.opportunityId === "string" ? input.opportunityId : "";
    const stageId = typeof input.stageId === "string" ? input.stageId : "";
    const opportunity = opportunityId ? await dataSource.findOpportunityById?.(tenantId, opportunityId) : undefined;
    const [currentStage, targetStage] = await Promise.all([
      opportunity?.stageId ? dataSource.findDealStageById?.(tenantId, opportunity.stageId) : undefined,
      stageId ? dataSource.findDealStageById?.(tenantId, stageId) : undefined
    ]);
    return {
      before: currentStage?.name ?? opportunity?.stageId ?? opportunityId,
      after: targetStage?.name ?? stageId
    };
  }
  if (action.tool === "update_crm_client") {
    const clientId = typeof input.clientId === "string" ? input.clientId : "";
    const fields = (input.fields && typeof input.fields === "object" ? input.fields : {}) as Record<string, unknown>;
    const client = clientId ? await dataSource.findClientById?.(tenantId, clientId) : undefined;
    if (!client) {
      return { before: "Данные клиента недоступны", after: `Изменить поля: ${Object.keys(fields).join(", ") || "—"}` };
    }
    const changes = clientFieldChangePairs(client, fields);
    return {
      before: changes.length > 0 ? changes.map((change) => change.before).join("; ") : "Без изменений",
      after: changes.length > 0 ? changes.map((change) => change.after).join("; ") : "Поля не указаны"
    };
  }
  // Честный «после» для доменных mutation без выделенной ветки: раскрываем вложенный
  // input.fields (тело governed-роута) в пары «ключ: значение». Прежний фильтр брал
  // только string/number верхнего уровня — вложенный fields выпадал, карточка была
  // пустой, и пользователь подтверждал изменение вслепую.
  const fields = input.fields && typeof input.fields === "object" && !Array.isArray(input.fields)
    ? (input.fields as Record<string, unknown>)
    : null;
  const fieldPairs = fields ? serializePreviewPairs(fields, 1) : [];
  const scalarPairs = Object.entries(input)
    .filter(([key, value]) => key !== "fields" && (typeof value === "string" || typeof value === "number"))
    .map(([key, value]) => `${key}: ${String(value)}`);
  const after = [...fieldPairs, ...scalarPairs].join(" · ");
  return {
    before: "Текущее значение определяется целевым маршрутом",
    after: after.length > 0 ? after : "Поля не указаны"
  };
}

// Рекурсивная человекочитаемая сериализация значения для diff-карточки: вложенные
// объекты/массивы раскрываются в текст (с ограничением глубины и длины), чтобы «после»
// доменной mutation честно показывал реальные изменения, а не терял вложенный payload.
const PREVIEW_MAX_DEPTH = 3;
const PREVIEW_MAX_STR = 200;

function serializePreviewValue(value: unknown, depth: number): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value.length > PREVIEW_MAX_STR ? `${value.slice(0, PREVIEW_MAX_STR)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (depth >= PREVIEW_MAX_DEPTH) return `[${value.length}]`;
    return `[${value.map((item) => serializePreviewValue(item, depth + 1)).join(", ")}]`;
  }
  if (typeof value === "object") {
    if (depth >= PREVIEW_MAX_DEPTH) return "{…}";
    const pairs = serializePreviewPairs(value as Record<string, unknown>, depth + 1);
    return pairs.length > 0 ? `{ ${pairs.join("; ")} }` : "{}";
  }
  return String(value);
}

function serializePreviewPairs(record: Record<string, unknown>, depth: number): string[] {
  // hasOwnProperty-гард: ключ вроде "toString"/"__proto__" не должен затянуть член
  // прототипа в карточку (fail-safe, симметрично гарду update_task).
  return Object.entries(record)
    .filter(([key, value]) => Object.prototype.hasOwnProperty.call(record, key) && value !== undefined)
    .map(([key, value]) => `${key}: ${serializePreviewValue(value, depth)}`);
}

// Имя файла из content-disposition. filename*=UTF-8''… percent-декодируем (безопасно, с
// откатом на сырое при невалидном %); plain filename="…" берём как есть (литеральный %).
function attachmentName(disposition: string, fallback: string): string {
  const extended = /filename\*=(?:UTF-8'')?([^";]+)/i.exec(disposition);
  if (extended?.[1]) { try { return decodeURIComponent(extended[1]); } catch { return extended[1]; } }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain?.[1] ?? fallback;
}

// Читаем поток не более maxChars символов (не материализуя весь файл — upload допускает 25 МиБ).
async function readBoundedText(response: Response, maxChars: number): Promise<string> {
  if (maxChars <= 0) { await response.body?.cancel(); return ""; }
  if (!response.body) return (await response.text()).slice(0, maxChars);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
    if (text.length >= maxChars) { await reader.cancel(); break; }
  }
  text += decoder.decode(); // финальный flush: добираем хвостовой многобайтовый символ из буфера
  return text.slice(0, maxChars);
}

// Извлекаем содержимое приложенных файлов по id через ШТАТНЫЙ download-роут (внутренняя
// переотправка): RBAC/хранилище/audit переиспользуются. Текст извлекаем, бинарь помечаем.
// Сбой одного файла не валит весь батч; превышение бюджета честно маркируем.
export async function resolveAttachments(app: ApiApp, cookie: string | null, ids: string[]): Promise<Array<{ name: string; content: string }>> {
  const out: Array<{ name: string; content: string }> = [];
  const wanted = ids.slice(0, ATTACH_MAX_COUNT);
  let total = 0;
  let budgetDropped = 0; // файлы, опущенные из-за исчерпания символьного бюджета
  const push = (name: string, content: string) => { out.push({ name, content }); total += content.length; };
  for (let i = 0; i < wanted.length; i += 1) {
    if (total >= ATTACH_MAX_TOTAL_CHARS) { budgetDropped = wanted.length - i; break; }
    const id = wanted[i]!;
    try {
      const response = await app.request(`/api/workspace/attachments/${encodeURIComponent(id)}/download`, {
        method: "GET",
        headers: { "x-kiss-pm-action": "same-origin", ...(cookie ? { cookie } : {}) }
      });
      if (!response.ok) {
        // Недоступное вложение (RBAC/не найдено) маркируем честно, а не пропускаем
        // молча: иначе агент и пользователь принимают решение по неполному контексту.
        await response.body?.cancel();
        push(id, `(вложение недоступно: HTTP ${response.status} — содержимое не передано агенту)`);
        continue;
      }
      const mime = response.headers.get("content-type") ?? "";
      const name = attachmentName(response.headers.get("content-disposition") ?? "", id);
      if (!TEXT_MIME_RE.test(mime) && !MAYBE_TEXT_MIME_RE.test(mime)) {
        await response.body?.cancel();
        push(name, `(нетекстовый файл ${mime || "?"} — содержимое не извлечено)`);
        continue;
      }
      const content = await readBoundedText(response, ATTACH_MAX_TOTAL_CHARS - total);
      // Эвристика бинарности для octet-stream/без MIME: null-байт → не текст.
      if (content.includes(String.fromCharCode(0))) push(name, `(бинарный файл ${mime || "?"} — содержимое не извлечено)`);
      else push(name, content);
    } catch {
      // битый файл/декод — пропускаем, не роняя propose
    }
  }
  // Опущенные файлы (превышен лимит по числу ИЛИ по символам) честно маркируем — иначе агент
  // (и пользователь) принимали бы решение по неполному контексту, не зная об этом.
  const omitted = (ids.length - wanted.length) + budgetDropped;
  if (omitted > 0) {
    out.push({ name: "—", content: `(ещё ${omitted} файл(ов) опущено: лимит ${ATTACH_MAX_COUNT} вложений и ${ATTACH_MAX_TOTAL_CHARS} символов контекста)` });
  }
  return out;
}

// Не режем до ATTACH_MAX_COUNT здесь — иначе resolveAttachments не узнает истинное число и не
// сможет сообщить об опущенных. Лишь страхуемся верхним пределом от абьюза огромным массивом.
function parseAttachmentIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && id.length > 0).slice(0, 50);
}

// Сущность-якорь для провенанс-аудита агента: из входа действия.
function agentSourceEntity(input: Record<string, unknown>): { type: string; id: string } {
  if (typeof input.taskId === "string") return { type: "Task", id: input.taskId };
  if (typeof input.scenarioId === "string") return { type: "PlanningScenario", id: input.scenarioId };
  if (typeof input.projectId === "string") return { type: "Project", id: input.projectId };
  return { type: "AgentAction", id: "n/a" };
}

const HISTORY_MAX_TURNS = 12; // память чата: последние N реплик (защита от раздувания контекста)

/**
 * Во сколько раз больше СТРОК треда читать, чтобы набрать HISTORY_MAX_TURNS пригодных реплик
 * (ревью F5).
 *
 * Строка треда ≠ реплика для модели: один цикл propose+apply пишет 4 строки (цель, трейс,
 * ответ агента, квитанция исполнения), а historyFromThreadMessages выбрасывает трейсы и
 * error-квитанции. Раньше HISTORY_MAX_TURNS передавался как лимит СТРОК, и фильтрация шла
 * ПОСЛЕ отсечения — модель получала ~9 реплик вместо 12 (контекст молча ужимался на четверть
 * относительно клиентского пути). Читаем с запасом и режем уже пригодные реплики.
 */
const HISTORY_ROW_FETCH_MULTIPLIER = 4;
type AgentProviderStatus = { model: string; live: boolean; configured: boolean };

function agentProviderStatus(provider: { model: string }): AgentProviderStatus {
  // scripted-llm — детерминированный e2e-провайдер за двойным env-гейтом: канал
  // работоспособен (configured), но это не живой LLM — UI обязан показать деградацию.
  const live = provider.model !== "mock-llm" && provider.model !== "demo-llm" && provider.model !== "scripted-llm";
  return { model: provider.model, live, configured: provider.model !== "mock-llm" };
}

const isoDate = (date = new Date()): string => date.toISOString().slice(0, 10);
const numberInput = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;

function createAgentProviderRuntime() {
  const provider = createAgentLlmProviderFromEnv();
  return { provider, status: agentProviderStatus(provider) };
}

// История треда из тела: [{role|author, text}] → реплики LLM. henry/assistant → assistant.
function parseHistory(value: unknown): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(value)) return [];
  const turns: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const raw of value.slice(-HISTORY_MAX_TURNS)) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as { role?: unknown; author?: unknown; text?: unknown };
    const text = typeof item.text === "string" ? item.text.slice(0, 4000) : "";
    if (text.length === 0) continue;
    const tag = typeof item.role === "string" ? item.role : typeof item.author === "string" ? item.author : "user";
    turns.push({ role: tag === "assistant" || tag === "henry" ? "assistant" : "user", content: text });
  }
  return turns;
}

// Лимиты цикла из env (стоимость/время) с разумными дефолтами. 0/пусто → дефолт.
function agentLimitsFromEnv(): { maxIterations: number; maxTotalOutputTokens: number; timeoutMs: number } {
  const num = (value: string | undefined, fallback: number) => {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    maxIterations: num(process.env.KISS_PM_AGENT_MAX_ITERATIONS, 6),
    maxTotalOutputTokens: num(process.env.KISS_PM_AGENT_MAX_OUTPUT_TOKENS, 16_000),
    timeoutMs: num(process.env.KISS_PM_AGENT_TIMEOUT_MS, 60_000)
  };
}

/**
 * Внутренняя переотправка в тот же Hono-app — агент НЕ дублирует governed-логику, а зовёт те же
 * эндпоинты планирования (scenarios/preview, scenarios/:id/apply, apply-command-batch), что и
 * человеческий UI: RBAC, транзакция, version-lock, integrity и audit переиспользуются как есть.
 */
async function dispatchInternal(app: ApiApp, cookie: string | null, path: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await app.request(path, {
    method,
    headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  if (text.length > 0) {
    try { const json: unknown = JSON.parse(text); if (json && typeof json === "object" && !Array.isArray(json)) parsed = json as Record<string, unknown>; } catch { /* keep {} */ }
  }
  return { status: response.status, body: parsed };
}

// Generic-исполнитель декларативных инструментов (binding): переотправляет в governed-роут
// нужным методом/путём/телом. Один путь для всех CRM/comms/admin/projects-инструментов.
async function dispatchBinding(app: ApiApp, cookie: string | null, binding: NonNullable<AgentTool["binding"]>, input: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  const hasBody = binding.method === "POST" || binding.method === "PATCH";
  const response = await app.request(binding.path(input), {
    method: binding.method,
    headers: { "content-type": "application/json", "x-kiss-pm-action": "same-origin", ...(cookie ? { cookie } : {}) },
    ...(hasBody ? { body: JSON.stringify(binding.body ? binding.body(input) : {}) } : {})
  });
  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  if (text.length > 0) {
    try { const json: unknown = JSON.parse(text); if (json && typeof json === "object" && !Array.isArray(json)) parsed = json as Record<string, unknown>; } catch { /* keep {} */ }
  }
  return { status: response.status, body: parsed };
}

async function resolvePlanVersion(deps: ApiRouteDeps, tenantId: string, projectId: string, given: unknown): Promise<number | undefined> {
  if (typeof given === "number") return given;
  if (!deps.dataSource.getPlanSnapshot) return undefined;
  const snapshot = await deps.dataSource.getPlanSnapshot(tenantId, projectId);
  return snapshot?.planVersion;
}

export function buildAnalyzeExecutor(deps: ApiRouteDeps, app: ApiApp, cookie: string | null, actorTenantId: string, actorUserId: string): AnalyzeExecutor {
  return async (tool: AgentTool, input: Record<string, unknown>) => {
    if (tool.name === "list_my_tasks") {
      if (!deps.dataSource.listMyWorkTasks) return { tasks: [], note: "persistence_not_configured" };
      const tasks = await deps.dataSource.listMyWorkTasks(actorTenantId, actorUserId);
      return {
        tasks: tasks.map((task) => ({ id: task.id, title: task.title, statusId: task.statusId, projectId: task.projectId, priority: task.priority }))
      };
    }

    if (tool.name === "list_task_statuses") {
      // Справочник статусов задач тенанта: LLM берёт валидный statusId для
      // change_task_status, а не галлюцинирует. Только активные статусы —
      // перевод в архивный execute всё равно отвергнет.
      if (!deps.dataSource.listTaskStatuses) return { statuses: [], note: "persistence_not_configured" };
      const statuses = await deps.dataSource.listTaskStatuses(actorTenantId);
      return {
        statuses: statuses
          .filter((status) => status.status === "active")
          .map((status) => ({ id: status.id, name: status.name, category: status.category }))
      };
    }

    if (tool.name === "read_project_plan") {
      const projectId = typeof input.projectId === "string" ? input.projectId : "";
      if (!projectId) return { note: "projectId_required" };
      if (!deps.dataSource.getPlanSnapshot) return { note: "persistence_not_configured" };
      const snapshot = await deps.dataSource.getPlanSnapshot(actorTenantId, projectId);
      if (!snapshot) return { note: "project_not_found", projectId };
      const readModel = createPlanningReadModel(snapshot);
      return {
        projectId,
        planVersion: readModel.planVersion,
        tasks: readModel.authored.tasks.map((task) => ({ id: task.id, title: task.title })),
        overloadCount: readModel.resourceLoad.overloads.length,
        overloads: readModel.resourceLoad.overloads
          .slice(0, OVERLOAD_CAP)
          .map((overload) => ({ resourceId: overload.resourceId, date: overload.date, overloadMinutes: overload.overloadMinutes, taskIds: overload.taskIds }))
      };
    }

    if (tool.name === "detect_resource_overloads") {
      if (!deps.dataSource.getPlanSnapshot) return { note: "persistence_not_configured", overloads: [] };
      const wanted = typeof input.projectId === "string" && input.projectId ? input.projectId : null;
      const projectIds = wanted
        ? [wanted]
        : deps.dataSource.listProjects
          ? (await deps.dataSource.listProjects(actorTenantId)).map((project) => project.id)
          : [];
      const overloads: Array<{ projectId: string; resourceId: string; date: string; overloadMinutes: number; taskIds: string[] }> = [];
      for (const projectId of projectIds) {
        const snapshot = await deps.dataSource.getPlanSnapshot(actorTenantId, projectId);
        if (!snapshot) continue;
        const readModel = createPlanningReadModel(snapshot);
        for (const overload of readModel.resourceLoad.overloads) {
          overloads.push({ projectId, resourceId: overload.resourceId, date: overload.date, overloadMinutes: overload.overloadMinutes, taskIds: overload.taskIds });
        }
      }
      overloads.sort((left, right) => right.overloadMinutes - left.overloadMinutes);
      return { overloadCount: overloads.length, overloads: overloads.slice(0, OVERLOAD_CAP) };
    }

    if (tool.name === "preview_resource_resolution") {
      const projectId = typeof input.projectId === "string" ? input.projectId : "";
      const target = input.target && typeof input.target === "object" ? (input.target as Record<string, unknown>) : null;
      if (!projectId || !target) return { note: "projectId_and_target_required" };
      const clientPlanVersion = await resolvePlanVersion(deps, actorTenantId, projectId, input.clientPlanVersion);
      if (clientPlanVersion === undefined) return { note: "project_not_found", projectId };
      // Единственный поддерживаемый тип цели — перегрузка ресурса; инжектим, LLM его не передаёт.
      const fullTarget = { type: "resource_overload", ...target };
      const res = await dispatchInternal(app, cookie, `/api/workspace/projects/${projectId}/planning/scenarios/preview`, { clientPlanVersion, target: fullTarget });
      if (res.status !== 200) return { note: "preview_failed", status: res.status, error: res.body.error };
      const proposals = Array.isArray(res.body.proposals) ? (res.body.proposals as Array<Record<string, unknown>>) : [];
      // Для apply агенту нужны: id сценария + clientPlanVersion. Объяснимость — кратко.
      return {
        projectId,
        clientPlanVersion: res.body.planVersion ?? clientPlanVersion,
        expiresAt: res.body.expiresAt,
        proposals: proposals.map((proposal) => ({
          scenarioId: proposal.id,
          profile: proposal.profile,
          conflictEffect: proposal.conflictEffect,
          explainability: proposal.explainability
        }))
      };
    }

    // Декларативные analyze-инструменты (CRM/comms/admin/projects-чтение) — generic-редиспатч.
    if (tool.binding && tool.kind === "analyze") {
      const res = await dispatchBinding(app, cookie, tool.binding, input);
      if (res.status >= 400) return { note: "read_failed", status: res.status, error: res.body.error };
      return res.body;
    }

    throw new Error("analyze_tool_not_wired");
  };
}

/**
 * Маршруты агента (P-agent).
 * Slice 1: GET /tools. Slice 2: POST /propose (LLM-цикл, analyze live, mutation как предложения).
 * Slice 3 добавит POST /execute (governed apply) + analyze план/ресурсов.
 */
export function registerAgentRoutes(app: ApiApp, deps: ApiRouteDeps) {
  app.get("/api/workspace/agent/tools", async (context) => {
    const actor = await deps.getSessionActorFromHeaders(context.req.header("cookie") ?? null);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const profile = await deps.getActorProfile(actor);
    // provider — честный статус LLM-канала инсталляции: demo/mock-модель означает,
    // что агент отвечает заглушкой, и UI обязан показать деградацию (G7-01).
    const { status } = createAgentProviderRuntime();
    return context.json({ tools: listToolAvailability(actor, profile), provider: status });
  });

  // Общая преамбула /propose и /propose/stream (auth + разбор тела) — единый источник правды,
  // чтобы валидация не разъезжалась между JSON- и SSE-эндпоинтами. На ошибке отдаёт готовый Response.
  type ProposeRequest = { cookie: string | null; actor: TenantUser; profile: AccessProfile; goal: string; attachmentIds: string[]; history: Array<{ role: "user" | "assistant"; content: string }>; threadId?: string };
  async function parseProposeRequest(context: Context): Promise<{ ok: true; value: ProposeRequest } | { ok: false; response: Response }> {
    const cookie = context.req.header("cookie") ?? null;
    const actor = await deps.getSessionActorFromHeaders(cookie);
    if (!actor) return { ok: false, response: context.json({ error: "session_required" }, 401) };
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return { ok: false, response: context.json({ error: body.error }, body.status) };
    const goal = typeof (body.value as { goal?: unknown }).goal === "string" ? (body.value as { goal: string }).goal.trim() : "";
    if (goal.length === 0 || goal.length > 2000) return { ok: false, response: context.json({ error: "invalid_goal" }, 400) };
    const attachmentIds = parseAttachmentIds((body.value as { attachmentIds?: unknown }).attachmentIds);
    const history = parseHistory((body.value as { history?: unknown }).history);
    // threadId опционален (контракт P1): клиент, знающий свой персистентный тред, просит
    // сервер собрать историю из него. Чужой/произвольный id — жёсткий отказ (fail-closed).
    // Валидация — владением, а не сравнением с детерминированным id: ensureConversation
    // upsert'ится по (tenant, entityType, entityId, type), и существующий/импортированный
    // тред может жить под другим id, который GET /agent/thread честно вернул клиенту.
    const threadIdRaw = (body.value as { threadId?: unknown }).threadId;
    const threadId = typeof threadIdRaw === "string" && threadIdRaw.length > 0 ? threadIdRaw : undefined;
    if (threadId !== undefined && threadId !== agentThreadId(actor.id)) {
      const conversation = await deps.dataSource.findConversation?.(actor.tenantId, threadId);
      const ownedAgentThread = conversation
        && conversation.conversationType === "agent"
        && conversation.entityType === "agent"
        && conversation.entityId === actor.id;
      if (!ownedAgentThread) {
        return { ok: false, response: context.json({ error: "agent_thread_forbidden" }, 403) };
      }
    }
    const profile = await deps.getActorProfile(actor);
    return { ok: true, value: { cookie, actor, profile, goal, attachmentIds, history, ...(threadId ? { threadId } : {}) } };
  }

  // Ядро предложения — общее для /propose (JSON) и /propose/stream (SSE).
  async function runProposeLoop(
    request: ProposeRequest,
    provider: ReturnType<typeof createAgentLlmProviderFromEnv>,
    onEvent?: (event: AgentLoopEvent) => void | Promise<void>
  ) {
    const { cookie, actor, profile, goal, attachmentIds } = request;
    // Источник истины истории при переданном threadId — персистентный тред (сервер),
    // а не реконструкция из UI-стейта клиента; error-квитанции в контекст не попадают.
    let history = request.history;
    if (request.threadId && deps.dataSource.listDiscussionMessages) {
      const threadMessages = await deps.dataSource.listDiscussionMessages({
        tenantId: actor.tenantId,
        conversationId: request.threadId,
        // Лимит СТРОК с запасом: трейсы и error-квитанции отфильтруются, поэтому пригодных
        // реплик из этого окна выйдет меньше — режем их после фильтра, а не до (ревью F5).
        limit: HISTORY_MAX_TURNS * HISTORY_ROW_FETCH_MULTIPLIER
      });
      history = historyFromThreadMessages(threadMessages).slice(-HISTORY_MAX_TURNS);
    }
    const allowed = allowedToolsForActor(actor, profile);
    // LLM получает read-only binding-и и только mutation с честным preview + реальным execute.
    // Остальные binding-mutation не предлагаем, пока review-карточка не умеет показать их payload.
    const offered = allowed.filter(isAgentToolOfferable);
    const attachments = attachmentIds.length > 0 ? await resolveAttachments(app, cookie, attachmentIds) : [];
    const result = await runAgentLoop({
      provider,
      system: AGENT_SYSTEM_PROMPT,
      goal,
      tools: offered,
      executeAnalyze: buildAnalyzeExecutor(deps, app, cookie, actor.tenantId, actor.id),
      limits: agentLimitsFromEnv(),
      ...(attachments.length > 0 ? { attachments } : {}),
      ...(history.length > 0 ? { history } : {}),
      ...(onEvent ? { onEvent } : {})
    });
    // Аннотируем предложения грубым capability (точная проверка — при /execute).
    const capabilityByTool = new Map(AGENT_TOOLS.map((tool) => [tool.name, tool.capability({ actor, profile })]));
    const proposedActions = await Promise.all(result.proposedActions.map(async (action) => {
      const metadata = await buildProposalActionMetadata(deps.dataSource, actor, profile, action);
      return {
        ...action,
        capability: capabilityByTool.get(action.tool) ?? { allowed: false, reason: "permission_missing" },
        ...metadata
      };
    }));
    return {
      goal,
      model: result.model,
      reasoning: result.reasoning,
      analyzeResults: result.analyzeResults,
      proposedActions,
      iterations: result.iterations,
      stopReason: result.stopReason,
      outputTokens: result.outputTokens
    };
  }

  // Персистентность хода propose (P1): user-реплика и ответ агента пишутся сервером в
  // тред пользователя; при недоступном LLM квитанция тоже персистится (семантика #244,
  // теперь переживает reload). Без collaboration-персистентности — честно ничего
  // (messageIds в ответе нет), fake persistence с клиента запрещена.
  type ProposePersistOutcome =
    | { kind: "provider_unavailable"; providerModel: string }
    // Апстрим агента упал (сеть/таймаут/5xx/квота). Ход тоже персистится: иначе
    // транзиентный сбой ТЕРЯЛ набранную пользователем цель при reload, тогда как всего лишь
    // ненастроенный провайдер её сохранял (ревью F3). Текст квитанции — стабильный,
    // без сырого тела апстрима.
    | { kind: "upstream_failed" }
    | { kind: "success"; result: Awaited<ReturnType<typeof runProposeLoop>>; traceSteps?: string[] };
  // Идемпотентность записи цели в пределах одного запроса (ключ — объект ProposeRequest,
  // он создаётся заново на каждый HTTP-вход, так что между запросами ничего не течёт).
  const persistedGoalByRequest = new WeakMap<ProposeRequest, string>();
  async function persistProposeTurns(
    request: ProposeRequest,
    outcome: ProposePersistOutcome
  ): Promise<{ threadId: string; messageIds: string[]; traceMessageId?: string } | null> {
    if (!agentThreadConfigured(deps.dataSource)) return null;
    const conversation = await ensureAgentThread(deps.dataSource, request.actor);
    // Каждый персистентный ход эмитится в канал беседы: вторая вкладка/подписчики
    // видят живые сообщения тем же message.created, что и обычные беседы.
    const persistTurn = async (body: string, agent: Parameters<typeof appendAgentTurn>[4], attachmentIds?: string[]) => {
      const turn = await appendAgentTurn(deps.dataSource, request.actor, conversation.id, body, agent, attachmentIds);
      emitMessageCreated(conversation.id, turn.serialized);
      return turn.id;
    };
    const messageIds: string[] = [];
    let traceMessageId: string | undefined;
    // Цель пишется РОВНО один раз на запрос: повторный вход в персистенцию (частичный
    // сбой записи, любой будущий retry) переиспользует уже записанный user-ход, а не
    // дублирует реплику пользователя в треде.
    const goalMessageId = persistedGoalByRequest.get(request)
      ?? await persistTurn(request.goal, { role: "user" }, request.attachmentIds);
    persistedGoalByRequest.set(request, goalMessageId);
    messageIds.push(goalMessageId);
    if (outcome.kind === "provider_unavailable") {
      messageIds.push(await persistTurn(
        `LLM-провайдер не настроен (провайдер ${outcome.providerModel}) — задайте OPENROUTER_API_KEY или ANTHROPIC_API_KEY на сервере.`,
        { role: "agent", kind: "error" }
      ));
    } else if (outcome.kind === "upstream_failed") {
      messageIds.push(await persistTurn(
        "Не удалось получить ответ от LLM — попробуйте повторить запрос. Детали сбоя записаны в серверный лог.",
        { role: "agent", kind: "error" }
      ));
    } else {
      const result = outcome.result;
      // Трейс — между репликой и ответом (как в live-виде): история хода агента
      // переживает reload; в history для LLM трейс не попадает (см. agentThread).
      if (outcome.traceSteps && outcome.traceSteps.length > 0) {
        traceMessageId = await persistTurn(
          `Ход агента: шагов ${outcome.traceSteps.length}.`,
          { role: "trace", steps: capTraceSteps(outcome.traceSteps) }
        );
      }
      const bodyText = result.reasoning.trim().length > 0
        ? result.reasoning
        : result.proposedActions.length > 0
          ? `Предложений: ${result.proposedActions.length}.`
          : "Предложений нет.";
      messageIds.push(await persistTurn(bodyText, { role: "agent", proposal: proposalSnapshot(result) }));
    }
    return { threadId: conversation.id, messageIds, ...(traceMessageId ? { traceMessageId } : {}) };
  }

  /**
   * Общий хвост обоих провальных путей propose (JSON и SSE): деталь сбоя — только в
   * серверный лог, в тред — стабильная квитанция, наружу — стабильный код (ревью F3).
   * Сама персистенция не должна маскировать исходный сбой: её ошибку логируем и
   * возвращаем null (ответ клиенту всё равно уйдёт как 502/error-эвент).
   */
  /**
   * Персистенция УСПЕШНОГО хода. Её сбой означает «не смогли записать результат», а НЕ
   * «LLM не ответил», и наружу как сбой LLM не всплывает.
   *
   * Раньше исключение отсюда ловил общий catch роута и повторно звал persistProposeTurns
   * уже как upstream_failed: цель писалась второй раз, а реальный ответ модели подменялся
   * квитанцией «Не удалось получить ответ от LLM» — пользователь видел своё сообщение
   * дважды, а полученный ответ терялся. Теперь ответ уходит клиенту как есть, с честным
   * признаком persistFailed (id-шников для дедупликации в этом случае просто нет).
   */
  async function persistProposeSuccess(
    request: ProposeRequest,
    result: Awaited<ReturnType<typeof runProposeLoop>>,
    traceSteps: string[]
  ): Promise<{ threadId: string; messageIds: string[]; traceMessageId?: string } | { persistFailed: true } | null> {
    try {
      return await persistProposeTurns(request, { kind: "success", result, traceSteps });
    } catch (error) {
      console.error("agent_propose_success_persist_failed", error);
      return { persistFailed: true };
    }
  }

  async function persistProposeFailure(
    request: ProposeRequest,
    error: unknown
  ): Promise<{ threadId: string; messageIds: string[] } | null> {
    console.error("agent_propose_upstream_failed", error);
    try {
      return await persistProposeTurns(request, { kind: "upstream_failed" });
    } catch (persistError) {
      console.error("agent_propose_failure_persist_failed", persistError);
      return null;
    }
  }

  // Серверная сборка меток трейса — тем же форматом, что live-лейблы клиента:
  // персистентный трейс после reload выглядит как только что показанный.
  function traceLabelFromEvent(event: AgentLoopEvent): string {
    if (event.type === "analyze") return `Анализ: ${event.title}${event.ok ? "" : " (ошибка)"}`;
    if (event.type === "proposal") return `Предложение: ${event.title}`;
    return event.text.length > 80 ? `${event.text.slice(0, 80)}…` : event.text;
  }

  // Guarded-роут персистентного треда (P1): create-or-get приватного треда пользователя.
  // Сообщения читаются существующим GET /conversations/:id/messages (доступ — членство).
  app.get("/api/workspace/agent/thread", async (context) => {
    const cookie = context.req.header("cookie") ?? null;
    const actor = await deps.getSessionActorFromHeaders(cookie);
    if (!actor) return context.json({ error: "session_required" }, 401);
    if (!agentThreadConfigured(deps.dataSource)) {
      return context.json({ error: "collaboration_not_configured" }, 501);
    }
    const conversation = await ensureAgentThread(deps.dataSource, actor);
    const readState = deps.dataSource.getConversationReadState
      ? await deps.dataSource.getConversationReadState({ tenantId: actor.tenantId, conversationId: conversation.id, userId: actor.id })
      : null;
    return context.json({ conversation: serializeAgentConversation(conversation), readState });
  });

  app.post("/api/workspace/agent/propose", async (context) => {
    const parsed = await parseProposeRequest(context);
    if (!parsed.ok) return parsed.response;
    const runtime = createAgentProviderRuntime();
    if (!runtime.status.configured) {
      const persisted = await persistProposeTurns(parsed.value, { kind: "provider_unavailable", providerModel: runtime.status.model });
      return context.json({ error: "agent_provider_not_configured", provider: runtime.status, ...(persisted ?? {}) }, 503);
    }
    const { actor } = parsed.value;
    const slot = agentLlmConcurrency.tryAcquire(`${actor.tenantId}:${actor.id}`);
    if (!slot.ok) return context.json({ error: "agent_busy" }, 429);
    try {
      const traceSteps: string[] = [];
      const result = await runProposeLoop(parsed.value, runtime.provider, (event) => {
        traceSteps.push(traceLabelFromEvent(event));
      });
      const persisted = await persistProposeSuccess(parsed.value, result, traceSteps);
      return context.json({ ...result, ...(persisted ?? {}) });
    } catch (error) {
      // Сбой LLM/аплинка (сеть, таймаут, 5xx апстрима) — честный 502 Bad Gateway со
      // СТАБИЛЬНЫМ кодом, а не generic 500 и не сырой текст апстрима: error.message
      // собирается из 300 байт ответа OpenRouter и утёк бы в браузер вместе с
      // идентификацией провайдера, статусом квоты и состоянием ключа (ревью F3).
      const persisted = await persistProposeFailure(parsed.value, error);
      return context.json({ error: "agent_upstream_failed", ...(persisted ?? {}) }, 502);
    } finally {
      slot.release();
    }
  });

  // То же предложение, но потоком (SSE): события reasoning/analyze/proposal по мере работы +
  // финальное событие done с полным результатом. CoT-трейс для живого «агент думает».
  app.post("/api/workspace/agent/propose/stream", async (context) => {
    const parsed = await parseProposeRequest(context);
    if (!parsed.ok) return parsed.response;
    const runtime = createAgentProviderRuntime();
    if (!runtime.status.configured) {
      const persisted = await persistProposeTurns(parsed.value, { kind: "provider_unavailable", providerModel: runtime.status.model });
      return context.json({ error: "agent_provider_not_configured", provider: runtime.status, ...(persisted ?? {}) }, 503);
    }
    const { actor } = parsed.value;
    const slot = agentLlmConcurrency.tryAcquire(`${actor.tenantId}:${actor.id}`);
    if (!slot.ok) return context.json({ error: "agent_busy" }, 429);
    return streamSSE(context, async (stream) => {
      try {
        const traceSteps: string[] = [];
        const result = await runProposeLoop(parsed.value, runtime.provider, async (event) => {
          traceSteps.push(traceLabelFromEvent(event));
          await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
        });
        const persisted = await persistProposeSuccess(parsed.value, result, traceSteps);
        await stream.writeSSE({ event: "done", data: JSON.stringify({ ...result, ...(persisted ?? {}) }) });
      } catch (error) {
        // Симметрия с JSON-вариантом: ход переживает reload, наружу — стабильный код.
        const persisted = await persistProposeFailure(parsed.value, error);
        await stream.writeSSE({ event: "error", data: JSON.stringify({ error: "agent_upstream_failed", ...(persisted ?? {}) }) });
      } finally {
        slot.release();
      }
    });
  });

  // Применение ПОДТВЕРЖДённых действий. Делегирует в существующие governed-команды:
  // повторная RBAC-проверка (грубая capability + точная внутри команды) + валидация + audit.
  app.post("/api/workspace/agent/execute", async (context) => {
    const cookie = context.req.header("cookie") ?? null;
    const actor = await deps.getSessionActorFromHeaders(cookie);
    if (!actor) return context.json({ error: "session_required" }, 401);
    const body = await readLimitedJsonBody(context);
    if (!body.ok) return context.json({ error: body.error }, body.status);
    const actions = (body.value as { actions?: unknown }).actions;
    if (!Array.isArray(actions) || actions.length === 0 || actions.length > 20) {
      return context.json({ error: "invalid_actions" }, 400);
    }

    const profile = await deps.getActorProfile(actor);
    const taskWorkspace = createTaskCommandWorkspace(deps);
    const results: Array<{
      tool: string;
      ok: boolean;
      status?: number;
      error?: string;
      result?: unknown;
      currentVersions?: AgentActionPreconditionVersions;
    }> = [];
    const previews: Array<AgentActionPreview | undefined> = [];

    for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
      const action = (actions[actionIndex] ?? {}) as { tool?: unknown; input?: unknown; preconditionVersions?: unknown };
      const toolName = typeof action.tool === "string" ? action.tool : "";
      const input = (action.input && typeof action.input === "object" ? action.input : {}) as Record<string, unknown>;
      const preconditionVersions = (action.preconditionVersions && typeof action.preconditionVersions === "object"
        ? action.preconditionVersions
        : {}) as AgentActionPreconditionVersions;
      const tool = findAgentTool(toolName);

      if (!tool || tool.kind !== "mutation") {
        results.push({ tool: toolName, ok: false, status: 400, error: "invalid_action" });
        continue;
      }
      // Грубая RBAC-проверка (defense-in-depth; точная — внутри команды).
      const coarse = tool.capability({ actor, profile });
      if (!coarse.allowed) {
        results.push({ tool: toolName, ok: false, status: 403, error: coarse.reason });
        continue;
      }

      if (tool.name === "change_task_status") {
        const projectId = typeof input.projectId === "string" ? input.projectId : "";
        const taskId = typeof input.taskId === "string" ? input.taskId : "";
        const statusId = typeof input.statusId === "string" ? input.statusId : "";
        if (!projectId || !taskId || !statusId) {
          results.push({ tool: tool.name, ok: false, status: 400, error: "invalid_action_input" });
          continue;
        }
        const task = await deps.dataSource.findTaskById?.(actor.tenantId, taskId);
        const canTransition = task && (
          canManageProjects({ actor, profile, targetTenantId: actor.tenantId }).allowed ||
          canParticipantTransitionTask(actor.id, task)
        );
        if (task && !canTransition) {
          results.push({ tool: tool.name, ok: false, status: 403, error: "task_participant_role_required" });
          continue;
        }
        const clientUpdatedAt = typeof preconditionVersions.taskUpdatedAt === "string"
          ? new Date(preconditionVersions.taskUpdatedAt)
          : null;
        if (!clientUpdatedAt || Number.isNaN(clientUpdatedAt.getTime())) {
          results.push({ tool: tool.name, ok: false, status: 400, error: "missing_precondition_versions" });
          continue;
        }
        const preflight = await taskWorkspace.preflightTransitionTaskStatus({ actor, profile, projectId });
        if (!preflight.ok) {
          results.push({ tool: tool.name, ok: false, status: preflight.status, error: preflight.error });
          continue;
        }
        previews[actionIndex] = await buildActionPreview(deps.dataSource, actor.tenantId, { tool: tool.name, input });
        const transition = await taskWorkspace.transitionTaskStatus({
          actor,
          profile,
          projectId,
          taskId,
          body: { statusId },
          clientUpdatedAt
        });
        if (!transition.ok) {
          results.push({
            tool: tool.name,
            ok: false,
            status: transition.status,
            error: transition.error,
            ...(transition.currentVersions ? { currentVersions: transition.currentVersions } : {})
          });
          continue;
        }
        invalidateCapacityCacheForTenant(actor.tenantId);
        results.push({ tool: tool.name, ok: true, result: { task: transition.task } });
        continue;
      }

      // Применение сценария разрешения перегрузки — переотправка в governed scenario-apply.
      if (tool.name === "apply_resource_resolution") {
        const projectId = typeof input.projectId === "string" ? input.projectId : "";
        const scenarioId = typeof input.scenarioId === "string" ? input.scenarioId : "";
        if (!projectId || !scenarioId) {
          results.push({ tool: tool.name, ok: false, status: 400, error: "invalid_action_input" });
          continue;
        }
        // Optimistic lock без обходов: версию плана обязан прислать клиент — явно в input
        // либо в preconditionVersions.planVersion из review-карточки (D3). Подстановка
        // текущей версии сервером обесценила бы precondition (как и у change_task_status).
        const clientPlanVersion = typeof input.clientPlanVersion === "number"
          ? input.clientPlanVersion
          : typeof preconditionVersions.planVersion === "number"
            ? preconditionVersions.planVersion
            : undefined;
        if (clientPlanVersion === undefined) {
          results.push({ tool: tool.name, ok: false, status: 400, error: "missing_precondition_versions" });
          continue;
        }
        const acceptedRiskReason = typeof input.acceptedRiskReason === "string" ? input.acceptedRiskReason : undefined;
        previews[actionIndex] = await buildActionPreview(deps.dataSource, actor.tenantId, { tool: tool.name, input });
        const res = await dispatchInternal(app, cookie, `/api/workspace/projects/${projectId}/planning/scenarios/${scenarioId}/apply`, { clientPlanVersion, acceptedRiskReason });
        if (res.status === 200) results.push({ tool: tool.name, ok: true, result: res.body });
        else results.push({ tool: tool.name, ok: false, status: res.status, error: typeof res.body.error === "string" ? res.body.error : "apply_failed" });
        continue;
      }

      // Применение набора planning-команд — переотправка в governed apply-command-batch (право per-команда).
      if (tool.name === "apply_plan_commands") {
        const projectId = typeof input.projectId === "string" ? input.projectId : "";
        const commands = Array.isArray(input.commands) ? input.commands : null;
        if (!projectId || !commands || commands.length === 0) {
          results.push({ tool: tool.name, ok: false, status: 400, error: "invalid_action_input" });
          continue;
        }
        const clientPlanVersion = typeof input.clientPlanVersion === "number"
          ? input.clientPlanVersion
          : typeof preconditionVersions.planVersion === "number"
            ? preconditionVersions.planVersion
            : undefined;
        if (clientPlanVersion === undefined) {
          results.push({ tool: tool.name, ok: false, status: 400, error: "missing_precondition_versions" });
          continue;
        }
        previews[actionIndex] = await buildActionPreview(deps.dataSource, actor.tenantId, { tool: tool.name, input });
        const res = await dispatchInternal(app, cookie, `/api/workspace/projects/${projectId}/planning/apply-command-batch`, { commands, clientPlanVersion });
        if (res.status === 200) results.push({ tool: tool.name, ok: true, result: res.body });
        else results.push({ tool: tool.name, ok: false, status: res.status, error: typeof res.body.error === "string" ? res.body.error : "apply_failed" });
        continue;
      }

      // Комментарий к задаче — переотправка в governed POST /tasks/:id/comments.
      if (tool.name === "comment_task") {
        const taskId = typeof input.taskId === "string" ? input.taskId : "";
        const commentBody = typeof input.body === "string" ? input.body : "";
        if (!taskId || !commentBody) {
          results.push({ tool: tool.name, ok: false, status: 400, error: "invalid_action_input" });
          continue;
        }
        previews[actionIndex] = await buildActionPreview(deps.dataSource, actor.tenantId, { tool: tool.name, input });
        const res = await dispatchInternal(app, cookie, `/api/workspace/tasks/${taskId}/comments`, { body: commentBody });
        if (res.status === 200 || res.status === 201) results.push({ tool: tool.name, ok: true, result: res.body });
        else results.push({ tool: tool.name, ok: false, status: res.status, error: typeof res.body.error === "string" ? res.body.error : "comment_failed" });
        continue;
      }

      // Создание задачи — переотправка в governed POST [/projects/:id]/tasks.
      if (tool.name === "create_task") {
        const title = typeof input.title === "string" ? input.title : "";
        const description = typeof input.description === "string" ? input.description : "";
        const projectId = typeof input.projectId === "string" ? input.projectId : "";
        if (!title) {
          results.push({ tool: tool.name, ok: false, status: 400, error: "invalid_action_input" });
          continue;
        }
        const plannedStart = typeof input.plannedStart === "string" ? input.plannedStart : isoDate();
        const plannedFinish = typeof input.plannedFinish === "string" ? input.plannedFinish : plannedStart;
        const participants = Array.isArray(input.participants) && input.participants.length > 0
          ? input.participants
          : [{ userId: actor.id, role: "executor" }];
        const path = projectId ? `/api/workspace/projects/${projectId}/tasks` : "/api/workspace/tasks";
        previews[actionIndex] = await buildActionPreview(deps.dataSource, actor.tenantId, { tool: tool.name, input });
        const res = await dispatchInternal(app, cookie, path, {
          title,
          priority: typeof input.priority === "string" ? input.priority : "normal",
          plannedStart,
          plannedFinish,
          durationWorkingDays: numberInput(input.durationWorkingDays, 1),
          // plannedWork здесь В ЧАСАХ: buildCreateTaskPlanningCommand умножает его на 60
          // (workMinutes = plannedWork * 60). Дефолт одного рабочего дня = 8 ч, а не 480
          // (480 попадало в план как 480 ч = 28 800 мин, раздувая ресурсную загрузку).
          plannedWork: numberInput(input.plannedWork, 8),
          participants,
          ...(description ? { description } : {})
        });
        if (res.status === 200 || res.status === 201) results.push({ tool: tool.name, ok: true, result: res.body });
        else results.push({ tool: tool.name, ok: false, status: res.status, error: typeof res.body.error === "string" ? res.body.error : "create_failed" });
        continue;
      }

      // Н15: смена стадии сделки — валидация значений governed-парсерами
      // (parseOpportunityIdParam + parseDealStageChangeBody) и переотправка в governed
      // PATCH /opportunities/:id/stage: правила переходов воронки, финальный статус и
      // audit — там. Ветка стоит ДО generic-binding, чтобы дать честный audit-preview
      // и единые коды ошибок. Optimistic-lock у сделок отсутствует — execute честно
      // идёт без preconditionVersions (это видно в review-карточке).
      if (tool.name === "change_opportunity_stage") {
        const opportunityId = parseOpportunityIdParam(input.opportunityId);
        if (!opportunityId.ok) {
          results.push({ tool: tool.name, ok: false, status: 400, error: opportunityId.error });
          continue;
        }
        const parsedStage = parseDealStageChangeBody({ stageId: input.stageId });
        if (!parsedStage.ok) {
          results.push({ tool: tool.name, ok: false, status: 400, error: parsedStage.error });
          continue;
        }
        previews[actionIndex] = await buildActionPreview(deps.dataSource, actor.tenantId, { tool: tool.name, input });
        const res = await dispatchInternal(app, cookie, `/api/workspace/opportunities/${opportunityId.value}/stage`, { stageId: parsedStage.value.stageId }, "PATCH");
        if (res.status === 200) results.push({ tool: tool.name, ok: true, result: res.body });
        else results.push({ tool: tool.name, ok: false, status: res.status, error: typeof res.body.error === "string" ? res.body.error : "stage_change_failed" });
        continue;
      }

      // Н15: честный частичный update клиента — governed PATCH требует ПОЛНОЕ тело
      // (parseClientBody дефолтит отсутствующие поля), поэтому сервер мёржит fields
      // поверх текущего клиента и валидирует ТЕМ ЖЕ парсером, что и governed-роут.
      // Optimistic-lock в контракте клиентов нет — версия записи не проверяется
      // (карточка предупреждает об этом честно).
      if (tool.name === "update_crm_client") {
        const clientId = parseClientIdParam(input.clientId);
        const fields = (input.fields && typeof input.fields === "object" ? input.fields : null) as Record<string, unknown> | null;
        if (!clientId.ok || !fields || Object.keys(fields).length === 0) {
          results.push({ tool: tool.name, ok: false, status: 400, error: clientId.ok ? "invalid_action_input" : clientId.error });
          continue;
        }
        // Fail-closed по полям: неизвестное поле не игнорируем молча — пользователь
        // одобрял карточку, в которой его не было бы видно.
        const unsupported = Object.keys(fields).find((field) => !UPDATE_CLIENT_FIELDS.has(field));
        if (unsupported) {
          results.push({ tool: tool.name, ok: false, status: 400, error: "unsupported_update_field" });
          continue;
        }
        if (invalidClientFieldType(fields)) {
          results.push({ tool: tool.name, ok: false, status: 400, error: "invalid_update_field_value" });
          continue;
        }
        const client = await deps.dataSource.findClientById?.(actor.tenantId, clientId.value);
        if (!client) {
          results.push({ tool: tool.name, ok: false, status: 404, error: "client_not_found" });
          continue;
        }
        const patchBody = buildClientPatchBody(client, fields);
        const parsedClient = parseClientBody({ ...patchBody, id: client.id }, actor.tenantId);
        if (!parsedClient.ok) {
          results.push({ tool: tool.name, ok: false, status: 400, error: parsedClient.error });
          continue;
        }
        previews[actionIndex] = await buildActionPreview(deps.dataSource, actor.tenantId, { tool: tool.name, input });
        const res = await dispatchInternal(app, cookie, `/api/workspace/clients/${clientId.value}`, patchBody, "PATCH");
        if (res.status === 200) results.push({ tool: tool.name, ok: true, result: res.body });
        else results.push({ tool: tool.name, ok: false, status: res.status, error: typeof res.body.error === "string" ? res.body.error : "client_update_failed" });
        continue;
      }

      // Декларативные mutation-инструменты (CRM/comms/admin/projects) — generic-редиспатч в
      // governed-роут. Точный RBAC/валидация — на самом роуте; грубый capability уже проверен выше.
      if (tool.binding) {
        previews[actionIndex] = await buildActionPreview(deps.dataSource, actor.tenantId, { tool: tool.name, input });
        const res = await dispatchBinding(app, cookie, tool.binding, input);
        if (res.status >= 200 && res.status < 300) results.push({ tool: tool.name, ok: true, result: res.body });
        else results.push({ tool: tool.name, ok: false, status: res.status, error: typeof res.body.error === "string" ? res.body.error : "action_failed" });
        continue;
      }

      // Честный частичный update_task: PATCH-роут требует ПОЛНОЕ тело, поэтому сервер
      // мёржит переданные fields поверх текущей задачи — участники и статус берутся
      // из текущего состояния и НЕ затираются. Версия задачи — только из
      // preconditionVersions (fail-closed, как у change_task_status).
      if (tool.name === "update_task") {
        const taskId = typeof input.taskId === "string" ? input.taskId : "";
        const fields = (input.fields && typeof input.fields === "object" ? input.fields : null) as Record<string, unknown> | null;
        if (!taskId || !fields || Object.keys(fields).length === 0) {
          results.push({ tool: tool.name, ok: false, status: 400, error: "invalid_action_input" });
          continue;
        }
        // Fail-closed по полям: неизвестное поле не игнорируем молча — пользователь
        // одобрял карточку, в которой его не было бы видно.
        const unsupported = Object.keys(fields).find((field) => !UPDATE_TASK_FIELDS.has(field));
        if (unsupported) {
          results.push({ tool: tool.name, ok: false, status: 400, error: "unsupported_update_field" });
          continue;
        }
        const clientUpdatedAt = typeof preconditionVersions.taskUpdatedAt === "string"
          ? preconditionVersions.taskUpdatedAt
          : undefined;
        if (!clientUpdatedAt || Number.isNaN(new Date(clientUpdatedAt).getTime())) {
          results.push({ tool: tool.name, ok: false, status: 400, error: "missing_precondition_versions" });
          continue;
        }
        const task = await deps.dataSource.findTaskById?.(actor.tenantId, taskId);
        if (!task) {
          results.push({ tool: tool.name, ok: false, status: 404, error: "task_not_found" });
          continue;
        }
        if (invalidUpdateTaskFieldType(fields)) {
          results.push({ tool: tool.name, ok: false, status: 400, error: "invalid_update_field_value" });
          continue;
        }
        // Мёрж (присутствие поля — через `in`, без typeof-фолбэка на текущее значение)
        // + валидация ТЕМ ЖЕ парсером, что и governed PATCH: одна точка правды по
        // целым числам, границам, длине названия, enum приоритета и порядку дат.
        const patchBody = buildUpdateTaskPatchBody(task, fields, clientUpdatedAt);
        const parsedPatch = parseUpdateTaskBody(patchBody);
        if (!parsedPatch.ok) {
          results.push({ tool: tool.name, ok: false, status: 400, error: parsedPatch.error });
          continue;
        }
        previews[actionIndex] = await buildActionPreview(deps.dataSource, actor.tenantId, { tool: tool.name, input });
        const res = await dispatchInternal(app, cookie, `/api/workspace/tasks/${taskId}`, patchBody, "PATCH");
        if (res.status === 200) results.push({ tool: tool.name, ok: true, result: res.body });
        else {
          const currentVersions = res.body.currentVersions;
          results.push({
            tool: tool.name,
            ok: false,
            status: res.status,
            error: typeof res.body.error === "string" ? res.body.error : "update_failed",
            ...(currentVersions && typeof currentVersions === "object" ? { currentVersions: currentVersions as AgentActionPreconditionVersions } : {})
          });
        }
        continue;
      }

      results.push({ tool: tool.name, ok: false, status: 501, error: "tool_not_executable_yet" });
    }

    const classifiedResults = results.map((item) => ({
      ...item,
      status: item.ok
        ? "applied" as const
        : item.status === 403
          ? "denied" as const
          : item.status === 409 || item.error?.endsWith("_conflict")
            ? "conflict" as const
            : "failed" as const
    }));

    // Провенанс агента: на каждое применённое или отклонённое правами действие — ОТДЕЛЬНОЕ
    // audit-событие sourceWorkflow:"agent". Успешные события идут сверх штатного аудита
    // governed-команды; denied-события не дают попыткам агента исчезнуть из governance trail.
    // Квитанция fail-closed: id событий и correlationId попадают в ответ только если
    // audit-персистентность сконфигурирована и запись реально произошла.
    const auditEventIds: Array<string | undefined> = [];
    let batchCorrelationId: string | undefined;
    if (deps.dataSource.appendAuditEvent) {
      const correlationId = `agent-execute-${randomUUID()}`;
      for (let i = 0; i < classifiedResults.length; i += 1) {
        const item = classifiedResults[i]!;
        if (!item.ok && item.status !== "denied") continue;
        const action = (actions[i] ?? {}) as { input?: unknown };
        const input = (action.input && typeof action.input === "object" ? action.input : {}) as Record<string, unknown>;
        const deniedReason = item.error ?? "permission_missing";
        const auditEventId = `agent-action-${randomUUID()}`;
        await deps.dataSource.appendAuditEvent({
          id: auditEventId,
          tenantId: actor.tenantId,
          actorUserId: actor.id,
          actionType: `agent.${item.tool}.${item.ok ? "applied" : "denied"}`,
          sourceWorkflow: "agent",
          sourceEntity: agentSourceEntity(input),
          input: { tool: item.tool, input },
          beforeState: item.ok ? { value: previews[i]?.before ?? "Недоступно" } : null,
          afterState: item.ok ? ((item.result ?? null) as Record<string, unknown> | null) : null,
          permissionResult: item.ok
            ? { allowed: true, via: "agent" }
            : { allowed: false, reason: deniedReason, via: "agent" },
          executionResult: item.ok
            ? { status: "succeeded" }
            : { status: "denied", reason: deniedReason },
          correlationId,
          createdAt: new Date()
        });
        auditEventIds[i] = auditEventId;
        batchCorrelationId = correlationId;
      }
    }

    // Планообразующие действия дополнительно адресуют коммит плана: governed-ответ
    // scenario-apply / apply-command-batch уже содержит auditEventId и newPlanVersion —
    // именно это событие видно на вкладке «Коммиты» (события agent-action-* туда не попадают).
    const receiptResults = classifiedResults.map((item, i) => {
      const planning: { planningAuditEventId?: string; planVersion?: number; projectId?: string } = {};
      if (item.ok && (item.tool === "apply_resource_resolution" || item.tool === "apply_plan_commands")) {
        const resultBody = (item.result && typeof item.result === "object" ? item.result : {}) as Record<string, unknown>;
        if (typeof resultBody.auditEventId === "string") planning.planningAuditEventId = resultBody.auditEventId;
        if (typeof resultBody.newPlanVersion === "number") planning.planVersion = resultBody.newPlanVersion;
        // projectId нужен квитанции: ссылка «Открыть в Коммитах» адресуется в рамках проекта.
        const action = (actions[i] ?? {}) as { input?: unknown };
        const input = (action.input && typeof action.input === "object" ? action.input : {}) as Record<string, unknown>;
        if (typeof input.projectId === "string") planning.projectId = input.projectId;
      }
      return {
        ...item,
        ...(auditEventIds[i] ? { auditEventId: auditEventIds[i] } : {}),
        ...planning
      };
    });

    const summary = classifiedResults.reduce(
      (counts, item) => ({ ...counts, [item.status]: counts[item.status] + 1 }),
      { applied: 0, denied: 0, conflict: 0, failed: 0 }
    );

    // Персистентность исхода (P1): result-сообщение с per-action outcomes и ссылками
    // на audit-квитанцию — история «запрос → предложение → исход» переживает reload.
    let persisted: { threadId: string; messageId: string } | null = null;
    if (agentThreadConfigured(deps.dataSource)) {
      const conversation = await ensureAgentThread(deps.dataSource, actor);
      const turn = await appendAgentTurn(
        deps.dataSource, actor, conversation.id,
        `Результат: применено ${summary.applied}, отказано ${summary.denied}, конфликтов ${summary.conflict}, ошибок ${summary.failed}.`,
        {
          role: "agent",
          kind: "result",
          ...(batchCorrelationId ? { correlationId: batchCorrelationId } : {}),
          outcomes: receiptResults.map((item) => ({
            tool: item.tool,
            status: item.status,
            ...(item.auditEventId ? { auditEventId: item.auditEventId } : {}),
            ...(item.planningAuditEventId ? { planningAuditEventId: item.planningAuditEventId } : {}),
            ...(item.planVersion !== undefined ? { planVersion: item.planVersion } : {}),
            ...(item.projectId ? { projectId: item.projectId } : {})
          }))
        }
      );
      emitMessageCreated(conversation.id, turn.serialized);
      persisted = { threadId: conversation.id, messageId: turn.id };
    }

    return context.json({
      results: receiptResults,
      applied: summary.applied > 0,
      summary,
      ...(batchCorrelationId ? { correlationId: batchCorrelationId } : {}),
      ...(persisted ?? {})
    });
  });
}
