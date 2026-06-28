"use client";

import { useMemo, useState } from "react";

import { SurfaceState } from "@/components/domain/surface-state";
import { DeliveryFrame, type ProjectMeta } from "@/delivery/ui/delivery-frame";
import { PROJECT_FALLBACK, deriveProjectMeta, planningErr } from "@/delivery/lib/project-chrome";
import { dayToIso, isoToDay, MIN_PER_DAY, MOCK_PROJECT_ID, RESOURCES } from "@/delivery/lib/mock-planning-backend";
import { usePlanning } from "@/delivery/lib/use-planning";
import {
  ResourceLoadMatrix,
  type MatrixAssignment,
  type MatrixData,
  type MatrixScope,
  type RBucket
} from "@/delivery/resources/resource-load-matrix";
import { TaskModal, type TaskModalValues } from "@/delivery/schedule/schedule-editors";
import type { PlanningCommand } from "@kiss-pm/domain";

type RawTask = { id: string; wbsCode: string; title: string; durationMinutes: number | null; workMinutes: number; percentComplete: number };
type RawAssignment = MatrixAssignment;

const PROJECT: ProjectMeta = { name: "Производственный портал · Релиз 2", code: "ПР", status: "В работе", statusTone: "info", planVersion: "v17", deadline: "12.07.2026", finish: "14.06.2026", variance: { label: "+2 дня к baseline B2", tone: "warning" } };
const SCOPE: MatrixScope = { level: "project", groupLevels: ["team", "role", "person"], windowNoun: "проект" };

let NID = 0;
const nid = (p: string) => `${p}-n${(NID += 1)}`;

export function ProjectResources({ projectId = MOCK_PROJECT_ID }: { projectId?: string }) {
  const { readModel, status, error, reload, apply, applyBatch } = usePlanning(projectId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [taskModal, setTaskModal] = useState<{ mode: "create" | "edit"; taskId?: string; asgId?: string; initial: TaskModalValues } | null>(null);

  const model = useMemo(() => {
    if (!readModel) return null;
    const rl = readModel.resourceLoad as unknown as { buckets: RBucket[]; acceptedOverloads: string[] };
    const authored = readModel.authored as unknown as { tasks: RawTask[]; assignments: RawAssignment[] };
    const calc = (readModel.calculatedPlan as unknown as { tasks: Array<{ id: string; calculatedStart: string }> }).tasks;
    const rawById = new Map(authored.tasks.map((t) => [t.id, t]));
    // id календаря для команд отсутствия = реальный календарь плана (project.calendarId / первый из read-model),
    // а не литерал "cal-5x8": на live чужой calendarId не пройдёт precondition команды. Инвариант «live = смена apiOrigin».
    const calendars = (readModel as unknown as { calendars: Array<{ id: string }> }).calendars ?? [];
    const projCalId = (readModel.project as { calendarId?: unknown }).calendarId;
    const calendarId = (typeof projCalId === "string" ? calendars.find((c) => c.id === projCalId)?.id : undefined) ?? calendars[0]?.id ?? "cal-5x8";
    const data: MatrixData = {
      buckets: rl.buckets ?? [],
      resources: RESOURCES,
      taskById: new Map(authored.tasks.map((t) => [t.id, { id: t.id, wbsCode: t.wbsCode, title: t.title, workMinutes: t.workMinutes, percentComplete: t.percentComplete }])),
      asgById: new Map(authored.assignments.map((x) => [x.id, x])),
      calcStartById: new Map(calc.map((c) => [c.id, c.calculatedStart])),
      accepted: new Set(rl.acceptedOverloads ?? [])
    };
    return { data, rawById, calendarId };
  }, [readModel]);

  // Верхнеуровневое состояние поверхности через <SurfaceState> (loading/forbidden/error);
  // готовый контент — только при наличии model+readModel. Frame-обёртку сохраняем.
  if (status !== "ready" || !model || !readModel) {
    const surfaceStatus = status === "forbidden" ? "forbidden" : status === "loading" ? "loading" : "error";
    return (
      <DeliveryFrame project={PROJECT_FALLBACK} activeTab="Ресурсы">
        <SurfaceState status={surfaceStatus} error={error} onRetry={() => void reload()} errorFormat={planningErr} loadingLabel="Загрузка ресурсной загрузки…">
          <span />
        </SurfaceState>
      </DeliveryFrame>
    );
  }

  const projectMeta = deriveProjectMeta(readModel, PROJECT);

  async function applyCmd(command: PlanningCommand) {
    setBusy(true);
    setNotice(null);
    const res = await apply(command);
    setBusy(false);
    if (res.ok) setNotice(`Коммит v${res.planVersion} применён`);
    else setNotice(res.conflict ? "Конфликт версий — перезагружено" : `Отклонено: ${res.issues?.[0]?.message ?? res.message}`);
  }

  const openCreateTask = (presetResourceId?: string) => setTaskModal({ mode: "create", initial: { title: "", assigneeId: presetResourceId ?? "", startIso: "", durDays: 5, workH: 40, pct: 0 } });
  const openEditTask = (taskId: string) => {
    const t = model.rawById.get(taskId);
    if (!t) return;
    const asg = [...model.data.asgById.values()].find((x) => x.taskId === taskId);
    // запоминаем id текущего назначения, чтобы upsert обновлял его, а не плодил второе (двойной учёт нагрузки)
    setTaskModal({ mode: "edit", taskId, ...(asg ? { asgId: asg.id } : {}), initial: { title: t.title, assigneeId: asg?.resourceId ?? "", startIso: model.data.calcStartById.get(taskId) ?? "", durDays: Math.round((t.durationMinutes ?? 0) / MIN_PER_DAY), workH: Math.round(t.workMinutes / 60), pct: t.percentComplete } });
  };

  const acceptOverload = (resourceId: string, dateIso: string) =>
    // канонический ключ перегрузки домена — `${resourceId}:${dateIso}` (ISO), как в scenarioPlanning/commandReducer;
    // payload пишется в acceptedRiskIds дословно, поэтому отправляем именно каноничную форму, а не resourceId|day.
    void applyCmd({ type: "risk.accept_overload", payload: { overloadId: `${resourceId}:${dateIso}`, acceptedRiskReason: "Подтверждено на ресурсной матрице" } } as PlanningCommand);

  const editUnits = (asg: MatrixAssignment, hours: number) => {
    const wm = Math.round(hours * 60);
    if (wm !== asg.workMinutes) void applyCmd({ type: "assignment.upsert", payload: { id: asg.id, taskId: asg.taskId, resourceId: asg.resourceId, role: asg.role, unitsPermille: asg.unitsPermille, workMinutes: wm } } as PlanningCommand);
  };

  async function submitTaskModal(v: TaskModalValues) {
    const m = taskModal;
    setTaskModal(null);
    if (!m) return;
    const fin = (iso: string, dur: number) => dayToIso(isoToDay(iso) + dur);
    const cmds: PlanningCommand[] = [];
    if (m.mode === "create") {
      const id = nid("t");
      cmds.push({ type: "task.create", payload: { id, projectId, parentTaskId: null, title: v.title, statusId: "todo", plannedStart: v.startIso || null, plannedFinish: v.startIso ? fin(v.startIso, v.durDays) : null, durationMinutes: v.durDays * MIN_PER_DAY, workMinutes: v.workH * 60, assignments: [] } } as PlanningCommand);
      if (v.startIso) cmds.push({ type: "task.update_schedule", payload: { taskId: id, plannedStart: v.startIso, plannedFinish: fin(v.startIso, v.durDays) } } as PlanningCommand);
      if (v.assigneeId) cmds.push({ type: "assignment.upsert", payload: { id: nid("a"), taskId: id, resourceId: v.assigneeId, role: "executor", unitsPermille: 1000, workMinutes: v.workH * 60 } } as PlanningCommand);
      if (v.pct > 0) cmds.push({ type: "task.update_progress", payload: { taskId: id, percentComplete: v.pct } } as PlanningCommand);
    } else if (m.taskId) {
      const id = m.taskId;
      cmds.push({ type: "task.update_identity", payload: { taskId: id, title: v.title } } as PlanningCommand);
      cmds.push({ type: "task.update_work_model", payload: { taskId: id, taskType: "fixed_duration", effortDriven: false, durationMinutes: v.durDays * MIN_PER_DAY, workMinutes: v.workH * 60 } } as PlanningCommand);
      if (v.startIso) cmds.push({ type: "task.update_schedule", payload: { taskId: id, plannedStart: v.startIso, plannedFinish: fin(v.startIso, v.durDays) } } as PlanningCommand);
      cmds.push({ type: "task.update_progress", payload: { taskId: id, percentComplete: v.pct } } as PlanningCommand);
      // upsert по id СУЩЕСТВУЮЩЕГО назначения (reduceAssignmentUpsert ключ — payload.id), новый id только когда назначения ещё нет
      if (v.assigneeId) cmds.push({ type: "assignment.upsert", payload: { id: m.asgId ?? nid("a"), taskId: id, resourceId: v.assigneeId, role: "executor", unitsPermille: 1000, workMinutes: v.workH * 60 } } as PlanningCommand);
    }
    if (!cmds.length) return;
    setBusy(true);
    const res = await applyBatch(cmds);
    setBusy(false);
    setNotice(res.ok ? `Задача сохранена · коммит v${res.planVersion}` : `Отклонено: ${res.message}`);
  }

  async function doAbsence(resourceId: string, typeLabel: string, start: string, finish: string) {
    if (!model) return;
    const cmds: PlanningCommand[] = [];
    const end = isoToDay(finish);
    for (let d = isoToDay(start); d <= end; d += 1) {
      const dow = new Date(Date.UTC(2026, 2, 2) + d * 86_400_000).getUTCDay();
      if (dow === 0 || dow === 6) continue; // только рабочие дни диапазона (пропускаем выходные)
      cmds.push({ type: "calendar.exception.upsert", payload: { id: nid("ex"), calendarId: model.calendarId, resourceId, date: dayToIso(d), workingMinutes: 0, reason: typeLabel } } as PlanningCommand);
    }
    if (cmds.length === 0) return;
    setBusy(true);
    const res = await applyBatch(cmds);
    setBusy(false);
    setNotice(res.ok ? `${typeLabel} добавлен · коммит v${res.planVersion}` : `Отклонено: ${res.message}`);
  }

  return (
    <DeliveryFrame project={projectMeta} activeTab="Ресурсы">
      <ResourceLoadMatrix
        scope={SCOPE}
        data={model.data}
        callbacks={{ busy, notice, onCreateTask: openCreateTask, onEditTask: openEditTask, onAcceptOverload: acceptOverload, onEditAssignmentHours: editUnits, onAbsence: doAbsence }}
      />
      {taskModal ? <TaskModal open mode={taskModal.mode} initial={taskModal.initial} onOpenChange={(o) => { if (!o) setTaskModal(null); }} onSubmit={submitTaskModal} /> : null}
    </DeliveryFrame>
  );
}
