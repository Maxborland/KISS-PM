import type { ReactNode } from "react";
import { Briefcase, Calendar, MoreHorizontal, Paperclip, Send } from "lucide-react";

import { BemAvatar, BemAvatarStack } from "@/components/domain/bem-avatar";
import { CardPanel } from "@/components/domain/card-panel";
import { Field, FormGrid, FormSection } from "@/components/domain/form-layout";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
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

export type EntityDetailBlockProps = {
  /** Заголовок страницы. */
  title: string;
  /** Подпись (например, ID-сделки или код проекта). */
  subtitle: string;
  /** Чип над заголовком (стадия). */
  stage?: { label: string; tone?: "info" | "violet" | "success" | "warning" };
  /** Активность / лента. */
  feed?: ReactNode;
  /** Доп. поля справа (вместо базовых). */
  asideExtra?: ReactNode;
  /** Что показывать в основном grid. */
  primary?: ReactNode;
};

const FEED = [
  { who: { initials: "ИИ", color: "c1" as const, name: "Иванова М." }, when: "23 мая 14:32", text: "Подготовила черновик КП. Проверь раздел «Цена»." },
  { who: { initials: "АП", color: "c2" as const, name: "Петров А." }, when: "23 мая 12:05", text: "Сделал расчёт сметы. Расхождение −4% от базового плана." },
  { who: { initials: "КБ", color: "c4" as const, name: "Козлова Е." }, when: "22 мая 17:48", text: "Готова к ревью завтра в 11:00." }
];

export function EntityDetailBlock({ title, subtitle, stage, feed, primary, asideExtra }: EntityDetailBlockProps) {
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
                <DropdownMenuItem>
                  <Calendar className="size-4" aria-hidden />
                  Запланировать
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="primary">Сохранить</Button>
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
                Внедрение CRM в три этапа: аудит процессов, миграция данных, обучение команды.
                Срок — 6 недель. Заказчик — ООО «Ромашка», ответственный — Иванова М.
              </p>
            </CardPanel>
          )}
          <CardPanel title="Лента" subtitle="Активность по сущности" flush className="u-mt-3">
            <ul className="feed">
              {(Array.isArray(feed) ? feed : null) ??
                FEED.map((f, i) => (
                  <li key={i} className="feed__item">
                    <BemAvatar initials={f.who.initials} color={f.who.color} size="sm" />
                    <div>
                      <div className="feed__head">
                        <strong className="u-text-body u-text-strong">{f.who.name}</strong>
                        <span className="u-text-xs u-text-muted">{f.when}</span>
                      </div>
                      <p className="u-text-body">{f.text}</p>
                    </div>
                  </li>
                ))}
            </ul>
            <div className="feed__compose">
              <Textarea rows={2} placeholder="Написать комментарий…" />
              <div className="feed__compose-actions">
                <IconButton label="Прикрепить" variant="ghost">
                  <Paperclip />
                </IconButton>
                <Button variant="secondary" size="sm">
                  <Send className="size-4" aria-hidden />
                  Отправить
                </Button>
              </div>
            </div>
          </CardPanel>
        </div>
        <aside className="entity-grid__aside">
          <CardPanel title="Параметры" subtitle="Свойства сущности">
            <FormSection title="Основное" lead="Доступно владельцу и админу.">
              <FormGrid columns={1}>
                <Field label="Стадия">
                  <Select defaultValue="qual">
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
                <Field label="Сумма">
                  <Input className="mono" defaultValue="890 000" inputMode="numeric" />
                </Field>
              </FormGrid>
            </FormSection>
          </CardPanel>
          {asideExtra ?? (
            <CardPanel title="Связи" subtitle="Проекты и продукты" className="u-mt-3">
              <ul className="link-list">
                <li>
                  <Briefcase className="size-4" aria-hidden /> {MOCK_PROJECT_CRM} (PRJ-2026-014)
                </li>
                <li>
                  <Briefcase className="size-4" aria-hidden /> DataHub KPI (PRJ-2026-009)
                </li>
              </ul>
            </CardPanel>
          )}
        </aside>
      </div>
    </>
  );
}
