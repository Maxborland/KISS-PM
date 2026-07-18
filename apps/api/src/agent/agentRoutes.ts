import { randomUUID } from "node:crypto";

import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

import { canManageProjects, type AccessProfile } from "@kiss-pm/access-control";
import type { TenantUser } from "@kiss-pm/domain";

import type { ApiApp, ApiRouteDeps } from "../routeTypes";
import { invalidateCapacityCacheForTenant } from "../capacity/registerCapacityRoutes";
import { createUploadConcurrencyLimiter } from "../attachmentUploadRequest";
import { readLimitedJsonBody } from "../jsonBody";
import { createPlanningReadModel } from "../planning/planningReadModel";
import { canReadPlanningReadModel } from "../planning/planningRouteAuth";
import { createTaskCommandWorkspace } from "../project-work/taskCommandWorkspace";
import { canEditTaskFields, canParticipateInTaskActivity, canParticipantTransitionTask } from "../project-work/taskCommandGuards";
import { runAgentLoop, type AgentLoopEvent, type AnalyzeExecutor } from "./agentLoop";
import {
  agentThreadConfigured,
  agentThreadId,
  appendAgentTurn,
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
const WIRED_ANALYZE = new Set(["list_my_tasks", "read_project_plan", "detect_resource_overloads", "preview_resource_resolution"]);
// Mutation-инструменты с ручным /execute. OFFERABLE_MUTATIONS — более узкий набор: только
// действия, для которых review-карточка уже показывает полный честный before/after.
const EXECUTABLE_MUTATIONS = new Set(["change_task_status", "comment_task", "create_task", "apply_resource_resolution", "apply_plan_commands"]);
const OFFERABLE_MUTATIONS = new Set(["change_task_status", "comment_task"]);

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
export type AgentActionPreview = { before: string; after: string };
export type AgentActionPreconditionVersions = { taskUpdatedAt?: string };

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
      preview: canReadTaskMetadata
        ? await buildActionPreview(dataSource, actor.tenantId, action)
        : {
            before: "Количество комментариев недоступно",
            after: typeof action.input.body === "string" ? action.input.body : ""
          },
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
    return {
      before: comments === undefined ? "Количество комментариев недоступно" : `Комментариев: ${comments}`,
      after: typeof input.body === "string" ? input.body : ""
    };
  }
  if (action.tool === "create_task") {
    return {
      before: "Задача отсутствует",
      after: typeof input.title === "string" ? input.title : ""
    };
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
  return {
    before: "Текущее значение определяется целевым маршрутом",
    after: Object.entries(input)
      .filter(([, value]) => typeof value === "string" || typeof value === "number")
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(" · ")
  };
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
async function dispatchInternal(app: ApiApp, cookie: string | null, path: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await app.request(path, {
    method: "POST",
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
        limit: HISTORY_MAX_TURNS
      });
      history = historyFromThreadMessages(threadMessages);
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
    | { kind: "success"; result: Awaited<ReturnType<typeof runProposeLoop>> };
  async function persistProposeTurns(
    request: ProposeRequest,
    outcome: ProposePersistOutcome
  ): Promise<{ threadId: string; messageIds: string[] } | null> {
    if (!agentThreadConfigured(deps.dataSource)) return null;
    const conversation = await ensureAgentThread(deps.dataSource, request.actor);
    const messageIds: string[] = [];
    messageIds.push(await appendAgentTurn(
      deps.dataSource, request.actor, conversation.id, request.goal, { role: "user" }, request.attachmentIds
    ));
    if (outcome.kind === "provider_unavailable") {
      messageIds.push(await appendAgentTurn(
        deps.dataSource, request.actor, conversation.id,
        `LLM-провайдер не настроен (провайдер ${outcome.providerModel}) — задайте OPENROUTER_API_KEY или ANTHROPIC_API_KEY на сервере.`,
        { role: "agent", kind: "error" }
      ));
    } else {
      const result = outcome.result;
      const bodyText = result.reasoning.trim().length > 0
        ? result.reasoning
        : result.proposedActions.length > 0
          ? `Предложений: ${result.proposedActions.length}.`
          : "Предложений нет.";
      messageIds.push(await appendAgentTurn(
        deps.dataSource, request.actor, conversation.id, bodyText,
        { role: "agent", proposal: proposalSnapshot(result) }
      ));
    }
    return { threadId: conversation.id, messageIds };
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
      const result = await runProposeLoop(parsed.value, runtime.provider);
      const persisted = await persistProposeTurns(parsed.value, { kind: "success", result });
      return context.json({ ...result, ...(persisted ?? {}) });
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
        const result = await runProposeLoop(parsed.value, runtime.provider, async (event) => {
          await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
        });
        const persisted = await persistProposeTurns(parsed.value, { kind: "success", result });
        await stream.writeSSE({ event: "done", data: JSON.stringify({ ...result, ...(persisted ?? {}) }) });
      } catch (error) {
        await stream.writeSSE({ event: "error", data: JSON.stringify({ error: error instanceof Error ? error.message : "agent_failed" }) });
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
        // Optimistic lock без обходов: версию плана обязан прислать клиент — подстановка
        // текущей версии сервером обесценила бы precondition (как и у change_task_status).
        const clientPlanVersion = typeof input.clientPlanVersion === "number" ? input.clientPlanVersion : undefined;
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
        const clientPlanVersion = typeof input.clientPlanVersion === "number" ? input.clientPlanVersion : undefined;
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

      // Декларативные mutation-инструменты (CRM/comms/admin/projects) — generic-редиспатч в
      // governed-роут. Точный RBAC/валидация — на самом роуте; грубый capability уже проверен выше.
      if (tool.binding) {
        previews[actionIndex] = await buildActionPreview(deps.dataSource, actor.tenantId, { tool: tool.name, input });
        const res = await dispatchBinding(app, cookie, tool.binding, input);
        if (res.status >= 200 && res.status < 300) results.push({ tool: tool.name, ok: true, result: res.body });
        else results.push({ tool: tool.name, ok: false, status: res.status, error: typeof res.body.error === "string" ? res.body.error : "action_failed" });
        continue;
      }

      // update_task пока НЕ исполняем: PATCH требует полное тело + clientUpdatedAt (риск затирания
      // участников при сборке из частичных fields). До безопасного частичного апдейта он не
      // предлагается LLM (см. OFFERABLE_MUTATIONS), так что сюда штатно не попадаем.
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
      const messageId = await appendAgentTurn(
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
      persisted = { threadId: conversation.id, messageId };
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
