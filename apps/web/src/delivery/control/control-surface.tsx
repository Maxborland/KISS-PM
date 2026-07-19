"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  ControlSignal,
  ControlSignalStatus,
  KpiDefinition,
  KpiEvaluation,
  ManagementActionCandidate
} from "@kiss-pm/domain";
import { Activity, Check, Loader2, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SurfaceState } from "@/components/domain/surface-state";
import { cn } from "@/lib/cn";
import { hasPermission } from "@/lib/permissions";
import { useSessionUser } from "@/shell/use-session-user";
import { DeliveryFrame } from "@/delivery/ui/delivery-frame";
import { PROJECT_FALLBACK, deriveProjectMeta, useProjectBase } from "@/delivery/lib/project-chrome";
import { MOCK_PROJECT_ID } from "@/delivery/lib/planning-demo-data";
import { controlErr, type ActionPreviewResponse, type ControlUiError } from "@/delivery/lib/control-client";
import { useControl } from "@/delivery/lib/use-control";
import { usePlanning } from "@/delivery/lib/use-planning";

/* ── Права (packages/access-control): read-model контура требует все три read-права ── */
const READ_PERMISSIONS = [
  "tenant.project_plan.read",
  "tenant.kpi_definitions.read",
  "tenant.control_signals.read"
];
const SIGNAL_MANAGE_PERMISSION = "tenant.control_signals.manage";
const ACTION_EXECUTE_PERMISSION = "tenant.management_actions.execute";
const CORRECTIVE_MANAGE_PERMISSION = "tenant.corrective_actions.manage";
const RETRO_READ_PERMISSIONS = ["tenant.projects.read", "tenant.project_plan.read", "tenant.retrospectives.read"];

/* ── RU-словари статусов/важности (контрактные значения сервера) ── */
const SEVERITY_META: Record<"warning" | "critical", { label: string; cls: string }> = {
  warning: { label: "предупреждение", cls: "bg-[var(--warning-soft)] text-[var(--warning-text)]" },
  critical: { label: "критично", cls: "bg-[var(--danger-soft)] text-[var(--danger-text)]" }
};
const SIGNAL_STATUS_META: Record<ControlSignalStatus, { label: string; cls: string }> = {
  open: { label: "Открыт", cls: "bg-[var(--info-soft)] text-[var(--info)]" },
  acknowledged: { label: "В работе", cls: "bg-[var(--accent-soft)] text-[var(--accent)]" },
  resolved: { label: "Решён", cls: "bg-[var(--success-soft)] text-[var(--success-text)]" },
  accepted_risk: { label: "Риск принят", cls: "bg-[var(--warning-soft)] text-[var(--warning-text)]" }
};
const CORRECTIVE_STATUS_LABEL: Record<string, string> = {
  open: "Открыто",
  in_progress: "В работе",
  done: "Выполнено",
  cancelled: "Отменено"
};
const LESSON_CATEGORY_LABEL: Record<string, string> = {
  schedule: "Сроки",
  scope: "Объём",
  resource: "Ресурсы",
  quality: "Качество",
  communication: "Коммуникации",
  commercial: "Коммерция",
  process: "Процесс"
};
const LESSON_IMPACT_META: Record<string, { label: string; cls: string }> = {
  positive: { label: "помогло", cls: "bg-[var(--success-soft)] text-[var(--success-text)]" },
  negative: { label: "мешало", cls: "bg-[var(--danger-soft)] text-[var(--danger-text)]" },
  neutral: { label: "нейтрально", cls: "bg-[var(--panel-strong)] text-[var(--muted-strong)]" }
};
const KPI_UNIT_LABEL: Record<KpiDefinition["unit"], string> = {
  days: "дн",
  minutes: "мин",
  percent: "%",
  count: "шт"
};
// RU-подписи прав, требуемых кандидатом действия (requiredPermissions — контрактное поле)
const PERMISSION_LABEL: Record<string, string> = {
  "tenant.project_plan.manage": "управление планом",
  "tenant.project_resources.manage": "управление ресурсами",
  "tenant.planning_scenarios.apply": "применение сценариев"
};

const ddmmyyyy = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
};
const hours = (min: number) => Math.round(min / 60);

function Chip({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold", cls)}>
      {label}
    </span>
  );
}

type StatusFilter = "all" | ControlSignalStatus;
type SeverityFilter = "all" | "warning" | "critical";
type PreviewState =
  | { signalId: string; actionId: string; status: "loading" }
  | { signalId: string; actionId: string; status: "ready"; data: ActionPreviewResponse }
  | { signalId: string; actionId: string; status: "error"; error: ControlUiError };

export function ProjectControl({ projectId = MOCK_PROJECT_ID }: { projectId?: string }) {
  const sessionUser = useSessionUser();
  const permissions = sessionUser?.permissions ?? [];
  const canRead = READ_PERMISSIONS.every((p) => hasPermission(permissions, p));
  const canManageSignals = hasPermission(permissions, SIGNAL_MANAGE_PERMISSION);
  const canExecuteActions = hasPermission(permissions, ACTION_EXECUTE_PERMISSION);
  const canManageCorrective = hasPermission(permissions, CORRECTIVE_MANAGE_PERMISSION);
  const canReadRetro = RETRO_READ_PERMISSIONS.every((p) => hasPermission(permissions, p));

  const control = useControl(projectId, { enabled: canRead });
  // План нужен контуру ради optimistic-lock (clientPlanVersion в apply) и живой шапки.
  const planning = usePlanning(projectId);
  const projectBase = useProjectBase(projectId, PROJECT_FALLBACK);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [expandedSignalId, setExpandedSignalId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [busy, setBusy] = useState(false);
  const [mutationErr, setMutationErr] = useState<ControlUiError | null>(null);
  // Квитанция применения действия этой сессии: реальный auditEventId + версия плана.
  const [applyReceipt, setApplyReceipt] = useState<{ label: string; planVersion: number; auditEventId: string } | null>(null);
  const [correctiveFor, setCorrectiveFor] = useState<ControlSignal | null>(null);

  const { loadRetrospective } = control;
  useEffect(() => {
    if (canReadRetro) void loadRetrospective();
  }, [canReadRetro, loadRetrospective]);

  // Последняя оценка по каждому KPI-определению (read-model отдаёт всю историю).
  const latestEvaluationByDefinition = useMemo(() => {
    const map = new Map<string, KpiEvaluation>();
    for (const evaluation of control.readModel?.evaluations ?? []) {
      const current = map.get(evaluation.definitionId);
      if (!current || evaluation.evaluatedAt >= current.evaluatedAt) map.set(evaluation.definitionId, evaluation);
    }
    return map;
  }, [control.readModel?.evaluations]);

  const signals = useMemo(() => {
    const list = control.readModel?.signals ?? [];
    return list
      .filter((signal) => statusFilter === "all" || signal.status === statusFilter)
      .filter((signal) => severityFilter === "all" || signal.severity === severityFilter)
      .sort((a, b) => (a.severity === b.severity ? b.updatedAt.localeCompare(a.updatedAt) : a.severity === "critical" ? -1 : 1));
  }, [control.readModel?.signals, statusFilter, severityFilter]);

  if (!canRead) {
    return (
      <DeliveryFrame project={{ ...PROJECT_FALLBACK, name: projectBase.name, code: projectBase.code }} projectId={projectId} activeTab="Контур">
        <SurfaceState
          status="forbidden"
          forbidden={{
            title: "Нет доступа к контуру управления",
            description: "Нужны права чтения плана проекта, KPI и сигналов управления. Обратитесь к администратору рабочей области."
          }}
        >
          <span />
        </SurfaceState>
      </DeliveryFrame>
    );
  }

  if (control.status !== "ready" || !control.readModel) {
    const surfaceStatus = control.status === "forbidden" ? "forbidden" : control.status === "loading" ? "loading" : "error";
    return (
      <DeliveryFrame project={{ ...PROJECT_FALLBACK, name: projectBase.name, code: projectBase.code }} projectId={projectId} activeTab="Контур">
        <SurfaceState status={surfaceStatus} error={control.error} onRetry={() => void control.reload()} errorFormat={controlErr} loadingLabel="Загрузка…">
          <span />
        </SurfaceState>
      </DeliveryFrame>
    );
  }

  const readModel = control.readModel;
  const planVersion = planning.readModel?.planVersion ?? null;
  const projectMeta = planning.readModel ? deriveProjectMeta(planning.readModel, projectBase) : { ...PROJECT_FALLBACK, name: projectBase.name, code: projectBase.code };

  const onEvaluate = async () => {
    setBusy(true);
    setMutationErr(null);
    const result = await control.evaluate();
    setBusy(false);
    if (result.ok) {
      toast.success(`Показатели пересчитаны: сигналов ${result.data.signals.length} · ${result.data.auditEventId}`);
      setPreview(null);
      await control.reload();
    } else {
      setMutationErr(result.error);
    }
  };

  const onSetSignalStatus = async (signal: ControlSignal, nextStatus: ControlSignalStatus) => {
    setBusy(true);
    setMutationErr(null);
    const result = await control.setSignalStatus(signal.id, nextStatus);
    setBusy(false);
    if (result.ok) {
      toast.success(`Статус сигнала: «${SIGNAL_STATUS_META[nextStatus].label}» · ${result.data.auditEventId}`);
      await control.reload();
    } else {
      setMutationErr(result.error);
    }
  };

  const onPreviewAction = async (signal: ControlSignal, action: ManagementActionCandidate) => {
    setPreview({ signalId: signal.id, actionId: action.id, status: "loading" });
    setMutationErr(null);
    const result = await control.previewAction(signal.id, action.id);
    if (result.ok) setPreview({ signalId: signal.id, actionId: action.id, status: "ready", data: result.data });
    else setPreview({ signalId: signal.id, actionId: action.id, status: "error", error: result.error });
  };

  const onApplyAction = async (signal: ControlSignal, action: ManagementActionCandidate) => {
    if (planVersion === null) return;
    setBusy(true);
    setMutationErr(null);
    const result = await control.applyAction(signal.id, action.id, planVersion);
    setBusy(false);
    if (result.ok) {
      setApplyReceipt({ label: action.label, planVersion: result.data.newPlanVersion, auditEventId: result.data.auditEventId });
      setPreview(null);
      toast.success(`Действие применено · план v${result.data.newPlanVersion}`);
      await Promise.all([control.reload(), planning.reload()]);
    } else {
      setMutationErr(result.error);
      // Конфликт версии плана или устаревший кандидат: обновляем данные, предпросмотр сбрасываем.
      if (result.error.code === "plan_version_conflict" || result.error.code === "action_candidate_not_found") {
        setPreview(null);
        await Promise.all([control.reload(), planning.reload()]);
      }
    }
  };

  const onCreateCorrective = async (signal: ControlSignal, input: { title: string; description?: string; dueDate?: string }) => {
    const result = await control.createCorrectiveAction(signal.id, input);
    if (result.ok) {
      toast.success(`Корректирующее действие создано · ${result.data.auditEventId}`);
      setCorrectiveFor(null);
      await control.reload();
      return null;
    }
    return result.error;
  };

  return (
    <DeliveryFrame project={projectMeta} projectId={projectId} activeTab="Контур">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Контур управления</h2>
          <p className="text-[length:var(--text-sm)] text-[var(--muted)]">KPI проекта, сигналы отклонений и управленческие действия: предпросмотр → применение с записью в историю.</p>
        </div>
        {canManageSignals ? (
          <div className="ml-auto">
            <ConfirmDialog
              title="Пересчитать показатели?"
              description="Пересчёт создаст новые оценки KPI и обновит сигналы отклонений. Операция записывается в историю изменений."
              confirmLabel="Пересчитать"
              destructive={false}
              onConfirm={onEvaluate}
            >
              <Button variant="secondary" size="sm" disabled={busy}>
                <RefreshCw className={cn("size-3.5", busy && "animate-spin")} aria-hidden />
                Пересчитать показатели
              </Button>
            </ConfirmDialog>
          </div>
        ) : null}
      </div>

      {applyReceipt ? (
        <div data-testid="control-apply-receipt" className="mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-md)] border border-[var(--success-border,var(--border))] bg-[var(--success-soft)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--success-text)]">
          <Check className="size-4 shrink-0" aria-hidden />
          <span>Применено «{applyReceipt.label}» — план v{applyReceipt.planVersion}.</span>
          <span className="mono text-[length:var(--text-2xs)] text-[var(--muted-strong)]">{applyReceipt.auditEventId}</span>
          <Link href={`/projects/${encodeURIComponent(projectId)}/commits?commit=${encodeURIComponent(applyReceipt.auditEventId)}`} className="font-medium text-[var(--accent)] underline-offset-2 hover:underline">Открыть в Коммитах</Link>
        </div>
      ) : null}

      {mutationErr ? (
        <div role="alert" className="mb-3 rounded-[var(--radius-sm)] border border-[var(--danger)] bg-[var(--danger-soft)] px-2.5 py-1.5 text-[length:var(--text-xs)] text-[var(--danger-text)]">
          {mutationErr.message} <span className="mono text-[length:var(--text-2xs)]">({mutationErr.code})</span>
        </div>
      ) : null}

      {/* ── KPI-панель: определения + последняя оценка ── */}
      <section data-testid="control-kpi-panel" className="mb-4">
        <h3 className="mb-2 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Показатели (KPI)</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {readModel.definitions.map((definition) => {
            const evaluation = latestEvaluationByDefinition.get(definition.id) ?? null;
            const severity = evaluation?.severity ?? null;
            const severityChip =
              severity === "warning" || severity === "critical"
                ? SEVERITY_META[severity]
                : severity === "ok"
                  ? { label: "в норме", cls: "bg-[var(--success-soft)] text-[var(--success-text)]" }
                  : null;
            return (
              <div key={definition.id} data-testid="control-kpi-card" className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-3 shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">{definition.label}</span>
                  {severityChip ? <Chip label={severityChip.label} cls={severityChip.cls} /> : null}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  {evaluation ? (
                    <>
                      <span className="mono text-[length:var(--text-lg)] font-bold tabular-nums text-[var(--text)]">{evaluation.calculatedValue}</span>
                      <span className="text-[length:var(--text-xs)] text-[var(--muted)]">{KPI_UNIT_LABEL[definition.unit]}</span>
                      <span className="ml-auto text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{ddmmyyyy(evaluation.evaluatedAt)}</span>
                    </>
                  ) : (
                    <span className="text-[length:var(--text-xs)] text-[var(--muted)]">нет расчёта — выполните пересчёт показателей</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Сигналы отклонений ── */}
      <section className="mb-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Сигналы ({signals.length})</h3>
          <div className="ml-auto flex items-center gap-1.5">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)} aria-label="Фильтр по статусу" className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[length:var(--text-sm)] outline-none focus:border-[var(--accent)]">
              <option value="all">Все статусы</option>
              <option value="open">Открыт</option>
              <option value="acknowledged">В работе</option>
              <option value="resolved">Решён</option>
              <option value="accepted_risk">Риск принят</option>
            </select>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)} aria-label="Фильтр по важности" className="h-7 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[length:var(--text-sm)] outline-none focus:border-[var(--accent)]">
              <option value="all">Любая важность</option>
              <option value="critical">Критично</option>
              <option value="warning">Предупреждение</option>
            </select>
          </div>
        </div>

        {signals.length === 0 ? (
          <EmptyState
            title="Сигналов нет"
            description={readModel.signals.length > 0 ? "Под текущий фильтр не попал ни один сигнал." : "Отклонений не зафиксировано. Пересчёт показателей создаёт сигналы при выходе KPI за пороги."}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {signals.map((signal) => {
              const expanded = expandedSignalId === signal.id;
              const actionable = signal.scenarioProposals.filter((candidate) => (candidate.planDelta?.commands.length ?? 0) > 0);
              return (
                <div key={signal.id} data-testid="control-signal-card" data-severity={signal.severity} data-status={signal.status} className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-3 shadow-[var(--shadow-card)]">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <Activity className="size-4 shrink-0 text-[var(--muted-soft)]" aria-hidden />
                    <div className="min-w-[220px] flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Chip label={SEVERITY_META[signal.severity].label} cls={SEVERITY_META[signal.severity].cls} />
                        <Chip label={SIGNAL_STATUS_META[signal.status].label} cls={SIGNAL_STATUS_META[signal.status].cls} />
                        <span className="mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{signal.sourceMetric}</span>
                      </div>
                      <div className="mt-1 text-[length:var(--text-sm)] text-[var(--text)]">{signal.explanation}</div>
                      <div className="mt-0.5 text-[length:var(--text-2xs)] text-[var(--muted-soft)]">обновлён {ddmmyyyy(signal.updatedAt)}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {canManageSignals && signal.status === "open" ? (
                        <ConfirmDialog title="Взять сигнал в работу?" description="Статус сигнала станет «В работе». Операция записывается в историю." confirmLabel="Взять в работу" destructive={false} onConfirm={() => onSetSignalStatus(signal, "acknowledged")}>
                          <Button variant="ghost" size="sm" disabled={busy}>Взять в работу</Button>
                        </ConfirmDialog>
                      ) : null}
                      {canManageSignals && (signal.status === "open" || signal.status === "acknowledged") ? (
                        <ConfirmDialog title="Отметить сигнал решённым?" description="Статус сигнала станет «Решён». Операция записывается в историю." confirmLabel="Решён" destructive={false} onConfirm={() => onSetSignalStatus(signal, "resolved")}>
                          <Button variant="ghost" size="sm" disabled={busy}>Решён</Button>
                        </ConfirmDialog>
                      ) : null}
                      {canManageCorrective ? (
                        <Button variant="ghost" size="sm" onClick={() => setCorrectiveFor(signal)}>
                          <Plus className="size-3.5" aria-hidden />
                          Корректирующее действие
                        </Button>
                      ) : null}
                      {signal.scenarioProposals.length > 0 ? (
                        <Button variant="secondary" size="sm" onClick={() => { setExpandedSignalId(expanded ? null : signal.id); setPreview(null); }}>
                          {expanded ? "Скрыть действия" : `Действия (${signal.scenarioProposals.length})`}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {/* ── Кандидаты управленческих действий: предпросмотр → применение ── */}
                  {expanded ? (
                    <div className="mt-3 flex flex-col gap-2 border-t border-[var(--border)] pt-3">
                      {signal.scenarioProposals.map((candidate) => {
                        const hasDelta = (candidate.planDelta?.commands.length ?? 0) > 0;
                        const candidatePreview = preview && preview.signalId === signal.id && preview.actionId === candidate.id ? preview : null;
                        return (
                          <div key={candidate.id} data-testid="control-action-candidate" className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] p-2.5">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                              <div className="min-w-[200px] flex-1">
                                <div className="text-[length:var(--text-sm)] font-medium text-[var(--text-strong)]">{candidate.label}</div>
                                <div className="mt-0.5 text-[length:var(--text-xs)] text-[var(--muted)]">{candidate.explainability.reason}</div>
                                {candidate.requiredPermissions.length > 0 ? (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {candidate.requiredPermissions.map((permission) => (
                                      <span key={permission} className="inline-flex items-center rounded-full bg-[var(--panel-strong)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-medium text-[var(--muted-strong)]">Требуется: {PERMISSION_LABEL[permission] ?? permission}</span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 items-center gap-2 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
                                <span className="mono tabular-nums">Δ срок {candidate.explainability.deadlineDeltaDays} дн</span>
                                <span className="mono tabular-nums">перегруз {hours(candidate.explainability.overloadMinutes)} ч</span>
                                <span className="mono tabular-nums">риск {candidate.explainability.riskScore}</span>
                              </div>
                              {hasDelta && canExecuteActions ? (
                                <Button variant="secondary" size="sm" disabled={candidatePreview?.status === "loading"} onClick={() => void onPreviewAction(signal, candidate)}>
                                  {candidatePreview?.status === "loading" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                                  Предпросмотр
                                </Button>
                              ) : !hasDelta ? (
                                <span className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">без изменений плана</span>
                              ) : null}
                            </div>

                            {candidatePreview?.status === "error" ? (
                              <div role="alert" className="mt-2 rounded-[var(--radius-sm)] border border-[var(--danger)] bg-[var(--danger-soft)] px-2.5 py-1.5 text-[length:var(--text-xs)] text-[var(--danger-text)]">
                                {candidatePreview.error.message} <span className="mono text-[length:var(--text-2xs)]">({candidatePreview.error.code})</span>
                              </div>
                            ) : null}

                            {candidatePreview?.status === "ready" ? (
                              <div data-testid="control-action-preview" className="mt-2 rounded-[var(--radius-md)] border border-[var(--info)] bg-[var(--panel)] p-2.5">
                                <div className="mb-1.5 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Предпросмотр (ничего не сохранено в плане)</div>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--text-xs)] text-[var(--text)]">
                                  <span>Команд плана: <span className="mono font-semibold">{candidatePreview.data.action.planDelta?.commands.length ?? 0}</span></span>
                                  <span>Затронуто задач: <span className="mono font-semibold">{candidatePreview.data.action.explainability.changedTaskIds.length}</span></span>
                                  <span>Δ срок: <span className="mono font-semibold">{candidatePreview.data.action.explainability.deadlineDeltaDays} дн</span></span>
                                  <span>Остаточный перегруз: <span className="mono font-semibold">{hours(candidatePreview.data.action.explainability.overloadMinutes)} ч</span></span>
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                  <span className="mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{candidatePreview.data.auditEventId}</span>
                                  <div className="ml-auto flex items-center gap-1.5">
                                    <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
                                      <X className="size-3.5" aria-hidden />
                                      Отменить
                                    </Button>
                                    <ConfirmDialog
                                      title="Применить действие?"
                                      description={`«${candidate.label}»: изменения плана применяются одним коммитом с записью в историю. План получит новую версию.`}
                                      confirmLabel="Применить"
                                      destructive={false}
                                      onConfirm={() => onApplyAction(signal, candidate)}
                                    >
                                      <Button variant="default" size="sm" disabled={busy || planVersion === null} title={planVersion === null ? "План ещё загружается" : undefined}>
                                        <Check className="size-3.5" aria-hidden />
                                        Применить
                                      </Button>
                                    </ConfirmDialog>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      {actionable.length === 0 ? (
                        <div className="text-[length:var(--text-xs)] text-[var(--muted)]">Готовых изменений плана у сигнала нет — доступно создание корректирующего действия.</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Корректирующие действия ── */}
      <section data-testid="control-corrective-list" className="mb-4">
        <h3 className="mb-2 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Корректирующие действия ({readModel.correctiveActions.length})</h3>
        {readModel.correctiveActions.length === 0 ? (
          <EmptyState title="Корректирующих действий нет" description="Создайте действие из карточки сигнала, чтобы зафиксировать управленческую реакцию." />
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
            {readModel.correctiveActions.map((action) => (
              <div key={action.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--border-subtle)] px-3 py-2 last:border-b-0">
                <span className="min-w-[200px] flex-1 text-[length:var(--text-sm)] font-medium text-[var(--text)]">{action.title}</span>
                {action.description ? <span className="min-w-0 flex-1 truncate text-[length:var(--text-xs)] text-[var(--muted)]">{action.description}</span> : null}
                <span className="mono shrink-0 text-[length:var(--text-xs)] text-[var(--muted-strong)]">до {ddmmyyyy(action.dueDate)}</span>
                <Chip label={CORRECTIVE_STATUS_LABEL[action.status] ?? action.status} cls="bg-[var(--panel-strong)] text-[var(--muted-strong)]" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Ретроспектива (read): закрытие проекта + уроки ── */}
      {canReadRetro ? (
        <section data-testid="control-retrospective" className="mb-4">
          <h3 className="mb-2 text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.03em] text-[var(--muted-soft)]">Ретроспектива</h3>
          {control.retrospective.status === "loading" ? (
            <div className="flex h-[80px] items-center justify-center gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] text-[length:var(--text-sm)] text-[var(--muted)]">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Загрузка ретроспективы…
            </div>
          ) : control.retrospective.status === "forbidden" ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] px-4 py-6 text-center text-[length:var(--text-sm)] text-[var(--muted)]">Недостаточно прав для просмотра ретроспективы.</div>
          ) : control.retrospective.status === "error" ? (
            <div role="alert" className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-[length:var(--text-sm)] text-[var(--danger-text)]">
              <span>{control.retrospective.error.message} <span className="mono text-[length:var(--text-2xs)]">({control.retrospective.error.code})</span></span>
              <Button variant="ghost" size="sm" onClick={() => void control.loadRetrospective()}>Повторить</Button>
            </div>
          ) : control.retrospective.view.snapshot === null ? (
            <EmptyState title="Проект ещё не закрыт" description="Ретроспектива (план/факт и уроки) появится после закрытия проекта." />
          ) : (
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-3 shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[length:var(--text-sm)] text-[var(--text)]">
                <span>Закрыт {ddmmyyyy(control.retrospective.view.snapshot.closedAt)}</span>
                <span className="text-[var(--muted)]">Причина: {control.retrospective.view.snapshot.closeReason}</span>
                <span className="mono tabular-nums text-[var(--muted-strong)]">план {hours(control.retrospective.view.snapshot.planFactSummary.plannedWorkMinutes)} ч · факт {hours(control.retrospective.view.snapshot.planFactSummary.actualWorkMinutes)} ч</span>
                <span className="mono tabular-nums text-[var(--muted-strong)]">Δ срок {control.retrospective.view.snapshot.planFactSummary.scheduleVarianceDays} дн</span>
              </div>
              {control.retrospective.view.lessons.length > 0 ? (
                <div className="mt-2 border-t border-[var(--border-subtle)] pt-2">
                  <div className="mb-1 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-[var(--muted-soft)]">Уроки ({control.retrospective.view.lessons.length})</div>
                  {control.retrospective.view.lessons.map((lesson) => (
                    <div key={lesson.id} className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] py-1.5 last:border-b-0 text-[length:var(--text-xs)]">
                      <Chip label={LESSON_CATEGORY_LABEL[lesson.category] ?? lesson.category} cls="bg-[var(--panel-strong)] text-[var(--muted-strong)]" />
                      <span className="font-medium text-[var(--text)]">{lesson.title}</span>
                      <span className="min-w-0 flex-1 truncate text-[var(--muted)]">{lesson.body}</span>
                      <Chip label={LESSON_IMPACT_META[lesson.impact]?.label ?? lesson.impact} cls={LESSON_IMPACT_META[lesson.impact]?.cls ?? "bg-[var(--panel-strong)] text-[var(--muted-strong)]"} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-[length:var(--text-xs)] text-[var(--muted)]">Уроков пока не записано.</div>
              )}
            </div>
          )}
        </section>
      ) : null}

      {correctiveFor ? (
        <CorrectiveActionDialog
          signal={correctiveFor}
          onClose={() => setCorrectiveFor(null)}
          onSubmit={(input) => onCreateCorrective(correctiveFor, input)}
        />
      ) : null}
    </DeliveryFrame>
  );
}

/** Создание корректирующего действия: модальная форма (title обязателен) → POST → квитанция-toast. */
function CorrectiveActionDialog({
  signal,
  onClose,
  onSubmit
}: {
  signal: ControlSignal;
  onClose: () => void;
  onSubmit: (input: { title: string; description?: string; dueDate?: string }) => Promise<ControlUiError | null>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<ControlUiError | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      setFieldError("Укажите название действия");
      return;
    }
    setBusy(true);
    setSubmitError(null);
    const error = await onSubmit({
      title: title.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(dueDate ? { dueDate } : {})
    });
    setBusy(false);
    if (error) setSubmitError(error);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Корректирующее действие</DialogTitle>
          <DialogDescription>По сигналу: {signal.explanation}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <label className="text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">
            Название
            <input
              value={title}
              aria-invalid={fieldError ? true : undefined}
              onChange={(e) => { setFieldError(null); setTitle(e.target.value); }}
              placeholder="напр. пересогласовать сроки этапа"
              className="mt-1 h-8 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[length:var(--text-sm)] outline-none focus:border-[var(--accent)] aria-[invalid]:border-[var(--danger)]"
            />
          </label>
          {fieldError ? <span role="alert" className="text-[length:var(--text-xs)] font-medium text-[var(--danger-text)]">{fieldError}</span> : null}
          <label className="text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">
            Описание (необязательно)
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 h-8 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[length:var(--text-sm)] outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">
            Срок (необязательно)
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 h-8 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[length:var(--text-sm)] outline-none focus:border-[var(--accent)]"
            />
          </label>
          {submitError ? (
            <div role="alert" className="rounded-[var(--radius-sm)] border border-[var(--danger)] bg-[var(--danger-soft)] px-2.5 py-1.5 text-[length:var(--text-xs)] text-[var(--danger-text)]">
              {submitError.message} <span className="mono text-[length:var(--text-2xs)]">({submitError.code})</span>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={busy}>Отмена</Button>
          </DialogClose>
          <Button variant="default" disabled={busy} onClick={() => void submit()}>
            {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
