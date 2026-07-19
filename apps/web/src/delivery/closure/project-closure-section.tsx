"use client";

/* ============================================================
   Секция «Закрытие проекта» (настройки проекта, лейн Р2/S1).

   Поток: «Подготовить закрытие» → POST closure/preview (план/факт,
   незакрытые задачи) → причина закрытия + явное подтверждение →
   POST closure/close → итог: статус «Закрыт», дата, план/факт,
   уроки (список + добавление) и read-only выводы шаблона.

   Права зеркалят серверные решения из apps/api/src/retrospectiveRoutes.ts:
   - чтение (readDecision): projects.read + project_plan.read + retrospectives.read;
   - закрытие (closeDecision): projects.manage + project_plan.read +
     management_actions.execute + retrospectives.manage;
   - уроки: retrospectives.manage.
   Контролы без работающего права не рендерятся (честность).
   ============================================================ */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { hasAllPermissions, hasPermission } from "@/lib/permissions";
import { DomainApiError } from "@/lib/domain-client";
import { useSessionUser } from "@/shell/use-session-user";
import type { ClosureLessonCategory, ClosureLessonImpact } from "@kiss-pm/domain";

import {
  createClosureClient,
  type ClosureClient,
  type ClosureLessonInput,
  type ClosurePreviewResult,
  type ClosureReadState,
  type TemplateInsights
} from "@/delivery/lib/closure-client";

// Зеркало readDecision из retrospectiveRoutes.ts
export const CLOSURE_READ_PERMISSIONS = [
  "tenant.projects.read",
  "tenant.project_plan.read",
  "tenant.retrospectives.read"
] as const;
// Зеркало closeDecision из retrospectiveRoutes.ts
export const CLOSURE_CLOSE_PERMISSIONS = [
  "tenant.projects.manage",
  "tenant.project_plan.read",
  "tenant.management_actions.execute",
  "tenant.retrospectives.manage"
] as const;
const LESSONS_MANAGE_PERMISSION = "tenant.retrospectives.manage";

const STATUS_RU: Record<string, string> = {
  draft: "Черновик",
  active: "Активен",
  paused: "Приостановлен",
  closed: "Закрыт",
  cancelled: "Отменён"
};
const LESSON_CATEGORIES: Record<ClosureLessonCategory, string> = {
  schedule: "Сроки",
  scope: "Объём",
  resource: "Ресурсы",
  quality: "Качество",
  communication: "Коммуникации",
  commercial: "Коммерция",
  process: "Процесс"
};
const LESSON_IMPACTS: Record<ClosureLessonImpact, string> = {
  positive: "Позитивный",
  negative: "Негативный",
  neutral: "Нейтральный"
};

const CLOSURE_ERROR_RU: Record<string, string> = {
  session_required: "Сессия истекла. Войдите снова",
  permission_missing: "Недостаточно прав для этой операции",
  project_not_found: "Проект не найден",
  project_not_closable: "Проект нельзя закрыть в текущем статусе",
  closure_snapshot_not_found: "Снимок закрытия не найден — проект ещё не закрыт",
  closure_reason_required: "Укажите причину закрытия",
  retrospective_lesson_invalid: "Урок заполнен некорректно",
  persistence_not_configured: "Хранилище закрытия недоступно",
  invalid_json_response: "Сервер вернул некорректный ответ"
};

// Честный тост с кодом ошибки: «текст · код»
function closureErrorText(error: unknown, fallback: string): string {
  const code = error instanceof DomainApiError
    ? error.code
    : error instanceof TypeError
      ? "network_error"
      : "request_failed";
  const message = CLOSURE_ERROR_RU[code]
    ?? (code === "network_error" ? "Не удалось связаться с сервером" : fallback);
  return `${message} · ${code}`;
}

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
};
const hours = (minutes: number): string => `${Math.round(minutes / 60)} ч`;
const signed = (value: number, unit: string): string =>
  `${value > 0 ? "+" : ""}${value} ${unit}`;

const EMPTY_LESSON: ClosureLessonInput = { category: "process", title: "", body: "", impact: "neutral" };

function PlanFactGrid({ summary }: { summary: ClosurePreviewResult["planFactSummary"] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-[length:var(--text-sm)] sm:grid-cols-2">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-[var(--muted)]">Задачи завершены</dt>
        <dd className="v4-num text-[var(--text)]">{summary.completedTaskCount} из {summary.taskCount}</dd>
      </div>
      <div className="flex items-center justify-between gap-2">
        <dt className="text-[var(--muted)]">Незакрытые задачи</dt>
        <dd>{summary.openTaskCount > 0
          ? <Chip variant="warning">открыто {summary.openTaskCount}</Chip>
          : <Chip variant="success">нет</Chip>}</dd>
      </div>
      <div className="flex items-center justify-between gap-2">
        <dt className="text-[var(--muted)]">Работа план / факт</dt>
        <dd className="v4-num text-[var(--text)]">{hours(summary.plannedWorkMinutes)} / {hours(summary.actualWorkMinutes)} ({signed(Math.round(summary.workVarianceMinutes / 60), "ч")})</dd>
      </div>
      <div className="flex items-center justify-between gap-2">
        <dt className="text-[var(--muted)]">Отклонение по сроку</dt>
        <dd className="v4-num text-[var(--text)]">{signed(summary.scheduleVarianceDays, "дн.")}</dd>
      </div>
    </dl>
  );
}

export function ProjectClosureSection({
  projectId,
  client
}: {
  projectId: string;
  client?: ClosureClient;
}) {
  const sessionUser = useSessionUser();
  const permissions = sessionUser?.permissions ?? [];
  const canRead = hasAllPermissions(permissions, CLOSURE_READ_PERMISSIONS);
  const canClose = hasAllPermissions(permissions, CLOSURE_CLOSE_PERMISSIONS);
  const canManageLessons = hasPermission(permissions, LESSONS_MANAGE_PERMISSION);

  const closureClient = useMemo(() => client ?? createClosureClient(), [client]);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [state, setState] = useState<ClosureReadState | null>(null);

  const [preview, setPreview] = useState<ClosurePreviewResult | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  const [closeBusy, setCloseBusy] = useState(false);

  const [lessonDraft, setLessonDraft] = useState<ClosureLessonInput>(EMPTY_LESSON);
  const [lessonFormOpen, setLessonFormOpen] = useState(false);
  const [lessonBusy, setLessonBusy] = useState(false);

  const [insights, setInsights] = useState<{ status: "loading" | "ready" | "error"; data: TemplateInsights | null }>({ status: "loading", data: null });

  const mountedRef = useRef(true);
  // StrictMode-safe: dev-режим React монтирует эффекты дважды (mount → cleanup →
  // mount); без восстановления true после повторного mount ref навсегда оставался
  // false и load() молча выбрасывал результат — секция висела в «Загрузка…».
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorText(null);
    try {
      const next = await closureClient.getClosure(projectId);
      if (!mountedRef.current) return;
      setState(next);
      setStatus("ready");
    } catch (error) {
      if (!mountedRef.current) return;
      setErrorText(closureErrorText(error, "Не удалось загрузить состояние закрытия"));
      setStatus("error");
    }
  }, [closureClient, projectId]);

  useEffect(() => {
    if (!canRead) return;
    void load();
  }, [canRead, load]);

  // Read-only выводы шаблона — только для закрытого проекта с шаблоном.
  const closedTemplateId = state?.snapshot ? state.project.templateId : null;
  useEffect(() => {
    if (!closedTemplateId) return;
    let active = true;
    setInsights({ status: "loading", data: null });
    closureClient.getTemplateInsights(closedTemplateId)
      .then((data) => { if (active) setInsights({ status: "ready", data }); })
      .catch(() => { if (active) setInsights({ status: "error", data: null }); });
    return () => { active = false; };
  }, [closedTemplateId, closureClient]);

  if (!canRead) {
    return (
      <p data-testid="closure-forbidden" className="text-[length:var(--text-sm)] text-[var(--muted)]">
        Недостаточно прав для просмотра закрытия проекта. Нужны права на чтение проектов, плана и ретроспектив.
      </p>
    );
  }

  if (status === "loading") {
    return <p data-testid="closure-loading" className="text-[length:var(--text-sm)] text-[var(--muted)]">Загрузка состояния закрытия…</p>;
  }
  if (status === "error" || !state) {
    return (
      <div data-testid="closure-error" className="flex flex-wrap items-center gap-2 text-[length:var(--text-sm)] text-[var(--danger)]">
        {errorText ?? "Не удалось загрузить состояние закрытия"}
        <Button variant="ghost" size="sm" onClick={() => void load()}><RefreshCw className="size-3.5" aria-hidden />Повторить</Button>
      </div>
    );
  }

  const snapshot = state.snapshot;

  async function openPreview() {
    if (!canClose || previewBusy) return;
    setPreviewBusy(true);
    try {
      const next = await closureClient.previewClosure(projectId);
      if (!mountedRef.current) return;
      setPreview(next);
      setCloseReason("");
    } catch (error) {
      toast.error(closureErrorText(error, "Не удалось подготовить закрытие"));
    } finally {
      if (mountedRef.current) setPreviewBusy(false);
    }
  }

  async function confirmClose() {
    if (!canClose || closeBusy || !preview?.canClose) return;
    const reason = closeReason.trim();
    if (!reason) return;
    setCloseBusy(true);
    try {
      const result = await closureClient.closeProject(projectId, { closeReason: reason, lessons: [] });
      if (!mountedRef.current) return;
      setState((prev) => prev
        ? {
            project: {
              ...prev.project,
              status: "closed",
              closedAt: result.snapshot?.closedAt ?? prev.project.closedAt
            },
            snapshot: result.snapshot,
            lessons: result.lessons,
            templateImprovementActions: result.templateImprovementActions
          }
        : prev);
      setPreview(null);
      setCloseReason("");
      toast.success("Проект закрыт: снимок плана и итоги зафиксированы");
    } catch (error) {
      toast.error(closureErrorText(error, "Не удалось закрыть проект"));
    } finally {
      if (mountedRef.current) setCloseBusy(false);
    }
  }

  async function submitLesson() {
    if (!canManageLessons || lessonBusy) return;
    const title = lessonDraft.title.trim();
    const body = lessonDraft.body.trim();
    if (!title || !body) return;
    setLessonBusy(true);
    try {
      const result = await closureClient.addLesson(projectId, { ...lessonDraft, title, body });
      if (!mountedRef.current) return;
      setState((prev) => prev ? { ...prev, lessons: [...prev.lessons, result.lesson] } : prev);
      setLessonDraft(EMPTY_LESSON);
      setLessonFormOpen(false);
      toast.success("Урок добавлен в ретроспективу");
    } catch (error) {
      toast.error(closureErrorText(error, "Не удалось добавить урок"));
    } finally {
      if (mountedRef.current) setLessonBusy(false);
    }
  }

  // ── Закрытый проект: статус + дата вместо кнопки, итоги, уроки, выводы ──
  if (snapshot) {
    return (
      <div data-testid="closure-closed" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip variant="success">Закрыт</Chip>
          <span className="text-[length:var(--text-sm)] text-[var(--text)]">Проект закрыт {fmtDate(snapshot.closedAt)}</span>
          <span className="v4-num text-[length:var(--text-xs)] text-[var(--muted-soft)]">план v{snapshot.planVersion}</span>
        </div>
        <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Причина закрытия: {snapshot.closeReason}</p>

        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] p-3">
          <p className="mb-2 text-[length:var(--text-xs)] font-medium uppercase tracking-[0.04em] text-[var(--muted-soft)]">План / факт на момент закрытия</p>
          <PlanFactGrid summary={snapshot.planFactSummary} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[length:var(--text-xs)] font-medium uppercase tracking-[0.04em] text-[var(--muted-soft)]">Уроки ретроспективы</p>
            {canManageLessons && !lessonFormOpen ? (
              <Button data-testid="lesson-add" variant="secondary" size="sm" onClick={() => setLessonFormOpen(true)}>Добавить урок</Button>
            ) : null}
          </div>
          {state.lessons.length === 0 && !lessonFormOpen ? (
            <div data-testid="lessons-empty" className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] px-3 py-3 text-center text-[length:var(--text-sm)] text-[var(--muted)]">
              Уроки пока не записаны.
            </div>
          ) : state.lessons.length > 0 ? (
            <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-md)] border border-[var(--border)]">
              {state.lessons.map((lesson) => (
                <li key={lesson.id} data-testid={`lesson-${lesson.id}`} className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">{lesson.title}</span>
                    <Chip>{LESSON_CATEGORIES[lesson.category]}</Chip>
                    <Chip variant={lesson.impact === "positive" ? "success" : lesson.impact === "negative" ? "danger" : "info"}>{LESSON_IMPACTS[lesson.impact]}</Chip>
                  </div>
                  <p className="mt-0.5 text-[length:var(--text-sm)] text-[var(--muted-strong)]">{lesson.body}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {canManageLessons && lessonFormOpen ? (
            <div data-testid="lesson-form" className="mt-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] p-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Категория
                  <select data-testid="lesson-category" className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[length:var(--text-sm)] text-[var(--text)]" value={lessonDraft.category} disabled={lessonBusy} onChange={(e) => setLessonDraft((v) => ({ ...v, category: e.target.value as ClosureLessonCategory }))}>
                    {Object.entries(LESSON_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Влияние
                  <select data-testid="lesson-impact" className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[length:var(--text-sm)] text-[var(--text)]" value={lessonDraft.impact} disabled={lessonBusy} onChange={(e) => setLessonDraft((v) => ({ ...v, impact: e.target.value as ClosureLessonImpact }))}>
                    {Object.entries(LESSON_IMPACTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[length:var(--text-xs)] text-[var(--muted-soft)] sm:col-span-2">Заголовок
                  <Input data-testid="lesson-title" value={lessonDraft.title} disabled={lessonBusy} placeholder="напр. Оценка интеграций была занижена" onChange={(e) => setLessonDraft((v) => ({ ...v, title: e.target.value }))} />
                </label>
                <label className="flex flex-col gap-1 text-[length:var(--text-xs)] text-[var(--muted-soft)] sm:col-span-2">Описание
                  <Textarea data-testid="lesson-body" value={lessonDraft.body} disabled={lessonBusy} placeholder="Что произошло и что изменить в следующих проектах" onChange={(e) => setLessonDraft((v) => ({ ...v, body: e.target.value }))} />
                </label>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <Button data-testid="lesson-submit" size="sm" disabled={lessonBusy || lessonDraft.title.trim().length === 0 || lessonDraft.body.trim().length === 0} onClick={() => void submitLesson()}>Сохранить урок</Button>
                <Button variant="ghost" size="sm" disabled={lessonBusy} onClick={() => { setLessonFormOpen(false); setLessonDraft(EMPTY_LESSON); }}><X className="size-3.5" aria-hidden />Отмена</Button>
              </div>
            </div>
          ) : null}
          {!canManageLessons ? (
            <p className="mt-1.5 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Только чтение: добавлять уроки могут пользователи с правом управления ретроспективами.</p>
          ) : null}
        </div>

        {closedTemplateId ? (
          <div data-testid="closure-insights" className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] p-3">
            <p className="mb-1 text-[length:var(--text-xs)] font-medium uppercase tracking-[0.04em] text-[var(--muted-soft)]">Выводы по шаблону проекта</p>
            {insights.status === "loading" ? (
              <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Загрузка выводов…</p>
            ) : insights.status === "error" || !insights.data ? (
              <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Не удалось загрузить выводы по шаблону.</p>
            ) : insights.data.estimationLearning.appliedActionCount === 0 ? (
              <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Применённых улучшений шаблона пока нет.</p>
            ) : (
              <p className="v4-num text-[length:var(--text-sm)] text-[var(--text)]">
                Применено улучшений: {insights.data.estimationLearning.appliedActionCount} · поправка по работе {signed(Math.round(insights.data.estimationLearning.plannedWorkDeltaMinutes / 60), "ч")} · по сроку {signed(insights.data.estimationLearning.plannedDurationDeltaDays, "дн.")}
              </p>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  // ── Открытый проект: статус + подготовка закрытия (preview → подтверждение → close) ──
  const statusLabel = STATUS_RU[state.project.status] ?? state.project.status;
  const reasonOk = closeReason.trim().length > 0;
  return (
    <div data-testid="closure-open" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip variant={state.project.status === "active" ? "info" : "warning"}>{statusLabel}</Chip>
        <span className="text-[length:var(--text-sm)] text-[var(--muted)]">При закрытии фиксируются снимок плана, план/факт и уроки ретроспективы.</span>
      </div>

      {preview === null ? (
        canClose ? (
          <Button data-testid="closure-prepare" variant="secondary" size="sm" disabled={previewBusy} onClick={() => void openPreview()}>
            {previewBusy ? "Готовим предпросмотр…" : "Подготовить закрытие"}
          </Button>
        ) : (
          <p data-testid="closure-no-close-rights" className="text-[length:var(--text-sm)] text-[var(--muted)]">
            Закрыть проект могут пользователи с правами управления проектами и ретроспективами.
          </p>
        )
      ) : (
        <div data-testid="closure-preview" className="rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] p-3">
          <p className="mb-2 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Предпросмотр закрытия</p>
          <PlanFactGrid summary={preview.planFactSummary} />
          {preview.planFactSummary.openTaskCount > 0 ? (
            <p className="mt-2 text-[length:var(--text-xs)] text-[var(--warning-text)]">Незакрытые задачи попадут в снимок как открытые — закрытие их не завершает.</p>
          ) : null}
          {preview.proposedTemplateImprovement ? (
            <p className="mt-2 text-[length:var(--text-xs)] text-[var(--muted-strong)]">После закрытия будет предложено улучшение шаблона: {preview.proposedTemplateImprovement.title}</p>
          ) : null}
          {!preview.canClose ? (
            <p data-testid="closure-not-closable" className="mt-2 text-[length:var(--text-sm)] text-[var(--danger)]">Проект в статусе «{STATUS_RU[preview.projectStatus] ?? preview.projectStatus}» закрыть нельзя.</p>
          ) : (
            <label className="mt-3 flex flex-col gap-1 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Причина закрытия (обязательно)
              <Input data-testid="closure-reason" value={closeReason} disabled={closeBusy} placeholder="напр. работы завершены, акт подписан" onChange={(e) => setCloseReason(e.target.value)} aria-invalid={!reasonOk} />
            </label>
          )}
          <div className="mt-2.5 flex items-center gap-2">
            {preview.canClose ? (
              <Button data-testid="closure-confirm" variant="destructive" size="sm" disabled={closeBusy || !reasonOk} onClick={() => void confirmClose()}>
                {closeBusy ? "Закрываем…" : "Закрыть проект"}
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" disabled={closeBusy} onClick={() => { setPreview(null); setCloseReason(""); }}><X className="size-3.5" aria-hidden />Отмена</Button>
          </div>
        </div>
      )}
    </div>
  );
}
