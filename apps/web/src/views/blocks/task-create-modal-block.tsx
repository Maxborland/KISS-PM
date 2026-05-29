"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CardPanel } from "@/components/domain/card-panel";
import { Field, FormGrid, FormSection } from "@/components/domain/form-layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";
import {
  buildCreateTaskPreview,
  type CreateTaskFormState,
  type CreateTaskRequestPreview,
  EMPTY_CREATE_TASK_FORM,
  issuesToFieldMap,
  MOCK_PROJECT_OPTIONS,
  MOCK_TASK_STATUSES,
  MOCK_WORKSPACE_USERS,
  TASK_PARTICIPANT_ROLE_LABEL,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  type TaskFieldKey,
  type TaskParticipantInput,
  type TaskParticipantRole,
  TaskPayloadPreview,
  validateCreateTaskInput
} from "@/views/domain/task-api";
import { PageIntro } from "@/views/layout/page-intro";

const STEPS = [
  { num: 1, label: "Контекст" },
  { num: 2, label: "План" },
  { num: 3, label: "Участники" }
] as const;

const ROLE_OPTIONS: { value: TaskParticipantRole; label: string }[] = [
  { value: "executor", label: TASK_PARTICIPANT_ROLE_LABEL.executor },
  { value: "co_executor", label: TASK_PARTICIPANT_ROLE_LABEL.co_executor },
  { value: "controller", label: TASK_PARTICIPANT_ROLE_LABEL.controller },
  { value: "approver", label: TASK_PARTICIPANT_ROLE_LABEL.approver },
  { value: "observer", label: TASK_PARTICIPANT_ROLE_LABEL.observer }
];

const USER_OPTIONS = MOCK_WORKSPACE_USERS.map((u) => ({ value: u.id, label: u.fullName }));
const PROJECT_OPTIONS = MOCK_PROJECT_OPTIONS.map((p) => ({ value: p.id, label: p.label }));

export type TaskCreateModalBlockProps = {
  initialStep?: 1 | 2 | 3;
  /** Storybook: пред-выбранный проект (id из MOCK_PROJECT_OPTIONS). */
  initialProjectId?: string;
  /** Storybook/demo seed for realistic non-empty forms. */
  initialForm?: Partial<CreateTaskFormState>;
  /** Storybook API Contract: после «Создать» показать JSON превью запроса. */
  showApiContractPreview?: boolean;
};

export function TaskCreateModalBlock({
  initialStep = 1,
  initialProjectId = "inbox",
  initialForm,
  showApiContractPreview = false
}: TaskCreateModalBlockProps = {}) {
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const [projectScopeId, setProjectScopeId] = useState(initialProjectId);
  const [form, setForm] = useState<CreateTaskFormState>(() => ({
    ...EMPTY_CREATE_TASK_FORM,
    ...initialForm,
    participants: initialForm?.participants ?? [{ userId: "", role: "executor" }]
  }));
  const [issues, setIssues] = useState<ReturnType<typeof issuesToFieldMap>>({});
  const [preview, setPreview] = useState<CreateTaskRequestPreview | null>(null);

  const update = <K extends keyof CreateTaskFormState>(key: K, value: CreateTaskFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    const fieldKey = fieldOfKey(key);
    if (fieldKey && issues[fieldKey]) {
      setIssues((prev) => ({ ...prev, [fieldKey]: undefined }));
    }
  };

  const goToStep = (target: 1 | 2 | 3) => {
    if (target > step) {
      const blockingIssues = validateForStep(step, form);
      if (blockingIssues.length > 0) {
        setIssues(issuesToFieldMap(blockingIssues));
        return;
      }
    }
    setIssues({});
    setStep(target);
  };

  const handleNext = () => {
    if (step === 3) {
      const allIssues = validateCreateTaskInput(toValidationInput(form));
      if (allIssues.length > 0) {
        setIssues(issuesToFieldMap(allIssues));
        toast.error("Проверьте обязательные поля");
        return;
      }
      if (showApiContractPreview) {
        const scope = MOCK_PROJECT_OPTIONS.find((p) => p.id === projectScopeId);
        const built = buildCreateTaskPreview(
          form,
          scope?.scopeProjectId ? { projectId: scope.scopeProjectId } : {}
        );
        setPreview(built);
        toast.success("Запрос подготовлен (демо)");
      } else {
        toast.success("Задача создана");
        reset();
      }
      return;
    }
    const blockingIssues = validateForStep(step, form);
    if (blockingIssues.length > 0) {
      setIssues(issuesToFieldMap(blockingIssues));
      return;
    }
    setIssues({});
    setStep((step + 1) as 1 | 2 | 3);
  };

  const reset = () => {
    setForm({
      ...EMPTY_CREATE_TASK_FORM,
      ...initialForm,
      participants: initialForm?.participants ?? [{ userId: "", role: "executor" }]
    });
    setProjectScopeId(initialProjectId);
    setStep(1);
    setIssues({});
    setPreview(null);
  };

  const addParticipant = () => {
    update("participants", [...form.participants, { userId: "", role: "observer" }]);
  };

  const removeParticipant = (index: number) => {
    update(
      "participants",
      form.participants.filter((_, i) => i !== index)
    );
  };

  const setParticipantUser = (index: number, userId: string) => {
    update(
      "participants",
      form.participants.map((p, i) => (i === index ? { ...p, userId } : p))
    );
  };

  const setParticipantRole = (index: number, role: TaskParticipantRole) => {
    update(
      "participants",
      form.participants.map((p, i) => (i === index ? { ...p, role } : p))
    );
  };

  if (preview) {
    return (
      <>
        <PageIntro
          title="Новая задача"
          lead="Запрос подготовлен — демо без реального вызова API."
        />
        <TaskPayloadPreview
          title="Payload запроса"
          endpointLabel={preview.endpointLabel}
          method={preview.method}
          url={preview.url}
          body={preview.body}
        />
        <div className="modal-mock__footer u-mt-3">
          <Button variant="ghost" onClick={reset}>
            Создать ещё
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <PageIntro
        title="Новая задача"
        lead="Пошаговое создание: контекст, план работ и участники."
      />
      <CardPanel className="modal-mock">
        <ol className="stepper">
          {STEPS.map((s) => (
            <li key={s.num}>
              <button
                type="button"
                className={cn(
                  "stepper__item",
                  step === s.num && "is-active",
                  step > s.num && "is-done"
                )}
                disabled={s.num > step}
                onClick={() => s.num < step && goToStep(s.num)}
                aria-current={step === s.num ? "step" : undefined}
              >
                <span className="stepper__num">{s.num}</span>
                <span>{s.label}</span>
              </button>
            </li>
          ))}
        </ol>

        {step === 1 ? (
          <FormSection title="Контекст" lead="Куда создать задачу и в каком статусе.">
            <FormGrid columns={1}>
              <Field label="Проект" htmlFor="t-project" required>
                <Combobox
                  options={PROJECT_OPTIONS}
                  value={projectScopeId}
                  onValueChange={setProjectScopeId}
                  placeholder="Выбрать проект или Inbox"
                />
              </Field>
              <Field label="Статус" htmlFor="t-status">
                <Select
                  value={form.statusId}
                  onValueChange={(value) => update("statusId", value)}
                >
                  <SelectTrigger id="t-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_TASK_STATUSES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FormGrid>
          </FormSection>
        ) : null}

        {step === 2 ? (
          <FormSection title="План" lead="Сроки, объём работ и приоритет.">
            <FormGrid>
              <Field
                label="Название"
                full
                required
                htmlFor="t-title"
                {...(issues.title ? { error: issues.title } : {})}
              >
                <Input
                  id="t-title"
                  placeholder="Согласовать ТЗ с клиентом"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                />
              </Field>
              <Field label="Описание" full htmlFor="t-desc">
                <Textarea
                  id="t-desc"
                  rows={3}
                  placeholder="Контекст задачи"
                  value={form.description}
                  onChange={(e) => update("description", e.target.value)}
                />
              </Field>
              <Field
                label="Начало"
                htmlFor="t-start"
                required
                {...(issues.plannedStart ? { error: issues.plannedStart } : {})}
              >
                <DatePicker
                  value={form.plannedStart}
                  onChange={(d) => update("plannedStart", d)}
                  placeholder="ДД.ММ.ГГГГ"
                />
              </Field>
              <Field
                label="Окончание"
                htmlFor="t-finish"
                required
                {...(issues.plannedFinish ? { error: issues.plannedFinish } : {})}
              >
                <DatePicker
                  value={form.plannedFinish}
                  onChange={(d) => update("plannedFinish", d)}
                  placeholder="ДД.ММ.ГГГГ"
                />
              </Field>
              <Field
                label="Длительность, раб. дн"
                htmlFor="t-dur"
                required
                {...(issues.durationWorkingDays ? { error: issues.durationWorkingDays } : {})}
              >
                <Input
                  id="t-dur"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1000}
                  value={String(form.durationWorkingDays)}
                  onChange={(e) => update("durationWorkingDays", toIntOr(e.target.value, 1))}
                />
              </Field>
              <Field
                label="Трудозатраты, ч"
                htmlFor="t-work"
                required
                {...(issues.plannedWork ? { error: issues.plannedWork } : {})}
              >
                <Input
                  id="t-work"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={10000}
                  value={String(form.plannedWork)}
                  onChange={(e) => update("plannedWork", toIntOr(e.target.value, 1))}
                />
              </Field>
              <Field label="Приоритет" full>
                <RadioGroup
                  value={form.priority}
                  onValueChange={(value) =>
                    update("priority", value as CreateTaskFormState["priority"])
                  }
                  name="t-prio"
                  className="grid grid-cols-4 gap-[var(--space-2)]"
                >
                  {TASK_PRIORITIES.map((p) => (
                    <RadioGroupItem key={p} id={`p-${p}`} value={p}>
                      {TASK_PRIORITY_LABEL[p]}
                    </RadioGroupItem>
                  ))}
                </RadioGroup>
              </Field>
            </FormGrid>
          </FormSection>
        ) : null}

        {step === 3 ? (
          <FormSection
            title="Участники"
            lead="Минимум один исполнитель. Постановщика API подставит автоматически."
          >
            <FormGrid columns={1}>
              <Field
                label="Состав команды"
                full
                {...(issues.participants ? { error: issues.participants } : {})}
              >
                <ParticipantsEditor
                  participants={form.participants}
                  onUserChange={setParticipantUser}
                  onRoleChange={setParticipantRole}
                  onRemove={removeParticipant}
                  onAdd={addParticipant}
                />
              </Field>
              <Field label="Требуется приёмка результата" full>
                <label className="u-flex u-items-center u-gap-2">
                  <Checkbox
                    checked={form.requiresAcceptance}
                    onCheckedChange={(value) =>
                      update("requiresAcceptance", value === true)
                    }
                  />
                  <span className="u-text-body">Требуется приёмка результата руководителем</span>
                </label>
              </Field>
            </FormGrid>
          </FormSection>
        ) : null}

        <div className="modal-mock__footer">
          <Button variant="ghost" onClick={reset}>
            Отмена
          </Button>
          <div className="ml-auto flex gap-[var(--space-2)]">
            {step > 1 ? (
              <Button variant="secondary" onClick={() => goToStep((step - 1) as 1 | 2 | 3)}>
                Назад
              </Button>
            ) : null}
            <Button variant="primary" onClick={handleNext}>
              {step === 3 ? "Создать" : "Далее"}
            </Button>
          </div>
        </div>
      </CardPanel>
    </>
  );
}

function ParticipantsEditor({
  participants,
  onUserChange,
  onRoleChange,
  onRemove,
  onAdd
}: {
  participants: TaskParticipantInput[];
  onUserChange: (index: number, userId: string) => void;
  onRoleChange: (index: number, role: TaskParticipantRole) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className="participant-editor">
      {participants.map((p, i) => (
        <div key={i} className="participant-editor__row">
          <div className="participant-editor__employee">
            <Combobox
              options={USER_OPTIONS}
              value={p.userId}
              onValueChange={(value) => onUserChange(i, value)}
              placeholder="Выбрать сотрудника"
            />
          </div>
          <div className="participant-editor__role">
            <Select
              value={p.role}
              onValueChange={(value) => onRoleChange(i, value as TaskParticipantRole)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="participant-editor__remove"
            aria-label="Удалить участника"
            onClick={() => onRemove(i)}
            disabled={participants.length === 1}
            title={participants.length === 1 ? "Нужен хотя бы один исполнитель" : undefined}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      ))}
      <Button
        variant="soft"
        size="sm"
        className="participant-editor__add"
        onClick={onAdd}
        disabled={participants.length >= 20}
      >
        <Plus className="size-4" aria-hidden />
        Добавить участника
      </Button>
    </div>
  );
}

const FIELD_KEYS: Set<string> = new Set([
  "title",
  "plannedStart",
  "plannedFinish",
  "durationWorkingDays",
  "plannedWork",
  "priority",
  "statusId",
  "participants"
]);

function fieldOfKey(key: keyof CreateTaskFormState): TaskFieldKey | null {
  return FIELD_KEYS.has(key) ? (key as TaskFieldKey) : null;
}

function toIntOr(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

const STEP_FIELDS: Record<1 | 2 | 3, Set<TaskFieldKey>> = {
  1: new Set<TaskFieldKey>(["statusId"]),
  2: new Set<TaskFieldKey>([
    "title",
    "plannedStart",
    "plannedFinish",
    "durationWorkingDays",
    "plannedWork",
    "priority"
  ]),
  3: new Set<TaskFieldKey>(["participants"])
};

function validateForStep(step: 1 | 2 | 3, form: CreateTaskFormState) {
  const all = validateCreateTaskInput(toValidationInput(form));
  const stepFields = STEP_FIELDS[step];
  return all.filter((i) => stepFields.has(i.field));
}

function toValidationInput(form: CreateTaskFormState) {
  return {
    title: form.title,
    description: form.description.trim() ? form.description.trim() : null,
    priority: form.priority,
    plannedStart: form.plannedStart
      ? `${form.plannedStart.getUTCFullYear()}-${pad(form.plannedStart.getUTCMonth() + 1)}-${pad(form.plannedStart.getUTCDate())}`
      : "",
    plannedFinish: form.plannedFinish
      ? `${form.plannedFinish.getUTCFullYear()}-${pad(form.plannedFinish.getUTCMonth() + 1)}-${pad(form.plannedFinish.getUTCDate())}`
      : "",
    durationWorkingDays: form.durationWorkingDays,
    plannedWork: form.plannedWork,
    requiresAcceptance: form.requiresAcceptance,
    participants: form.participants
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
