"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";

import { Field, FormGrid, FormSection, TagsInput } from "@/components/domain/form-layout";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";
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
import { MOCK_PROJECT_CRM } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";
import { demoAction } from "@/views/lib/demo";
import { PrototypeDialog } from "@/views/lib/prototype-dialog";

const STEPS = ["Тип", "Параметры", "Назначение"];

/**
 * Создание задачи как РЕАЛЬНАЯ модалка (Dialog/overlay), а не CardPanel на странице
 * (§6 DESIGN_CONTRACT). Stepper и кнопки «Назад/Далее» рабочие (fixture-навигация по
 * шагам); «Создать» честно отключена — прототип не сохраняет.
 */
export function TaskCreateModalBlock() {
  return (
    <>
      <PageIntro
        title="Новая задача"
        lead="Создание задачи открывается модальным окном поверх рабочей области."
      />
      <p className="u-text-sm u-text-muted">
        Ниже — превью модального создания. Шаги переключаются, форма в прототипе не сохраняется.
      </p>
      <TaskCreateDialog defaultOpen trigger={
        <Button variant="primary">
          <Plus className="size-4" aria-hidden />
          Новая задача
        </Button>
      } />
    </>
  );
}

/** Переиспользуемая модалка создания задачи (триггер передаётся снаружи). */
export function TaskCreateDialog({
  trigger,
  defaultOpen = false
}: {
  trigger: ReactNode;
  defaultOpen?: boolean;
}) {
  const [step, setStep] = useState(1);

  return (
    <PrototypeDialog
      trigger={trigger}
      defaultOpen={defaultOpen}
      title="Новая задача"
      description="Шаг за шагом: тип, параметры, назначение."
      contentClassName="max-w-[640px]"
      footer={
        <DialogFooter className="sm:justify-between">
          <DialogClose asChild>
            <Button variant="ghost">Отмена</Button>
          </DialogClose>
          <div className="ml-auto flex gap-[var(--space-2)]">
            <Button
              variant="secondary"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              Назад
            </Button>
            {step < STEPS.length ? (
              <Button variant="primary" onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}>
                Далее
              </Button>
            ) : (
              <Button variant="primary" {...demoAction("создание задачи")}>
                Создать
              </Button>
            )}
          </div>
        </DialogFooter>
      }
    >
      <ol className="stepper">
        {STEPS.map((label, i) => {
          const n = i + 1;
          return (
            <li
              key={label}
              className={cn("stepper__item", n === step && "is-active", n < step && "is-done")}
            >
              <span className="stepper__num">{n}</span>
              <span>{label}</span>
            </li>
          );
        })}
      </ol>

      {step === 1 ? (
        <FormSection title="Тип задачи" lead="Выберите тип и проект.">
          <FormGrid>
            <Field label="Тип" htmlFor="t-type">
              <Select defaultValue="action">
                <SelectTrigger id="t-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="action">Действие</SelectItem>
                  <SelectItem value="meeting">Встреча</SelectItem>
                  <SelectItem value="review">Проверка</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Проект" htmlFor="t-project">
              <Combobox
                options={[
                  { value: "crm", label: MOCK_PROJECT_CRM },
                  { value: "datahub", label: "DataHub KPI" }
                ]}
                placeholder="Выбрать"
              />
            </Field>
          </FormGrid>
        </FormSection>
      ) : null}

      {step === 2 ? (
        <FormSection title="Параметры задачи" lead="Опишите контекст и сроки.">
          <FormGrid>
            <Field label="Название" full required htmlFor="t-name">
              <Input id="t-name" placeholder="Согласовать ТЗ с клиентом" />
            </Field>
            <Field label="Срок" htmlFor="t-due">
              <DatePicker placeholder="Выбрать дату" />
            </Field>
            <Field label="Длительность" htmlFor="t-dur">
              <Input id="t-dur" defaultValue="2д" />
            </Field>
            <Field label="Приоритет" full>
              <RadioGroup
                defaultValue="normal"
                name="t-prio"
                className="grid grid-cols-1 gap-[var(--space-2)] sm:grid-cols-3"
              >
                <RadioGroupItem id="p-low" value="low">
                  Низкий
                </RadioGroupItem>
                <RadioGroupItem id="p-normal" value="normal">
                  Обычный
                </RadioGroupItem>
                <RadioGroupItem id="p-urgent" value="urgent">
                  Срочный
                </RadioGroupItem>
              </RadioGroup>
            </Field>
          </FormGrid>
        </FormSection>
      ) : null}

      {step === 3 ? (
        <FormSection title="Назначение" lead="Теги и описание задачи.">
          <FormGrid>
            <Field label="Теги" full>
              <TagsInput tags={["CRM", "Q3"]} />
            </Field>
            <Field label="Описание" full htmlFor="t-desc">
              <Textarea id="t-desc" rows={3} placeholder="Контекст задачи" />
            </Field>
          </FormGrid>
        </FormSection>
      ) : null}
    </PrototypeDialog>
  );
}
