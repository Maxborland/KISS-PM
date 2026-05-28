"use client";

import { useState } from "react";

import { CardPanel } from "@/components/domain/card-panel";
import { Field, FormGrid, FormSection } from "@/components/domain/form-layout";
import { SwitchRow, SwitchRowList } from "@/components/domain/switch-row";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useScenarioFixtures } from "@/lib/mock-data/scenario-context";
import { PageIntro } from "@/views/layout/page-intro";
import { ScreenBlockGate, ScreenBlockPanelSkeleton } from "@/views/blocks/screen-block-fetch";

function statusLabel(value: string): string {
  if (value === "active") return "Активно";
  if (value === "draft") return "Черновик";
  if (value === "archived") return "Архив";
  if (value === "system") return "Системный";
  return value;
}

function entityLabel(value: string): string {
  if (value === "project") return "проект";
  if (value === "task") return "задача";
  if (value === "deal") return "сделка";
  if (value === "client") return "клиент";
  return value;
}

function fieldTypeLabel(value: string): string {
  if (value === "text") return "текст";
  if (value === "number") return "число";
  if (value === "date") return "дата";
  if (value === "select") return "список";
  if (value === "boolean") return "да/нет";
  return value;
}

function taskStatusCategoryLabel(value: string): string {
  if (value === "todo") return "к выполнению";
  if (value === "in_progress") return "в работе";
  if (value === "done") return "готово";
  if (value === "blocked") return "заблокировано";
  return value;
}

export function SettingsBlock() {
  const { fixtures } = useScenarioFixtures();
  const [tab, setTab] = useState<"profile" | "notifications" | "integrations" | "billing" | "workspace">("profile");

  const intro = (
    <PageIntro
      title="Настройки рабочей области"
      lead="Профиль, уведомления и интеграции."
      actions={<Button variant="primary">Сохранить</Button>}
    />
  );

  return (
    <ScreenBlockGate
      intro={intro}
      skeleton={<ScreenBlockPanelSkeleton rows={4} withToolbar={false} />}
      errorTitle="Не удалось загрузить настройки"
      forbiddenTitle="Нет доступа к настройкам"
    >
      <div className="settings-tabs u-mb-3">
        <Segmented
          name="settings-tabs"
          value={tab}
          onChange={setTab}
          options={[
            { value: "profile", label: "Профиль" },
            { value: "notifications", label: "Уведомления" },
            { value: "workspace", label: "Рабочая область" },
            { value: "integrations", label: "Интеграции" },
            { value: "billing", label: "Оплата" }
          ]}
        />
      </div>
      {tab !== "profile" ? (
        <p className="u-text-sm u-text-muted u-mb-3">
          {tab === "notifications"
            ? "Вкладка «Уведомления» (демо переключения)."
            : tab === "workspace"
              ? "Настройки рабочей области: поля, шаблоны, стадии и статусы."
              : tab === "integrations"
              ? "Вкладка «Интеграции» (демо переключения)."
              : "Вкладка «Оплата» (демо переключения)."}
        </p>
      ) : null}
      <CardPanel>
        {tab === "profile" ? (
        <FormSection title="Профиль" lead="Имя, локаль и таймзона.">
          <FormGrid>
            <Field label="Имя" required htmlFor="set-name">
              <Input id="set-name" defaultValue="Камил Б." />
            </Field>
            <Field label="Эл. почта" required htmlFor="set-email">
              <Input id="set-email" type="email" defaultValue="kamil@kiss.pm" />
            </Field>
            <Field label="Локаль" htmlFor="set-locale">
              <Select defaultValue="ru">
                <SelectTrigger id="set-locale" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ru">Русский</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Таймзона" htmlFor="set-tz">
              <Select defaultValue="msk">
                <SelectTrigger id="set-tz" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="msk">Europe/Moscow (UTC+3)</SelectItem>
                  <SelectItem value="utc">UTC</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FormGrid>
        </FormSection>
        ) : null}
        {tab === "notifications" ? (
        <FormSection title="Уведомления" lead="Каналы и частота.">
          <SwitchRowList>
            <SwitchRow
              label="Почта — упоминания"
              description="Когда вас тегают в комментариях задач или сделок"
              defaultChecked
            />
            <SwitchRow
              label="Почта — дайджест по понедельникам"
              description="Сводка прогресса проектов за неделю"
              defaultChecked
            />
            <SwitchRow
              label="Slack — сигналы управления"
              description="KPI-сигналы и риски сроков прямо в канал"
            />
          </SwitchRowList>
        </FormSection>
        ) : null}
        {tab === "workspace" ? (
          <FormSection title="Настройки рабочей области" lead="Поля, шаблоны, стадии и статусы, которые влияют на проектный контур.">
            <div className="grid-2">
              <ConfigList
                title="Шаблоны проектов"
                rows={fixtures.projectTemplates.map((template) => ({
                  title: template.tenantLabel,
                  subtitle: `Ключ шаблона: ${template.systemKey}`,
                  meta: statusLabel(template.status)
                }))}
              />
              <ConfigList
                title="Кастомные поля"
                rows={fixtures.customFields.map((field) => ({
                  title: field.tenantLabel,
                  subtitle: `Поле: ${field.systemKey} · ${entityLabel(field.targetEntity)} · ${fieldTypeLabel(field.fieldType)}`,
                  meta: field.required ? "Обязательное" : statusLabel(field.status)
                }))}
              />
              <ConfigList
                title="Стадии сделок"
                rows={fixtures.dealStages.map((stage) => ({
                  title: stage.name,
                  subtitle: `Код: ${stage.id} · порядок ${stage.sortOrder}`,
                  meta: statusLabel(stage.status)
                }))}
              />
              <ConfigList
                title="Статусы задач"
                rows={fixtures.taskStatuses.map((status) => ({
                  title: status.name,
                  subtitle: `Код: ${status.id} · ${taskStatusCategoryLabel(status.category)} · порядок ${status.sortOrder}`,
                  meta: status.isSystem ? "Системный" : statusLabel(status.status)
                }))}
              />
            </div>
          </FormSection>
        ) : null}
      </CardPanel>
    </ScreenBlockGate>
  );
}

function ConfigList({
  title,
  rows
}: {
  title: string;
  rows: Array<{ title: string; subtitle: string; meta: string }>;
}) {
  return (
    <div className="u-flex u-flex-col u-gap-2">
      <strong className="u-text-sm u-text-strong">{title}</strong>
      {rows.map((row) => (
        <div key={row.subtitle} className="u-flex u-items-center u-justify-between u-gap-3">
          <span>
            <span className="u-text-sm">{row.title}</span>
            <span className="u-text-xs u-text-muted u-block">{row.subtitle}</span>
          </span>
          <Chip variant={row.meta === "Активно" || row.meta === "Системный" ? "success" : "warning"}>{row.meta}</Chip>
        </div>
      ))}
    </div>
  );
}
