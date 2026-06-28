"use client";

import { AtSign, CalendarClock, CheckCircle2, Video, type LucideIcon } from "lucide-react";

import { BemAvatar, BemAvatarStack } from "@/components/domain/bem-avatar";
import { CardPanel } from "@/components/domain/card-panel";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";

const DEMO_TITLE = "Демо Storybook: подключение медиа отключено";

type NotificationTone = "info" | "violet" | "success" | "warning";

type NotificationRow = {
  id: string;
  Icon: LucideIcon;
  title: string;
  meta: string;
  kind: string;
  tone: NotificationTone;
  unread?: boolean;
};

const NOTIFICATIONS: NotificationRow[] = [
  { id: "n1", Icon: AtSign, title: "Пётр Алексеев упомянул вас", meta: "Внедрение «Ромашка» · 5 мин назад", kind: "Упоминание", tone: "violet", unread: true },
  { id: "n2", Icon: Video, title: "Приглашение на звонок «Планёрка»", meta: "Сегодня в 16:00 · 20 мин назад", kind: "Звонок", tone: "info", unread: true },
  { id: "n3", Icon: CalendarClock, title: "Встреча «Ревью КП» через час", meta: "15:00 · 40 мин назад", kind: "Встреча", tone: "warning" },
  { id: "n4", Icon: CheckCircle2, title: "Елена Козлова отметила задачу выполненной", meta: "MDS-39 · вчера", kind: "Задача", tone: "success" }
];

export function NotificationsBlock() {
  return (
    <CardPanel title="Уведомления" subtitle="Упоминания, ответы и приглашения на звонки">
      <div className="comms-list">
        {NOTIFICATIONS.map(({ id, Icon, title, meta, kind, tone, unread }) => (
          <div key={id} className={cn("comms-row", unread && "comms-row--unread")}>
            <span className="comms-row__icon">
              <Icon aria-hidden size={16} />
            </span>
            <div className="comms-row__body">
              <span className="comms-row__title">{title}</span>
              <span className="comms-row__meta">{meta}</span>
            </div>
            <div className="comms-row__trailing">
              <Chip variant={tone}>{kind}</Chip>
            </div>
          </div>
        ))}
      </div>
    </CardPanel>
  );
}

type MeetingRow = {
  id: string;
  title: string;
  when: string;
  status: string;
  tone: "info" | "success";
};

const MEETINGS: MeetingRow[] = [
  { id: "mt1", title: "Планёрка по внедрению", when: "Сегодня · 16:00", status: "Запланирована", tone: "info" },
  { id: "mt2", title: "Ревью КП «Ромашка»", when: "Завтра · 11:00", status: "Запланирована", tone: "info" },
  { id: "mt3", title: "Ретроспектива спринта", when: "Вчера · 17:30", status: "Завершена", tone: "success" }
];

export function MeetingsListBlock() {
  return (
    <CardPanel title="Встречи" subtitle="Запланированные и прошедшие встречи команды">
      <div className="comms-list">
        {MEETINGS.map((meeting) => (
          <div key={meeting.id} className="comms-row">
            <span className="comms-row__icon">
              <Video aria-hidden size={16} />
            </span>
            <div className="comms-row__body">
              <span className="comms-row__title">{meeting.title}</span>
              <span className="comms-row__meta">{meeting.when}</span>
            </div>
            <div className="comms-row__trailing">
              <BemAvatarStack more="+2">
                <BemAvatar initials="АК" color="c1" size="sm" />
                <BemAvatar initials="ПА" color="c3" size="sm" />
              </BemAvatarStack>
              <Chip variant={meeting.tone}>{meeting.status}</Chip>
              <Button variant="secondary" size="sm" disabled title={DEMO_TITLE}>
                Открыть
              </Button>
            </div>
          </div>
        ))}
      </div>
    </CardPanel>
  );
}

export function MeetingDetailBlock() {
  return (
    <>
      <CardPanel title="Повестка" subtitle="Планёрка по внедрению · сегодня 16:00">
        <ul className="link-list">
          <li>Статус миграции данных</li>
          <li>Риски по срокам этапа 2</li>
          <li>План обучения команды заказчика</li>
        </ul>
      </CardPanel>
      <CardPanel title="Заметки" subtitle="Ход обсуждения" flush className="u-mt-3">
        <ul className="feed">
          <li className="feed__item">
            <BemAvatar initials="АК" color="c1" size="sm" />
            <div>
              <div className="feed__head">
                <strong className="u-text-body u-text-strong">Анна Кузнецова</strong>
                <span className="u-text-xs u-text-muted">16:05</span>
              </div>
              <p className="u-text-body">Миграция идёт по плану, расхождение −4% от базового плана.</p>
            </div>
          </li>
          <li className="feed__item">
            <BemAvatar initials="ПА" color="c3" size="sm" />
            <div>
              <div className="feed__head">
                <strong className="u-text-body u-text-strong">Пётр Алексеев</strong>
                <span className="u-text-xs u-text-muted">16:12</span>
              </div>
              <p className="u-text-body">Нужна помощь с этапом обучения, обсудим отдельно.</p>
            </div>
          </li>
        </ul>
      </CardPanel>
      <CardPanel title="Задачи встречи" subtitle="Поручения по итогам" className="u-mt-3">
        <ul className="link-list">
          <li>Подготовить план миграции — Пётр Алексеев</li>
          <li>Согласовать график обучения — Анна Кузнецова</li>
        </ul>
      </CardPanel>
      <CardPanel title="Ссылки" subtitle="Внешние материалы" className="u-mt-3">
        <ul className="link-list">
          <li>Запись прошлой встречи</li>
          <li>Документ требований заказчика</li>
        </ul>
      </CardPanel>
    </>
  );
}
