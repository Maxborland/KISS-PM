"use client";

import { useState } from "react";

import { CardPanel } from "@/components/domain/card-panel";
import { Field, FormGrid, FormSection } from "@/components/domain/form-layout";
import { SwitchRow, SwitchRowList } from "@/components/domain/switch-row";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { demoAction } from "@/views/lib/demo";
import { PageIntro } from "@/views/layout/page-intro";

export function SettingsBlock() {
  const [tab, setTab] = useState<"profile" | "notifications" | "integrations" | "billing">("profile");

  return (
    <>
      <PageIntro
        title="Настройки рабочей области"
        lead="Профиль, уведомления и интеграции."
        actions={<Button variant="primary" {...demoAction("сохранение настроек")}>Сохранить</Button>}
      />
      <div className="settings-tabs u-mb-3">
        <Segmented
          name="settings-tabs"
          value={tab}
          onChange={setTab}
          options={[
            { value: "profile", label: "Профиль" },
            { value: "notifications", label: "Уведомления" },
            { value: "integrations", label: "Интеграции" },
            { value: "billing", label: "Оплата" }
          ]}
        />
      </div>
      <CardPanel>
        {tab === "profile" ? (
        <FormSection title="Профиль" lead="Имя, локаль и таймзона.">
          <FormGrid>
            <Field label="Имя" required htmlFor="set-name">
              <Input id="set-name" defaultValue="Камил Б." />
            </Field>
            <Field label="Email" required htmlFor="set-email">
              <Input id="set-email" type="email" defaultValue="kamil@kiss.pm" />
            </Field>
            <Field label="Локаль" htmlFor="set-locale">
              <Select defaultValue="ru">
                <SelectTrigger id="set-locale" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ru">Русский</SelectItem>
                  <SelectItem value="en">Английский</SelectItem>
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
              label="Email — упоминания"
              description="Когда вас тегают в комментариях задач или сделок"
              defaultChecked
            />
            <SwitchRow
              label="Email — дайджест по понедельникам"
              description="Сводка прогресса проектов за неделю"
              defaultChecked
            />
            <SwitchRow
              label="Slack — сигналы контроля"
              description="KPI-сигналы и риски сроков прямо в канал"
            />
          </SwitchRowList>
        </FormSection>
        ) : null}
        {tab === "integrations" || tab === "billing" ? (
        <EmptyState title="Раздел в разработке" description="Появится в рабочем приложении." />
        ) : null}
      </CardPanel>
    </>
  );
}
