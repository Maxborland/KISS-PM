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
import {
  MOCK_CUSTOM_FIELDS,
  MOCK_PROJECT_TEMPLATES,
  MOCK_TASK_STATUSES
} from "@/lib/mock-data/workspace-config";
import { MOCK_DEAL_STAGES } from "@/lib/mock-data/crm";
import { PageIntro } from "@/views/layout/page-intro";

export function SettingsBlock() {
  const [tab, setTab] = useState<"profile" | "notifications" | "integrations" | "billing" | "workspace">("profile");

  return (
    <>
      <PageIntro
        title="Настройки рабочей области"
        lead="Профиль, уведомления и интеграции."
        actions={<Button variant="primary">Сохранить</Button>}
      />
      <div className="settings-tabs u-mb-3">
        <Segmented
          name="settings-tabs"
          value={tab}
          onChange={setTab}
          options={[
            { value: "profile", label: "Профиль" },
            { value: "notifications", label: "Уведомления" },
            { value: "workspace", label: "Workspace config" },
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
              ? "Tenant-настройки: поля, шаблоны, стадии и статусы."
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
          <FormSection title="Workspace config" lead="CustomFieldDefinition, ProjectTemplate, DealStage и TaskStatus из API-контракта.">
            <div className="grid-2">
              <ConfigList
                title="Шаблоны проектов"
                rows={MOCK_PROJECT_TEMPLATES.map((template) => ({
                  title: template.tenantLabel,
                  subtitle: template.systemKey,
                  meta: template.status
                }))}
              />
              <ConfigList
                title="Кастомные поля"
                rows={MOCK_CUSTOM_FIELDS.map((field) => ({
                  title: field.tenantLabel,
                  subtitle: `${field.systemKey} · ${field.targetEntity} · ${field.fieldType}`,
                  meta: field.required ? "required" : field.status
                }))}
              />
              <ConfigList
                title="Стадии сделок"
                rows={MOCK_DEAL_STAGES.map((stage) => ({
                  title: stage.name,
                  subtitle: `${stage.id} · sortOrder ${stage.sortOrder}`,
                  meta: stage.status
                }))}
              />
              <ConfigList
                title="Статусы задач"
                rows={MOCK_TASK_STATUSES.map((status) => ({
                  title: status.name,
                  subtitle: `${status.id} · ${status.category} · order ${status.sortOrder}`,
                  meta: status.isSystem ? "system" : status.status
                }))}
              />
            </div>
          </FormSection>
        ) : null}
      </CardPanel>
    </>
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
          <Chip variant={row.meta === "active" || row.meta === "system" ? "success" : "warning"}>{row.meta}</Chip>
        </div>
      ))}
    </div>
  );
}
