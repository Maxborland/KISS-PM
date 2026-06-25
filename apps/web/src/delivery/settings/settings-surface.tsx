"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Pencil, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { SurfaceState } from "@/components/domain/surface-state";
import { cn } from "@/lib/cn";
import { DeliveryFrame, type ProjectMeta } from "@/delivery/ui/delivery-frame";
import { PROJECT_FALLBACK, planningErr } from "@/delivery/lib/project-chrome";
import { isoToDay, MOCK_PROJECT_ID } from "@/delivery/lib/mock-planning-backend";
import { usePlanning } from "@/delivery/lib/use-planning";
import { demoAction } from "@/views/lib/demo";
import type { PlanningCommand } from "@kiss-pm/domain";

type ProjRaw = { id: string; sourceType: string; sourceOpportunityId: string | null; plannedStart: string; plannedFinish: string; deadline: string | null; calendarId: string | null };
type CalRaw = { id: string; workingWeekdays: number[]; workingMinutesPerDay: number };
type TaskRaw = { id: string; schedulingMode: "auto" | "manual"; durationMinutes: number | null; customFields?: { kind?: string } };

const PROJECT: ProjectMeta = { name: "Производственный портал · Релиз 2", code: "ПР", status: "В работе", statusTone: "info", planVersion: "v17", deadline: "12.07.2026", finish: "14.06.2026", variance: { label: "+2 дня к базовому плану B2", tone: "warning" } };
// PROJECT_FALLBACK (шапка loading/error) импортируется из delivery/lib/project-chrome
const DOW_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const ddmmyyyy = (iso: string | null) => { if (!iso) return "—"; const d = new Date(iso + "T00:00:00Z"); return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`; };
const calLabel = (c: CalRaw) => { const days = c.workingWeekdays.map((d) => DOW_RU[d] ?? "?"); const span = days.length ? `${days[0]}–${days[days.length - 1]}` : "—"; return `Производственный · ${span} ${Math.round(c.workingMinutesPerDay / 60)} ч`; };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
      <h3 className="font-[family-name:var(--font-display)] text-[15px] font-bold leading-tight tracking-[-0.015em] text-[var(--text-strong)]">{title}</h3>
      {hint ? <p className="mt-0.5 mb-3 text-[length:var(--text-sm)] text-[var(--muted-soft)]">{hint}</p> : <div className="mb-3" />}
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[length:var(--text-xs)] font-medium uppercase tracking-[0.04em] text-[var(--muted-soft)]">{label}</span>
      {children}
    </div>
  );
}
const ROValue = ({ children, mono }: { children: React.ReactNode; mono?: boolean }) => (
  <div className={cn("rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel-subtle)] px-2.5 py-1.5 text-[length:var(--text-sm)] text-[var(--text)]", mono && "v4-num")}>{children}</div>
);

export function ProjectSettings() {
  const { readModel, status, error, reload, apply } = usePlanning(MOCK_PROJECT_ID);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editDeadline, setEditDeadline] = useState(false);
  const [draftDeadline, setDraftDeadline] = useState("");
  const [reason, setReason] = useState("");

  const model = useMemo(() => {
    if (!readModel) return null;
    const project = readModel.project as unknown as ProjRaw;
    const calendars = ((readModel as unknown as { calendars: CalRaw[] }).calendars ?? []);
    const finish = (readModel.calculatedPlan as unknown as { projectFinish: string }).projectFinish;
    const leaves = (readModel.authored as unknown as { tasks: TaskRaw[] }).tasks.filter((t) => t.durationMinutes != null && t.customFields?.kind !== "milestone");
    const autoCount = leaves.filter((t) => t.schedulingMode === "auto").length;
    const manualCount = leaves.filter((t) => t.schedulingMode === "manual").length;
    return { project, calendars, finish, autoCount, manualCount, leafCount: leaves.length };
  }, [readModel]);

  // Верхнеуровневое состояние поверхности через <SurfaceState> (loading/forbidden/error);
  // готовый контент — только при наличии model+readModel. Frame-обёртку сохраняем.
  if (status !== "ready" || !model || !readModel) {
    const surfaceStatus = status === "forbidden" ? "forbidden" : status === "loading" ? "loading" : "error";
    return (
      <DeliveryFrame project={PROJECT_FALLBACK} activeTab="Настройки">
        <SurfaceState status={surfaceStatus} error={error} onRetry={() => void reload()} errorFormat={planningErr} loadingLabel="Загрузка настроек…">
          <span />
        </SurfaceState>
      </DeliveryFrame>
    );
  }

  const { project } = model;
  const finishDay = isoToDay(model.finish);
  // дедлайн домена nullable: без него резерв не считаем (иначе NaN), показываем «—» как deriveProjectMeta
  const deadlineDay = project.deadline ? isoToDay(project.deadline) : null;
  const reserveDays = deadlineDay != null ? deadlineDay - finishDay : null;
  const projectMeta: ProjectMeta = {
    ...PROJECT, planVersion: `v${readModel.planVersion}`, deadline: ddmmyyyy(project.deadline), finish: ddmmyyyy(model.finish),
    ...(reserveDays == null ? {} : reserveDays < 0 ? { variance: { label: `+${-reserveDays} дн. к дедлайну`, tone: "danger" as const } } : { variance: { label: `резерв ${reserveDays} дн. до дедлайна`, tone: "success" as const } })
  };

  const reasonOk = reason.trim().length > 0;
  const deadlineChanged = draftDeadline !== "" && draftDeadline !== project.deadline;
  // календарь — read-only из РЕАЛЬНОГО project.calendarId; детали рабочей недели — из readModel.calendars
  // (теперь top-level и в боевом read-model). fallback на id/«—» оставлен как защита.
  const calCurrent = model.calendars.find((c) => c.id === project.calendarId);
  const calendarText = calCurrent ? calLabel(calCurrent) : project.calendarId ?? "— (не задан)";

  async function applyCmd(command: PlanningCommand, okMsg: string, after?: () => void) {
    setBusy(true); setNotice(null);
    const res = await apply(command);
    setBusy(false);
    if (res.ok) { setNotice(`${okMsg} · коммит v${res.planVersion}`); after?.(); }
    else setNotice(res.conflict ? "Конфликт версий — перезагружено" : `Отклонено: ${res.issues?.[0]?.message ?? res.message}`);
  }

  const openDeadlineEdit = () => { setDraftDeadline(project.deadline ?? ""); setReason(""); setEditDeadline(true); setNotice(null); };
  const submitDeadline = () => void applyCmd({ type: "project.deadline.move", payload: { deadline: draftDeadline, reason: reason.trim() } } as PlanningCommand, "Дедлайн перенесён", () => { setEditDeadline(false); setReason(""); });

  return (
    <DeliveryFrame project={projectMeta} activeTab="Настройки">
      <div className="mx-auto max-w-[860px]">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">Настройки проекта</h2>
            <p className="text-[length:var(--text-sm)] text-[var(--muted)]">Project-level параметры. Настройки рабочей области (labels, роли) — в Workspace.</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--accent)]">Прототип · in-memory</span>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          Дедлайн релиза редактируется через реальный контракт project.deadline.move (дата + причина → preview/apply, bump версии). Календарь и остальные поля — read-only из плана. Данные in-memory.
        </div>

        <div className="flex flex-col gap-3">
          {/* Календарь по умолчанию — read-only из project.calendarId (каталог календарей вне планировочного read-model) */}
          <Section title="Календарь по умолчанию" hint="Используется для всех задач без явного переопределения.">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Календарь проекта">
                <div className="flex h-9 min-w-[260px] items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)]">
                  <CalendarDays className="size-4 shrink-0 text-[var(--muted)]" aria-hidden />{calendarText}
                </div>
              </Field>
              <Button variant="secondary" size="sm" {...demoAction("переход на вкладку «Календари»")}>Открыть Календарь</Button>
            </div>
            <p className="mt-2 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Смена календаря по умолчанию выполняется командой <span className="v4-mono">project.settings.update</span> (каскад на задачи). Каталог календарей не входит в планировочный read-model — он приходит из отдельного источника рабочей области, поэтому здесь поле read-only. Исключения и рабочая неделя — на вкладке «Календари».</p>
          </Section>

          {/* Поля проекта — read-only + редактируемый дедлайн */}
          <Section title="Поля проекта" hint="Старт и расчётный финиш считает движок. Дедлайн — внешнее обязательство, переносится командой с причиной.">
            <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <Field label="Старт проекта"><ROValue mono>{ddmmyyyy(project.plannedStart)}</ROValue></Field>
              <Field label="Финиш расчётный">
                <ROValue mono>
                  <span className="flex items-center justify-between gap-2">
                    {ddmmyyyy(model.finish)}
                    {reserveDays == null ? <Chip>дедлайн не задан</Chip> : reserveDays < 0 ? <Chip variant="danger">за дедлайном +{-reserveDays} дн.</Chip> : <Chip variant="success">резерв {reserveDays} дн.</Chip>}
                  </span>
                </ROValue>
              </Field>
              <Field label="Источник"><ROValue>{project.sourceType === "opportunity" ? "Сделка CRM" : project.sourceType}{project.sourceOpportunityId ? ` · ${project.sourceOpportunityId}` : ""}</ROValue></Field>
              <Field label="ID проекта · версия плана"><ROValue mono>{project.id} · v{readModel.planVersion}</ROValue></Field>
              <div className="sm:col-span-2">
                <Field label="Дедлайн релиза">
                  {editDeadline ? (
                    <div className="rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] p-3">
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="flex flex-col gap-1 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Новая дата<Input type="date" value={draftDeadline} disabled={busy} onChange={(e) => setDraftDeadline(e.target.value)} className="h-9 w-[170px]" /></label>
                        <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Причина переноса (обязательно)<Input type="text" value={reason} disabled={busy} placeholder="напр. сдвиг по запросу заказчика" onChange={(e) => setReason(e.target.value)} aria-invalid={!reasonOk} /></label>
                      </div>
                      <div className="mt-2.5 flex items-center gap-2">
                        <Button variant="default" size="sm" disabled={busy || !reasonOk || !deadlineChanged} onClick={submitDeadline}>Применить перенос</Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setEditDeadline(false); setReason(""); }}><X className="size-3.5" aria-hidden />Отмена</Button>
                        {!deadlineChanged && draftDeadline !== "" ? <span className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Дата не изменилась</span> : null}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <ROValue mono>{ddmmyyyy(project.deadline)}</ROValue>
                      <Button variant="secondary" size="sm" disabled={busy} onClick={openDeadlineEdit}><Pencil className="size-3.5" aria-hidden />Изменить</Button>
                    </div>
                  )}
                </Field>
              </div>
            </div>
          </Section>

          {/* Режим планирования — сводка (read-only, задаётся per-task) */}
          <Section title="Режим планирования" hint="Режим — свойство задачи (авто пересчитывается по предшественникам, ручной закреплён). Меняется на Графике / в Инспекторе задачи, а не глобально.">
            <div className="flex flex-wrap items-center gap-2">
              <Chip variant="info">Авто · {model.autoCount}</Chip>
              <Chip variant="warning">Ручной · {model.manualCount}</Chip>
              <span className="text-[length:var(--text-sm)] text-[var(--muted)]">из {model.leafCount} задач</span>
            </div>
          </Section>

          {/* Права на проект — честная заметка вместо выдуманной таблицы */}
          <Section title="Права на проект" hint="Управление ролями и пользователями — в Workspace → Доступ.">
            <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-2.5 text-[length:var(--text-sm)] text-[var(--muted-strong)]">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--muted)]" aria-hidden />
              <span>Сводка ролей и пользователей не входит в планировочный read-model — она приходит из RBAC рабочей области. В прототипе данных доступа нет, поэтому таблица не показывается (вместо выдуманных имён).</span>
            </div>
          </Section>

          {/* Интеграции — честный роадмап (disabled) */}
          <Section title="Интеграции" hint="Внешние синхронизации. Подключатся в рабочем приложении по мере готовности.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { name: "Bitrix24", tag: "Phase C", desc: "Двусторонняя синхронизация задач и сделок. Появится в следующей фазе.", btn: "Подключить", what: "интеграция Bitrix24" },
                { name: "MS Project (MSPDI)", tag: "не планируется", desc: "Импорт/экспорт MSPDI не входит в roadmap. Используйте API планирования.", btn: "Импорт MSPDI", what: "импорт MSPDI" }
              ].map((it) => (
                <div key={it.name} className="flex flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel-subtle)] p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">{it.name}</span>
                    <span className="rounded-full bg-[var(--panel-strong)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted-strong)]">{it.tag}</span>
                  </div>
                  <p className="text-[length:var(--text-xs)] text-[var(--muted)]">{it.desc}</p>
                  <Button variant="secondary" size="sm" className="mt-2.5 self-start" {...demoAction(it.what)}>{it.btn}</Button>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {notice ? <div className="mt-3 text-[length:var(--text-xs)] text-[var(--muted-strong)]">{notice}</div> : null}
      </div>
    </DeliveryFrame>
  );
}
