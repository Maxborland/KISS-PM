"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { Briefcase, Calendar, MoreHorizontal, Paperclip, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { BemAvatar, BemAvatarStack } from "@/components/domain/bem-avatar";
import { CardPanel } from "@/components/domain/card-panel";
import { Field, FormGrid, FormSection } from "@/components/domain/form-layout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
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
import {
  buildUpdateTaskPreview,
  formatPlanDate,
  issuesToFieldMap,
  MOCK_TASK_DETAIL,
  MOCK_TASK_STATUSES,
  MOCK_WORKSPACE_USERS,
  TASK_PARTICIPANT_ROLE_LABEL,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  taskDetailToFormState,
  type MockTaskDetail,
  type TaskParticipantInput,
  type TaskParticipantRole,
  TaskPayloadPreview,
  type UpdateTaskFormState,
  type UpdateTaskRequestPreview,
  validateUpdateTaskInput
} from "@/views/domain/task-api";
import { MOCK_PROJECT_CRM } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";

export type EntityDetailVariant = "deal" | "task";

export type EntityDetailBlockProps = {
  title: string;
  subtitle: string;
  stage?: { label: string; tone?: "info" | "violet" | "success" | "warning" };
  feed?: ReactNode;
  asideExtra?: ReactNode;
  primary?: ReactNode;
  initialStage?: string;
  initialAmount?: string;
  /** Задаёт набор полей в боковой панели + контракт сохранения. */
  variant?: EntityDetailVariant;
  /** Сид задачи для variant="task". По умолчанию MOCK_TASK_DETAIL. */
  taskDetail?: MockTaskDetail;
  /** Storybook API Contract: показать JSON превью запроса после сохранения. */
  showApiContractPreview?: boolean;
};

type FeedItem = {
  who: { initials: string; color: "c1" | "c2" | "c4"; name: string };
  when: string;
  text: string;
};

const DEFAULT_FEED: FeedItem[] = [
  {
    who: { initials: "ИИ", color: "c1", name: "Иванова М." },
    when: "23 мая 14:32",
    text: "Подготовила черновик КП. Проверь раздел «Цена»."
  },
  {
    who: { initials: "АП", color: "c2", name: "Петров А." },
    when: "23 мая 12:05",
    text: "Сделал расчёт сметы. Расхождение −4% от базового плана."
  },
  {
    who: { initials: "КБ", color: "c4", name: "Козлова Е." },
    when: "22 мая 17:48",
    text: "Готова к ревью завтра в 11:00."
  }
];

const LINKED_PROJECTS = [
  { id: "PRJ-2026-014", label: `${MOCK_PROJECT_CRM} (PRJ-2026-014)` },
  { id: "PRJ-2026-009", label: "DataHub KPI (PRJ-2026-009)" }
];

const USER_OPTIONS = MOCK_WORKSPACE_USERS.map((u) => ({ value: u.id, label: u.fullName }));

export function EntityDetailBlock({
  title,
  subtitle,
  stage,
  feed,
  primary,
  asideExtra,
  initialStage = "qual",
  initialAmount = "890 000",
  variant = "deal",
  taskDetail = MOCK_TASK_DETAIL,
  showApiContractPreview = false
}: EntityDetailBlockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Deal state ---
  const [stageValue, setStageValue] = useState(initialStage);
  const [amount, setAmount] = useState(initialAmount);
  const [savedStage, setSavedStage] = useState(initialStage);
  const [savedAmount, setSavedAmount] = useState(initialAmount);

  // --- Task state ---
  const initialTaskForm = useMemo(() => taskDetailToFormState(taskDetail), [taskDetail]);
  const [taskForm, setTaskForm] = useState<UpdateTaskFormState>(initialTaskForm);
  const [taskIssues, setTaskIssues] = useState<ReturnType<typeof issuesToFieldMap>>({});
  const [taskPreview, setTaskPreview] = useState<UpdateTaskRequestPreview | null>(null);

  // --- Feed (общая часть) ---
  const [commentDraft, setCommentDraft] = useState("");
  const [feedItems, setFeedItems] = useState<FeedItem[]>(DEFAULT_FEED);

  const dealDirty = stageValue !== savedStage || amount !== savedAmount;
  const taskDirty = useMemo(
    () => !taskFormEquals(taskForm, initialTaskForm),
    [taskForm, initialTaskForm]
  );
  const dirty = variant === "task" ? taskDirty : dealDirty;

  const handleSave = () => {
    if (variant === "task") {
      const allIssues = validateUpdateTaskInput({
        title: taskForm.title,
        description: taskForm.description.trim() ? taskForm.description.trim() : null,
        priority: taskForm.priority,
        statusId: taskForm.statusId,
        plannedStart: formatPlanDate(taskForm.plannedStart),
        plannedFinish: formatPlanDate(taskForm.plannedFinish),
        durationWorkingDays: taskForm.durationWorkingDays,
        plannedWork: taskForm.plannedWork,
        requiresAcceptance: taskForm.requiresAcceptance,
        participants: taskForm.participants,
        clientUpdatedAt: taskForm.clientUpdatedAt
      });
      if (allIssues.length > 0) {
        setTaskIssues(issuesToFieldMap(allIssues));
        toast.error("Проверьте обязательные поля");
        return;
      }
      if (showApiContractPreview) {
        const built = buildUpdateTaskPreview(taskForm, { taskId: taskDetail.id });
        setTaskPreview(built);
        toast.success("Запрос подготовлен (демо)");
      } else {
        toast.success("Изменения сохранены");
      }
      return;
    }
    setSavedStage(stageValue);
    setSavedAmount(amount);
    toast.success("Изменения сохранены (демо)");
  };

  const updateTask = <K extends keyof UpdateTaskFormState>(
    key: K,
    value: UpdateTaskFormState[K]
  ) => {
    setTaskForm((prev) => ({ ...prev, [key]: value }));
    setTaskIssues((prev) => ({ ...prev, [key as string]: undefined }));
  };

  const handleSendComment = () => {
    const text = commentDraft.trim();
    if (!text) return;
    setFeedItems((prev) => [
      { who: { initials: "ВЫ", color: "c1", name: "Вы" }, when: "только что", text },
      ...prev
    ]);
    setCommentDraft("");
    toast.success("Комментарий добавлен");
  };

  const feedContent =
    feed ??
    feedItems.map((f, i) => (
      <li key={`${f.when}-${i}`} className="feed__item">
        <BemAvatar initials={f.who.initials} color={f.who.color} size="sm" />
        <div>
          <div className="feed__head">
            <strong className="u-text-body u-text-strong">{f.who.name}</strong>
            <span className="u-text-xs u-text-muted">{f.when}</span>
          </div>
          <p className="u-text-body">{f.text}</p>
        </div>
      </li>
    ));

  const saveLabel = useMemo(() => (dirty ? "Сохранить · есть изменения" : "Сохранить"), [dirty]);

  return (
    <>
      <PageIntro
        title={title}
        lead={subtitle}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label="Действия" variant="ghost">
                  <MoreHorizontal />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => toast.info("Встреча запланирована (демо)")}>
                  <Calendar className="size-4" aria-hidden />
                  Запланировать
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="primary"
              disabled={!dirty}
              onClick={handleSave}
              title={dirty ? undefined : "Нет изменений"}
            >
              {saveLabel}
            </Button>
          </>
        }
      />
      {stage ? (
        <div className="entity-stage-bar">
          <Chip variant={stage.tone ?? "info"}>{stage.label}</Chip>
          <BemAvatarStack more="+2">
            <BemAvatar initials="ИИ" color="c1" />
            <BemAvatar initials="АП" color="c2" />
            <BemAvatar initials="КБ" color="c4" />
          </BemAvatarStack>
        </div>
      ) : null}
      <div className="entity-grid">
        <div className="entity-grid__main">
          {primary ?? (
            <CardPanel title="Описание" subtitle="Контекст для команды">
              <p className="u-text-body">
                {variant === "task"
                  ? "Согласование технического задания с заказчиком: сроки, трудозатраты и участники фиксируются в карточке задачи."
                  : "Внедрение CRM в три этапа: аудит процессов, миграция данных, обучение команды. Срок — 6 недель. Заказчик — ООО «Ромашка», ответственный — Иванова М."}
              </p>
            </CardPanel>
          )}
          {variant === "task" && showApiContractPreview && taskPreview ? (
            <TaskPayloadPreview
              title="Payload запроса"
              endpointLabel={taskPreview.endpointLabel}
              method={taskPreview.method}
              url={taskPreview.url}
              body={taskPreview.body}
            />
          ) : null}
          <CardPanel title="Лента" subtitle="Активность по сущности" flush className="u-mt-3">
            <ul className="feed">{feedContent}</ul>
            {!feed ? (
              <div className="feed__compose">
                <Textarea
                  rows={2}
                  placeholder="Написать комментарий…"
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                />
                <div className="feed__compose-actions">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    onChange={() => toast.info("Файл выбран (демо, без загрузки)")}
                  />
                  <IconButton
                    label="Прикрепить"
                    variant="ghost"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip />
                  </IconButton>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!commentDraft.trim()}
                    onClick={handleSendComment}
                  >
                    <Send className="size-4" aria-hidden />
                    Отправить
                  </Button>
                </div>
              </div>
            ) : null}
          </CardPanel>
        </div>
        <aside className="entity-grid__aside">
          {variant === "task" ? (
            <TaskAside form={taskForm} issues={taskIssues} onChange={updateTask} />
          ) : (
            <CardPanel title="Параметры" subtitle="Свойства сущности">
              <FormSection title="Основное" lead="Доступно владельцу и админу.">
                <FormGrid columns={1}>
                  <Field label="Стадия">
                    <Select value={stageValue} onValueChange={setStageValue}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lead">Лид</SelectItem>
                        <SelectItem value="qual">Квалификация</SelectItem>
                        <SelectItem value="proposal">КП</SelectItem>
                        <SelectItem value="deal">Договор</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Срок">
                    <DatePicker placeholder="Выбрать дату" />
                  </Field>
                  <Field label="Сумма" htmlFor="entity-amount">
                    <Input
                      id="entity-amount"
                      className="mono"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      inputMode="numeric"
                    />
                  </Field>
                </FormGrid>
              </FormSection>
            </CardPanel>
          )}
          {asideExtra ?? (
            <CardPanel title="Связи" subtitle="Проекты и продукты" className="u-mt-3">
              <ul className="link-list">
                {LINKED_PROJECTS.map((p) => (
                  <li key={p.id}>
                    <Button
                      variant="link"
                      className="h-auto p-0 justify-start gap-2 font-normal"
                      onClick={() => toast.info(`Открыть проект ${p.id} (демо)`)}
                    >
                      <Briefcase className="size-4 shrink-0" aria-hidden />
                      {p.label}
                    </Button>
                  </li>
                ))}
              </ul>
            </CardPanel>
          )}
        </aside>
      </div>
    </>
  );
}

const ROLE_OPTIONS: { value: TaskParticipantRole; label: string }[] = [
  { value: "executor", label: TASK_PARTICIPANT_ROLE_LABEL.executor },
  { value: "co_executor", label: TASK_PARTICIPANT_ROLE_LABEL.co_executor },
  { value: "controller", label: TASK_PARTICIPANT_ROLE_LABEL.controller },
  { value: "approver", label: TASK_PARTICIPANT_ROLE_LABEL.approver },
  { value: "observer", label: TASK_PARTICIPANT_ROLE_LABEL.observer }
];

function TaskAside({
  form,
  issues,
  onChange
}: {
  form: UpdateTaskFormState;
  issues: ReturnType<typeof issuesToFieldMap>;
  onChange: <K extends keyof UpdateTaskFormState>(key: K, value: UpdateTaskFormState[K]) => void;
}) {
  return (
    <CardPanel title="Параметры задачи" subtitle="Сроки, участники и статус">
      <FormSection title="Основное" lead="Изменения сохраняются в карточке задачи и попадают в аудит.">
        <FormGrid columns={1}>
          <Field
            label="Название"
            htmlFor="task-title"
            required
            {...(issues.title ? { error: issues.title } : {})}
          >
            <Input
              id="task-title"
              value={form.title}
              onChange={(e) => onChange("title", e.target.value)}
            />
          </Field>
          <Field label="Описание" htmlFor="task-desc">
            <Textarea
              id="task-desc"
              rows={3}
              value={form.description}
              onChange={(e) => onChange("description", e.target.value)}
            />
          </Field>
          <Field label="Статус" htmlFor="task-status">
            <Select value={form.statusId} onValueChange={(value) => onChange("statusId", value)}>
              <SelectTrigger id="task-status" className="w-full">
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
          <Field
            label="Начало"
            required
            {...(issues.plannedStart ? { error: issues.plannedStart } : {})}
          >
            <DatePicker
              value={form.plannedStart}
              onChange={(d) => onChange("plannedStart", d)}
              placeholder="ДД.ММ.ГГГГ"
            />
          </Field>
          <Field
            label="Окончание"
            required
            {...(issues.plannedFinish ? { error: issues.plannedFinish } : {})}
          >
            <DatePicker
              value={form.plannedFinish}
              onChange={(d) => onChange("plannedFinish", d)}
              placeholder="ДД.ММ.ГГГГ"
            />
          </Field>
          <Field
            label="Длительность, раб. дн"
            htmlFor="task-dur"
            {...(issues.durationWorkingDays ? { error: issues.durationWorkingDays } : {})}
          >
            <Input
              id="task-dur"
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              value={String(form.durationWorkingDays)}
              onChange={(e) =>
                onChange("durationWorkingDays", toIntOr(e.target.value, form.durationWorkingDays))
              }
            />
          </Field>
          <Field
            label="Трудозатраты, ч"
            htmlFor="task-work"
            {...(issues.plannedWork ? { error: issues.plannedWork } : {})}
          >
            <Input
              id="task-work"
              type="number"
              inputMode="numeric"
              min={1}
              max={10000}
              value={String(form.plannedWork)}
              onChange={(e) =>
                onChange("plannedWork", toIntOr(e.target.value, form.plannedWork))
              }
            />
          </Field>
          <Field label="Приоритет">
            <RadioGroup
              value={form.priority}
              onValueChange={(value) =>
                onChange("priority", value as UpdateTaskFormState["priority"])
              }
              name="task-prio"
              className="grid grid-cols-2 gap-[var(--space-2)]"
            >
              {TASK_PRIORITIES.map((p) => (
                <RadioGroupItem key={p} id={`task-p-${p}`} value={p}>
                  {TASK_PRIORITY_LABEL[p]}
                </RadioGroupItem>
              ))}
            </RadioGroup>
          </Field>
          <Field label="Приёмка результата">
            <label className="u-flex u-items-center u-gap-2">
              <Checkbox
                checked={form.requiresAcceptance}
                onCheckedChange={(value) => onChange("requiresAcceptance", value === true)}
              />
              <span className="u-text-body">requiresAcceptance: true</span>
            </label>
          </Field>
          <Field
            label="Участники"
            {...(issues.participants ? { error: issues.participants } : {})}
          >
            <ParticipantsEditor
              participants={form.participants}
              onChange={(next) => onChange("participants", next)}
            />
          </Field>
        </FormGrid>
      </FormSection>
    </CardPanel>
  );
}

function ParticipantsEditor({
  participants,
  onChange
}: {
  participants: TaskParticipantInput[];
  onChange: (next: TaskParticipantInput[]) => void;
}) {
  const setUser = (index: number, userId: string) => {
    onChange(participants.map((p, i) => (i === index ? { ...p, userId } : p)));
  };
  const setRole = (index: number, role: TaskParticipantRole) => {
    onChange(participants.map((p, i) => (i === index ? { ...p, role } : p)));
  };
  const remove = (index: number) => {
    onChange(participants.filter((_, i) => i !== index));
  };
  const add = () => {
    onChange([...participants, { userId: "", role: "observer" }]);
  };

  return (
    <div className="u-flex u-flex-col u-gap-2">
      {participants.map((p, i) => (
        <div key={i} className="u-grid u-grid-cols-[minmax(0,1fr)_140px_auto] u-gap-2">
          <Combobox
            options={USER_OPTIONS}
            value={p.userId}
            onValueChange={(value) => setUser(i, value)}
            placeholder="Сотрудник"
          />
          <Select value={p.role} onValueChange={(value) => setRole(i, value as TaskParticipantRole)}>
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
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Удалить участника"
            disabled={participants.length === 1}
            onClick={() => remove(i)}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        onClick={add}
        disabled={participants.length >= 20}
      >
        + Добавить участника
      </Button>
    </div>
  );
}

function toIntOr(value: string, fallback: number): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function taskFormEquals(a: UpdateTaskFormState, b: UpdateTaskFormState): boolean {
  if (a.title !== b.title) return false;
  if (a.description !== b.description) return false;
  if (a.priority !== b.priority) return false;
  if (a.statusId !== b.statusId) return false;
  if (formatPlanDate(a.plannedStart) !== formatPlanDate(b.plannedStart)) return false;
  if (formatPlanDate(a.plannedFinish) !== formatPlanDate(b.plannedFinish)) return false;
  if (a.durationWorkingDays !== b.durationWorkingDays) return false;
  if (a.plannedWork !== b.plannedWork) return false;
  if (a.requiresAcceptance !== b.requiresAcceptance) return false;
  if (a.participants.length !== b.participants.length) return false;
  for (let i = 0; i < a.participants.length; i += 1) {
    if (a.participants[i]!.userId !== b.participants[i]!.userId) return false;
    if (a.participants[i]!.role !== b.participants[i]!.role) return false;
  }
  return true;
}
