import { CalendarDays, Plus } from "lucide-react";

import { CardPanel } from "@/components/domain/card-panel";
import { Field, FormGrid, FormSection } from "@/components/domain/form-layout";
import { SwitchRow, SwitchRowList } from "@/components/domain/switch-row";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { mockProjectScreenTitle } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";

type WeekdayDef = { label: string; hours: string; on: boolean };
type Exception = { date: string; reason: string; kind: "holiday" | "short" | "custom" };

const WEEKDAYS: WeekdayDef[] = [
  { label: "Понедельник", hours: "9:00–18:00", on: true },
  { label: "Вторник", hours: "9:00–18:00", on: true },
  { label: "Среда", hours: "9:00–18:00", on: true },
  { label: "Четверг", hours: "9:00–18:00", on: true },
  { label: "Пятница", hours: "9:00–17:00", on: true },
  { label: "Суббота", hours: "выходной", on: false },
  { label: "Воскресенье", hours: "выходной", on: false }
];

const EXCEPTIONS: Exception[] = [
  { date: "12.06.2026", reason: "День России", kind: "holiday" },
  { date: "01.06.2026", reason: "Сокращённый день", kind: "short" },
  { date: "30.05.2026", reason: "Тимбилдинг", kind: "custom" }
];

const KIND_COPY: Record<Exception["kind"], { label: string; tone: "warning" | "info" | "violet" }> = {
  holiday: { label: "Праздник", tone: "warning" },
  short: { label: "Сокр.", tone: "info" },
  custom: { label: "Кастом", tone: "violet" }
};

function ExceptionRow({ item, onRemove }: { item: Exception; onRemove?: () => void }) {
  const meta = KIND_COPY[item.kind];
  return (
    <li className="exception-list__item">
      <span className="mono u-text-xs u-text-strong">{item.date}</span>
      <span className="flex-1 u-text-body">{item.reason}</span>
      <Chip variant={meta.tone}>{meta.label}</Chip>
      <Button
        variant="ghost"
        size="xs"
        aria-label={`Удалить ${item.reason}`}
        onClick={onRemove}
        type="button"
      >
        ×
      </Button>
    </li>
  );
}

export function ProjectCalendarsBlock() {
  return (
    <>
      <PageIntro
        title={mockProjectScreenTitle("Календари")}
        lead="Рабочие часы и исключения календаря арендатора."
        actions={
          <>
            <Button variant="ghost" size="sm">
              <CalendarDays className="size-4" aria-hidden />
              Шаблоны
            </Button>
            <Button variant="primary" size="sm">
              Сохранить
            </Button>
          </>
        }
      />
      <div className="grid-2">
        <CardPanel title="Рабочая неделя" subtitle="Стандартный календарь арендатора">
          <FormSection title="Шаблон" lead="Выберите базовый паттерн или настройте дни вручную.">
            <FormGrid columns={1}>
              <Field label="Шаблон" htmlFor="cal-template">
                <Select defaultValue="ru-5x8">
                  <SelectTrigger id="cal-template" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ru-5x8">RU · 5×8 (40 ч/нед)</SelectItem>
                    <SelectItem value="ru-4x10">RU · 4×10 (40 ч/нед)</SelectItem>
                    <SelectItem value="custom">Пользовательский</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </FormGrid>
          </FormSection>
          <FormSection title="Дни недели" lead="Включите рабочие дни и проверьте часы.">
            <SwitchRowList>
              {WEEKDAYS.map((d) => (
                <SwitchRow key={d.label} label={d.label} description={d.hours} defaultChecked={d.on} />
              ))}
            </SwitchRowList>
          </FormSection>
        </CardPanel>
        <CardPanel
          title="Исключения"
          subtitle={`${EXCEPTIONS.length} даты`}
          actions={
            <Button variant="ghost" size="sm">
              <Plus className="size-4" aria-hidden />
              Добавить
            </Button>
          }
        >
          <FormSection title="Новая дата">
            <FormGrid columns={2}>
              <Field label="Дата" htmlFor="cal-date">
                <DatePicker placeholder="Выберите дату" />
              </Field>
              <Field label="Тип" htmlFor="cal-kind">
                <Select defaultValue="holiday">
                  <SelectTrigger id="cal-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="holiday">Праздник</SelectItem>
                    <SelectItem value="short">Сокращённый</SelectItem>
                    <SelectItem value="custom">Кастомный</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </FormGrid>
          </FormSection>
          <FormSection title="Список исключений">
            <ul className="exception-list">
              {EXCEPTIONS.map((e) => (
                <ExceptionRow key={e.date} item={e} />
              ))}
            </ul>
          </FormSection>
        </CardPanel>
      </div>
    </>
  );
}
