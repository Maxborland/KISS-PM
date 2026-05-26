import { CardPanel } from "@/components/domain/card-panel";
import { Field, FormGrid, FormSection, TagsInput } from "@/components/domain/form-layout";
import { Button } from "@/components/ui/button";
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
import { MOCK_PROJECT_CRM } from "@/views/catalog";
import { PageIntro } from "@/views/layout/page-intro";

export function TaskCreateModalBlock() {
  return (
    <>
      <PageIntro title="Новая задача" lead="Модальное создание с stepper и формой." />
      <CardPanel className="modal-mock">
        <ol className="stepper">
          <li className="stepper__item is-done">
            <span className="stepper__num">1</span>
            <span>Тип</span>
          </li>
          <li className="stepper__item is-active">
            <span className="stepper__num">2</span>
            <span>Параметры</span>
          </li>
          <li className="stepper__item">
            <span className="stepper__num">3</span>
            <span>Назначение</span>
          </li>
        </ol>
        <FormSection title="Параметры задачи" lead="Опишите контекст и сроки.">
          <FormGrid>
            <Field label="Название" full required htmlFor="t-name">
              <Input id="t-name" placeholder="Согласовать ТЗ с клиентом" />
            </Field>
            <Field label="Тип" htmlFor="t-type">
              <Select defaultValue="action">
                <SelectTrigger id="t-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="action">Действие</SelectItem>
                  <SelectItem value="meeting">Митинг</SelectItem>
                  <SelectItem value="review">Ревью</SelectItem>
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
            <Field label="Срок" htmlFor="t-due">
              <DatePicker placeholder="Выбрать дату" />
            </Field>
            <Field label="Длительность" htmlFor="t-dur">
              <Input id="t-dur" defaultValue="2д" />
            </Field>
            <Field label="Приоритет" full>
              <RadioGroup defaultValue="normal" name="t-prio" className="grid grid-cols-3 gap-[var(--space-2)]">
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
            <Field label="Теги" full>
              <TagsInput tags={["CRM", "Q3"]} />
            </Field>
            <Field label="Описание" full htmlFor="t-desc">
              <Textarea id="t-desc" rows={3} placeholder="Контекст задачи" />
            </Field>
          </FormGrid>
        </FormSection>
        <div className="modal-mock__footer">
          <Button variant="ghost">Отмена</Button>
          <div className="ml-auto flex gap-[var(--space-2)]">
            <Button variant="secondary">Назад</Button>
            <Button variant="primary">Далее</Button>
          </div>
        </div>
      </CardPanel>
    </>
  );
}
