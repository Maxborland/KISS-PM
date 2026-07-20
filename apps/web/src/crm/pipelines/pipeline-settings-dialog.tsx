"use client";

import { useState } from "react";
import { Archive, ChevronDown, ChevronUp, Pencil, Plus, RotateCcw, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { FormDialog } from "@/components/domain/form-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { makeRuError } from "@/lib/error-messages";
import { StatusChip } from "@/crm/ui/crm-bits";
import type { useCrm } from "@/crm/lib/use-crm";
import type { DealStage, Pipeline, ProjectType, StageTransition } from "@/crm/lib/crm-client";
import { canCreateTransition, nextSortOrder, orderedStages, parseMinProbabilityInput, planStageReorder } from "./pipeline-settings-model";

type Crm = ReturnType<typeof useCrm>;

// RU-подписи кодов конструктора (зеркало доменных/парсерных ошибок сервера).
const ERR: Record<string, string> = {
  invalid_pipeline_name: "Укажите название воронки",
  invalid_deal_stage_name: "Укажите название стадии",
  invalid_project_type_name: "Укажите название типа",
  invalid_sort_order: "Некорректный порядковый номер",
  invalid_min_probability: "Вероятность 0…100",
  invalid_description: "Слишком длинное описание",
  invalid_status: "Некорректный статус",
  pipeline_not_found: "Воронка не найдена",
  deal_stage_not_found: "Стадия не найдена",
  project_type_not_found: "Тип проекта не найден",
  stage_not_in_pipeline: "Стадия принадлежит другой воронке",
  stage_transition_conflict: "Такое правило перехода уже есть",
  invalid_transition_stages: "Стадии перехода должны различаться"
};
const ruErr = makeRuError(ERR);

const inputCls = "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)]";
const labelCls = "flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]";
const sectionTitleCls = "text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]";

/**
 * PipelineSettingsDialog — конструктор CRM-воронки «мышкой»: воронки, стадии
 * (создание/переименование/переупорядочивание/архивация), правила переходов
 * (from→to, minProbability, requireFeasibilityOk, guardNote) и типы проектов.
 * Работает через тот же useCrm-инстанс, что и поверхность «Сделки» (единый кэш).
 */
export function PipelineSettingsDialog({ crm, disabledReason }: { crm: Crm; disabledReason?: string | null }) {
  const [open, setOpen] = useState(false);
  const data = crm.data;
  const pipelines = [...(data?.pipelines ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = pipelines.find((p) => p.id === selectedId) ?? pipelines.find((p) => p.isDefault) ?? pipelines[0] ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={Boolean(disabledReason)} title={disabledReason ?? "Настроить воронки, стадии, переходы и типы проектов"}>
          <Settings2 className="size-3.5" aria-hidden />Настроить
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[760px]">
        <DialogHeader>
          <DialogTitle>Конструктор воронок</DialogTitle>
          <DialogDescription>Воронки, стадии, правила переходов и типы проектов — компания настраивает продажи под себя.</DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto pr-1">
          {/* --- Воронки --- */}
          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={sectionTitleCls}>Воронки</h3>
              <CreatePipelineForm crm={crm} sortOrder={nextSortOrder(pipelines)} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {pipelines.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[length:var(--text-xs)] font-medium transition-colors",
                    selected?.id === p.id
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                      : "border-[var(--border)] bg-[var(--panel)] text-[var(--muted-strong)] hover:border-[var(--accent-muted)]"
                  )}
                >
                  {p.name}
                  {p.isDefault ? <span className="rounded-full bg-[var(--panel-strong)] px-1 text-[length:var(--text-2xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">по умолч.</span> : null}
                  {p.status === "archived" ? <span className="text-[length:var(--text-2xs)] uppercase text-[var(--danger-text)]">архив</span> : null}
                </button>
              ))}
              {pipelines.length === 0 ? <p className="text-[length:var(--text-xs)] text-[var(--muted)]">Воронок пока нет — создайте первую.</p> : null}
            </div>
            {selected ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <EditPipelineForm crm={crm} pipeline={selected} />
                {!selected.isDefault && selected.status === "active" ? (
                  <Button variant="ghost" size="sm" onClick={() => void run(crm.updatePipeline(selected.id, pipelinePatch(selected, { isDefault: true })), "Воронка назначена по умолчанию", ruErr)}>По умолчанию</Button>
                ) : null}
                {selected.status === "active" ? (
                  <ConfirmDialog title={`Архивировать воронку «${selected.name}»?`} description="Воронка станет недоступной для новых сделок и переносов." confirmLabel="В архив" onConfirm={() => run(crm.updatePipeline(selected.id, pipelinePatch(selected, { status: "archived", isDefault: false })), "Воронка в архиве", ruErr)}>
                    <Button variant="ghost" size="sm" title="Архивировать воронку"><Archive className="size-3.5" aria-hidden />В архив</Button>
                  </ConfirmDialog>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => void run(crm.updatePipeline(selected.id, pipelinePatch(selected, { status: "active" })), "Воронка восстановлена", ruErr)} title="Восстановить воронку"><RotateCcw className="size-3.5" aria-hidden />Восстановить</Button>
                )}
              </div>
            ) : null}
          </section>

          {selected ? <StagesSection crm={crm} pipeline={selected} stages={data?.dealStages ?? []} /> : null}
          {selected ? <TransitionsSection crm={crm} pipeline={selected} stages={data?.dealStages ?? []} transitions={data?.stageTransitions ?? []} /> : null}

          {/* --- Типы проектов --- */}
          <ProjectTypesSection crm={crm} projectTypes={data?.projectTypes ?? []} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Полная запись воронки для full-replace PATCH с точечным изменением полей.
function pipelinePatch(p: Pipeline, over: Partial<{ name: string; sortOrder: number; description: string | null; isDefault: boolean; status: "active" | "archived" }>) {
  return { name: p.name, sortOrder: p.sortOrder, description: p.description, isDefault: p.isDefault, status: p.status, ...over };
}

// Запуск мутации useCrm с тостом успеха/ошибки (мутации возвращают {ok, code, message}).
async function run(promise: Promise<{ ok: boolean; code?: string; message?: string }>, successMsg: string, fmt: (code?: string, message?: string) => string): Promise<void> {
  const res = await promise;
  if (res.ok) toast.success(successMsg);
  else toast.error(`Отклонено: ${fmt(res.code, res.message)}`);
}

function CreatePipelineForm({ crm, sortOrder }: { crm: Crm; sortOrder: number }) {
  const [name, setName] = useState("");
  return (
    <FormDialog
      title="Новая воронка"
      trigger={<Button variant="soft" size="xs"><Plus className="size-3.5" aria-hidden />Воронка</Button>}
      submitLabel={<><Plus className="size-3.5" aria-hidden />Создать</>}
      submitDisabled={!name.trim()}
      successToast="Воронка создана"
      contentClassName="max-w-[420px]"
      onSubmit={async () => { const res = await crm.createPipeline({ name: name.trim(), sortOrder }); return res.ok ? null : ruErr(res.code, res.message); }}
      onSuccess={() => setName("")}
    >
      <label className={labelCls}>Название<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Тендеры" /></label>
    </FormDialog>
  );
}

function EditPipelineForm({ crm, pipeline }: { crm: Crm; pipeline: Pipeline }) {
  const [name, setName] = useState(pipeline.name);
  const [description, setDescription] = useState(pipeline.description ?? "");
  return (
    <FormDialog
      title="Переименовать воронку"
      trigger={<Button variant="ghost" size="sm" title="Переименовать воронку"><Pencil className="size-3.5" aria-hidden />Переименовать</Button>}
      onOpenChange={(v) => { if (v) { setName(pipeline.name); setDescription(pipeline.description ?? ""); } }}
      submitLabel={<><Pencil className="size-3.5" aria-hidden />Сохранить</>}
      submitDisabled={!name.trim()}
      successToast="Воронка обновлена"
      contentClassName="max-w-[420px]"
      onSubmit={async () => { const res = await crm.updatePipeline(pipeline.id, pipelinePatch(pipeline, { name: name.trim(), description: description.trim() || null })); return res.ok ? null : ruErr(res.code, res.message); }}
    >
      <div className="flex flex-col gap-3">
        <label className={labelCls}>Название<Input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className={labelCls}>Описание<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="необязательно" /></label>
      </div>
    </FormDialog>
  );
}

function StagesSection({ crm, pipeline, stages }: { crm: Crm; pipeline: Pipeline; stages: DealStage[] }) {
  const ordered = orderedStages(stages, pipeline.id);
  const move = async (stageId: string, direction: "up" | "down") => {
    const plan = crm.data ? planReorder(crm.data.dealStages, stageId, direction) : null;
    if (!plan) return;
    for (const step of plan.updates) {
      const res = await crm.updateDealStage(step.id, step.input);
      if (!res.ok) { toast.error(`Отклонено: ${ruErr(res.code, res.message)}`); return; }
    }
    toast.success("Порядок стадий обновлён");
  };
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className={sectionTitleCls}>Стадии воронки «{pipeline.name}»</h3>
        <CreateStageForm crm={crm} pipeline={pipeline} sortOrder={nextSortOrder(orderedStages(stages, pipeline.id))} />
      </div>
      {ordered.length === 0 ? (
        <p className="text-[length:var(--text-xs)] text-[var(--muted)]">У воронки ещё нет стадий — добавьте первую, чтобы вести по ней сделки.</p>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)]">
          <table className="w-full border-collapse text-[length:var(--text-sm)]">
            <tbody>
              {ordered.map((s, index) => (
                <tr key={s.id} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="w-16 px-2 py-1.5">
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => void move(s.id, "up")} aria-label={`Поднять стадию «${s.name}»`}><ChevronUp className="size-3.5" aria-hidden /></Button>
                      <Button variant="ghost" size="icon-sm" disabled={index === ordered.length - 1} onClick={() => void move(s.id, "down")} aria-label={`Опустить стадию «${s.name}»`}><ChevronDown className="size-3.5" aria-hidden /></Button>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 font-medium text-[var(--text-strong)]">{s.name}</td>
                  <td className="px-2 py-1.5"><StatusChip status={s.status} /></td>
                  <td className="px-2 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <EditStageForm crm={crm} stage={s} />
                      {s.status === "active" ? (
                        <ConfirmDialog title={`Архивировать стадию «${s.name}»?`} description="Сделки на этой стадии останутся, но новые переносы на неё будут запрещены." confirmLabel="В архив" onConfirm={() => run(crm.updateDealStage(s.id, { name: s.name, sortOrder: s.sortOrder, status: "archived" }), "Стадия в архиве", ruErr)}>
                          <Button variant="ghost" size="icon-sm" title="Архивировать стадию"><Archive className="size-3.5" aria-hidden /></Button>
                        </ConfirmDialog>
                      ) : (
                        <Button variant="ghost" size="icon-sm" onClick={() => void run(crm.updateDealStage(s.id, { name: s.name, sortOrder: s.sortOrder, status: "active" }), "Стадия восстановлена", ruErr)} title="Восстановить стадию"><RotateCcw className="size-3.5" aria-hidden /></Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// Обёртка planStageReorder → готовые payload'ы updateDealStage (full-replace: name/sortOrder/status).
function planReorder(stages: DealStage[], stageId: string, direction: "up" | "down"): { updates: Array<{ id: string; input: { name: string; sortOrder: number; status: "active" | "archived" } }> } | null {
  const plan = planStageReorder(stages, stageId, direction);
  if (!plan) return null;
  const updates = plan.map((step) => {
    const stage = stages.find((s) => s.id === step.id)!;
    return { id: step.id, input: { name: stage.name, sortOrder: step.sortOrder, status: stage.status } };
  });
  return { updates };
}

function CreateStageForm({ crm, pipeline, sortOrder }: { crm: Crm; pipeline: Pipeline; sortOrder: number }) {
  const [name, setName] = useState("");
  return (
    <FormDialog
      title={`Новая стадия воронки «${pipeline.name}»`}
      trigger={<Button variant="soft" size="xs"><Plus className="size-3.5" aria-hidden />Стадия</Button>}
      submitLabel={<><Plus className="size-3.5" aria-hidden />Создать</>}
      submitDisabled={!name.trim()}
      successToast="Стадия создана"
      contentClassName="max-w-[420px]"
      onSubmit={async () => { const res = await crm.createDealStage({ name: name.trim(), sortOrder, pipelineId: pipeline.id }); return res.ok ? null : ruErr(res.code, res.message); }}
      onSuccess={() => setName("")}
    >
      <label className={labelCls}>Название<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Переговоры" /></label>
    </FormDialog>
  );
}

function EditStageForm({ crm, stage }: { crm: Crm; stage: DealStage }) {
  const [name, setName] = useState(stage.name);
  return (
    <FormDialog
      title="Переименовать стадию"
      trigger={<Button variant="ghost" size="icon-sm" title="Переименовать стадию"><Pencil className="size-3.5" aria-hidden /></Button>}
      onOpenChange={(v) => { if (v) setName(stage.name); }}
      submitLabel={<><Pencil className="size-3.5" aria-hidden />Сохранить</>}
      submitDisabled={!name.trim()}
      successToast="Стадия обновлена"
      contentClassName="max-w-[420px]"
      onSubmit={async () => { const res = await crm.updateDealStage(stage.id, { name: name.trim(), sortOrder: stage.sortOrder, status: stage.status }); return res.ok ? null : ruErr(res.code, res.message); }}
    >
      <label className={labelCls}>Название<Input value={name} onChange={(e) => setName(e.target.value)} /></label>
    </FormDialog>
  );
}

function TransitionsSection({ crm, pipeline, stages, transitions }: { crm: Crm; pipeline: Pipeline; stages: DealStage[]; transitions: StageTransition[] }) {
  const ordered = orderedStages(stages, pipeline.id);
  const rules = transitions.filter((t) => t.pipelineId === pipeline.id);
  const stageName = (id: string) => stages.find((s) => s.id === id)?.name ?? "—";
  const [fromStageId, setFromStageId] = useState("");
  const [toStageId, setToStageId] = useState("");
  const [minProbability, setMinProbability] = useState("");
  const [requireFeasibilityOk, setRequireFeasibilityOk] = useState(false);
  const [guardNote, setGuardNote] = useState("");
  const [busy, setBusy] = useState(false);
  const minProbabilityValid = parseMinProbabilityInput(minProbability).ok;
  const canAdd = canCreateTransition(transitions, pipeline.id, fromStageId, toStageId) && minProbabilityValid && !busy;

  const add = async () => {
    const mp = parseMinProbabilityInput(minProbability);
    if (!mp.ok) return;
    setBusy(true);
    const res = await crm.createStageTransition(pipeline.id, { fromStageId, toStageId, requireFeasibilityOk, minProbability: mp.value, guardNote: guardNote.trim() || null });
    setBusy(false);
    if (res.ok) { toast.success("Правило перехода добавлено"); setFromStageId(""); setToStageId(""); setMinProbability(""); setRequireFeasibilityOk(false); setGuardNote(""); }
    else toast.error(`Отклонено: ${ruErr(res.code, res.message)}`);
  };

  return (
    <section className="flex flex-col gap-2">
      <h3 className={sectionTitleCls}>Правила переходов воронки «{pipeline.name}»</h3>
      {rules.length === 0 ? (
        <p className="text-[length:var(--text-xs)] text-[var(--muted)]">Правил нет — переходы между стадиями этой воронки не ограничены.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rules.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 text-[length:var(--text-xs)]">
              <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-2 py-0.5 text-[var(--muted-strong)]">
                {stageName(t.fromStageId)} <span className="text-[var(--muted-soft)]">→</span> {stageName(t.toStageId)}
              </span>
              {t.requireFeasibilityOk ? <span className="rounded-full border border-[var(--warning)] bg-[var(--warning-soft)] px-1.5 py-0.5 text-[var(--warning-text)]">осуществимость: ок</span> : null}
              {t.minProbability !== null ? <span className="rounded-full border border-[var(--warning)] bg-[var(--warning-soft)] px-1.5 py-0.5 text-[var(--warning-text)]">вероятность ≥ {t.minProbability}%</span> : null}
              {t.guardNote ? <span className="truncate text-[var(--muted-soft)]">· {t.guardNote}</span> : null}
              <ConfirmDialog title="Удалить правило перехода?" description="Переход между этими стадиями снова станет свободным." confirmLabel="Удалить" onConfirm={() => run(crm.deleteStageTransition(pipeline.id, t.id), "Правило удалено", ruErr)}>
                <Button variant="ghost" size="icon-sm" title="Удалить правило" className="ml-auto"><Trash2 className="size-3.5" aria-hidden /></Button>
              </ConfirmDialog>
            </li>
          ))}
        </ul>
      )}
      {ordered.length >= 2 ? (
        <div className="mt-1 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--panel-subtle)] p-2.5">
          <div className="grid grid-cols-2 gap-2">
            <label className={labelCls}>Из стадии
              <select value={fromStageId} onChange={(e) => setFromStageId(e.target.value)} className={inputCls}>
                <option value="" disabled>Выберите…</option>
                {ordered.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className={labelCls}>В стадию
              <select value={toStageId} onChange={(e) => setToStageId(e.target.value)} className={inputCls}>
                <option value="" disabled>Выберите…</option>
                {ordered.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label className={labelCls}>Мин. вероятность, %
              <Input type="number" min={0} max={100} value={minProbability} onChange={(e) => setMinProbability(e.target.value)} placeholder="необязательно" aria-invalid={!minProbabilityValid} />
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]">
              <input type="checkbox" checked={requireFeasibilityOk} onChange={(e) => setRequireFeasibilityOk(e.target.checked)} className="size-4 accent-[var(--accent)]" />
              Требовать осуществимость = ок
            </label>
          </div>
          <label className={cn(labelCls, "mt-2")}>Примечание к правилу
            <Input value={guardNote} onChange={(e) => setGuardNote(e.target.value)} placeholder="необязательно" />
          </label>
          <div className="mt-2 flex justify-end">
            <Button variant="soft" size="sm" disabled={!canAdd} onClick={() => void add()}><Plus className="size-3.5" aria-hidden />Добавить правило</Button>
          </div>
        </div>
      ) : (
        <p className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">Чтобы задать правило перехода, в воронке должно быть не меньше двух стадий.</p>
      )}
    </section>
  );
}

function ProjectTypesSection({ crm, projectTypes }: { crm: Crm; projectTypes: ProjectType[] }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className={sectionTitleCls}>Типы проектов</h3>
        <CreateProjectTypeForm crm={crm} />
      </div>
      {projectTypes.length === 0 ? (
        <p className="text-[length:var(--text-xs)] text-[var(--muted)]">Типов проектов пока нет — добавьте хотя бы один, чтобы создавать сделки.</p>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)]">
          <table className="w-full border-collapse text-[length:var(--text-sm)]">
            <tbody>
              {projectTypes.map((pt) => (
                <tr key={pt.id} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="px-2 py-1.5 font-medium text-[var(--text-strong)]">{pt.name}</td>
                  <td className="max-w-[280px] truncate px-2 py-1.5 text-[var(--muted)]">{pt.description ?? "—"}</td>
                  <td className="px-2 py-1.5"><StatusChip status={pt.status} /></td>
                  <td className="px-2 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <EditProjectTypeForm crm={crm} projectType={pt} />
                      {pt.status === "active" ? (
                        <ConfirmDialog title={`Архивировать тип «${pt.name}»?`} description="Тип нельзя будет выбрать в новых сделках." confirmLabel="В архив" onConfirm={() => run(crm.updateProjectType(pt.id, { name: pt.name, description: pt.description, status: "archived" }), "Тип в архиве", ruErr)}>
                          <Button variant="ghost" size="icon-sm" title="Архивировать тип"><Archive className="size-3.5" aria-hidden /></Button>
                        </ConfirmDialog>
                      ) : (
                        <Button variant="ghost" size="icon-sm" onClick={() => void run(crm.updateProjectType(pt.id, { name: pt.name, description: pt.description, status: "active" }), "Тип восстановлен", ruErr)} title="Восстановить тип"><RotateCcw className="size-3.5" aria-hidden /></Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CreateProjectTypeForm({ crm }: { crm: Crm }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <FormDialog
      title="Новый тип проекта"
      trigger={<Button variant="soft" size="xs"><Plus className="size-3.5" aria-hidden />Тип</Button>}
      submitLabel={<><Plus className="size-3.5" aria-hidden />Создать</>}
      submitDisabled={!name.trim()}
      successToast="Тип проекта создан"
      contentClassName="max-w-[420px]"
      onSubmit={async () => { const res = await crm.createProjectType({ name: name.trim(), description: description.trim() || null }); return res.ok ? null : ruErr(res.code, res.message); }}
      onSuccess={() => { setName(""); setDescription(""); }}
    >
      <div className="flex flex-col gap-3">
        <label className={labelCls}>Название<Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Внедрение" /></label>
        <label className={labelCls}>Описание<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="необязательно" /></label>
      </div>
    </FormDialog>
  );
}

function EditProjectTypeForm({ crm, projectType }: { crm: Crm; projectType: ProjectType }) {
  const [name, setName] = useState(projectType.name);
  const [description, setDescription] = useState(projectType.description ?? "");
  return (
    <FormDialog
      title="Переименовать тип проекта"
      trigger={<Button variant="ghost" size="icon-sm" title="Переименовать тип"><Pencil className="size-3.5" aria-hidden /></Button>}
      onOpenChange={(v) => { if (v) { setName(projectType.name); setDescription(projectType.description ?? ""); } }}
      submitLabel={<><Pencil className="size-3.5" aria-hidden />Сохранить</>}
      submitDisabled={!name.trim()}
      successToast="Тип проекта обновлён"
      contentClassName="max-w-[420px]"
      onSubmit={async () => { const res = await crm.updateProjectType(projectType.id, { name: name.trim(), description: description.trim() || null, status: projectType.status }); return res.ok ? null : ruErr(res.code, res.message); }}
    >
      <div className="flex flex-col gap-3">
        <label className={labelCls}>Название<Input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className={labelCls}>Описание<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="необязательно" /></label>
      </div>
    </FormDialog>
  );
}
