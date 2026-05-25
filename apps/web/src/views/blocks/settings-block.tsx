"use client";

import { useState } from "react";

import { CardPanel } from "@/components/domain/card-panel";
import { Field, FormGrid, FormSection } from "@/components/domain/form-layout";
import { SwitchRow, SwitchRowList } from "@/components/domain/switch-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { PageIntro } from "@/views/layout/page-intro";

export function SettingsBlock() {
  const [tab, setTab] = useState<"profile" | "notifications" | "integrations" | "billing">("profile");

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
            { value: "integrations", label: "Интеграции" },
            { value: "billing", label: "Оплата" }
          ]}
        />
      </div>
      {tab !== "profile" ? (
        <p className="u-text-sm u-text-muted u-mb-3">
          {tab === "notifications"
            ? "Вкладка «Уведомления» (демо переключения)."
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
      </CardPanel>
    </>
  );
}
