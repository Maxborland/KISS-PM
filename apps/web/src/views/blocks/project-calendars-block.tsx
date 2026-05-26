import { useState } from "react";
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
import type { ProductionCalendar } from "@/lib/api-types";
import { formatDate } from "@/lib/mock-data/format";
import { useScenarioFixtures } from "@/lib/mock-data/scenario-context";
import { mockProjectScreenTitle } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";
import { ScreenBlockGate, ScreenBlockPanelSkeleton } from "@/views/blocks/screen-block-fetch";

type WeekdayDef = { label: string; hours: string; on: boolean };
const WEEKDAYS: WeekdayDef[] = [
  { label: "Понедельник", hours: "9:00–18:00", on: true },
  { label: "Вторник", hours: "9:00–18:00", on: true },
  { label: "Среда", hours: "9:00–18:00", on: true },
  { label: "Четверг", hours: "9:00–18:00", on: true },
  { label: "Пятница", hours: "9:00–17:00", on: true },
  { label: "Суббота", hours: "выходной", on: false },
  { label: "Воскресенье", hours: "выходной", on: false }
];

function ExceptionRow({
  item,
  workingMinutesPerDay,
  onRemove
}: {
  item: ProductionCalendar["exceptions"][number];
  workingMinutesPerDay: number;
  onRemove?: () => void;
}) {
  const tone =
    item.workingMinutes === 0
      ? "warning"
      : item.workingMinutes < workingMinutesPerDay
        ? "info"
        : "violet";
  return (
    <li className="exception-list__item">
      <span className="mono u-text-xs u-text-strong">{formatDate(item.date)}</span>
      <span className="flex-1 u-text-body">
        {item.reason ?? "Без причины"} · ресурс {item.resourceId ?? "арендатор"}
      </span>
      <Chip variant={tone}>{item.workingMinutes} мин</Chip>
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
  const { fixtures } = useScenarioFixtures();
  const calendar = fixtures.productionCalendar;
  const [newExceptionDate, setNewExceptionDate] = useState<Date | undefined>();

  const intro = (
    <PageIntro
      title={mockProjectScreenTitle("Календари")}
      lead="Рабочие часы и исключения календаря арендатора."
      actions={
        <>
          <Button variant="ghost" size="sm" disabled title="Демо Storybook: импорт подключится к API">
              <CalendarDays className="size-4" aria-hidden />
              Шаблоны
            </Button>
            <Button variant="primary" size="sm" disabled title="Демо Storybook: сохранение подключится к API">
              Сохранить
            </Button>
          </>
        }
    />
  );

  return (
    <ScreenBlockGate
      intro={intro}
      skeleton={<ScreenBlockPanelSkeleton rows={4} withToolbar={false} />}
      errorTitle="Не удалось загрузить календарь"
      forbiddenTitle="Нет доступа к календарю"
    >
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
          <FormSection title="Дни недели" lead={`${calendar.workingMinutesPerDay} минут в рабочем дне.`}>
            <SwitchRowList>
              {WEEKDAYS.map((d) => (
                <SwitchRow key={d.label} label={d.label} description={d.hours} defaultChecked={d.on} />
              ))}
            </SwitchRowList>
          </FormSection>
        </CardPanel>
        <CardPanel
          title="Исключения"
          subtitle={`${calendar.exceptions.length} даты`}
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
                <DatePicker value={newExceptionDate} onChange={setNewExceptionDate} placeholder="Выберите дату" />
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
              {calendar.exceptions.map((exception) => (
                <ExceptionRow
                  key={exception.id}
                  item={exception}
                  workingMinutesPerDay={calendar.workingMinutesPerDay}
                />
              ))}
            </ul>
          </FormSection>
        </CardPanel>
      </div>
    </ScreenBlockGate>
  );
}
