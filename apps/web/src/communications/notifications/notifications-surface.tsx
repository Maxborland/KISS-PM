"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCheck, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { SurfaceState, surfaceStatusOf } from "@/components/domain/surface-state";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { CommsFrame } from "@/communications/ui/comms-frame";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import { commsErr, NotifTypeIcon, relTime } from "@/communications/lib/comms-bits";
import { useNotificationPreferences, useNotifications } from "@/communications/lib/use-comms";
import { useWorkspaceRealtime } from "@/communications/lib/use-realtime";
import type {
  DigestFrequency,
  NotificationChannel,
  NotificationType,
  PreferenceInput
} from "@/communications/lib/comms-client";

/* ============================================================
   Поверхность «Уведомления» (Communications/Notifications).
   Два вида: «Лента» (useNotifications(status?) + per-item markRead +
   честный bulk = N вызовов markRead по непрочитанным) и «Настройки»
   (useNotificationPreferences: таблица channel × type, switch + select
   частоты дайджеста, «Сохранить» = полный upsert putNotificationPreferences).
   Стиль — зеркало deals-surface (Tailwind + var(--...) токены, баннер
   «Прототип», состояния loading/error/empty).
   ============================================================ */

type View = "feed" | "prefs";
type FeedFilter = "" | "unread" | "read";

// Все каналы доставки и типы уведомлений из доменных union'ов (для таблицы настроек).
const CHANNELS: NotificationChannel[] = ["in_app", "email", "digest"];
// Каналы с РАБОТАЮЩИМ путём доставки. email/digest вернулись (Блок 8): фоновая
// джоба notification.dispatch (apps/api/src/backgroundJobs/jobHandlers.ts) собирает
// непрочитанные уведомления за окно и шлёт письмо-дайджест через emailProvider
// (SMTP). Переключатель email/digest теперь честный — за ним реальная отправка.
const DELIVERABLE_CHANNELS: NotificationChannel[] = ["in_app", "email", "digest"];
const PENDING_CHANNELS = CHANNELS.filter((channel) => !DELIVERABLE_CHANNELS.includes(channel));
const NOTIF_TYPES: NotificationType[] = [
  "mention",
  "assignment_changed",
  "deadline_risk",
  "control_signal",
  "meeting_invite",
  "meeting_action_item"
];
const DIGEST_FREQS: DigestFrequency[] = ["none", "daily", "weekly"];

const CHANNEL_LABEL: Record<NotificationChannel, string> = {
  in_app: "В приложении",
  email: "Email",
  digest: "Дайджест"
};
const NOTIF_TYPE_LABEL: Record<NotificationType, string> = {
  mention: "Упоминание",
  assignment_changed: "Смена ответственного",
  deadline_risk: "Риск дедлайна",
  control_signal: "Контрольный сигнал",
  meeting_invite: "Приглашение на встречу",
  meeting_action_item: "Задача по итогам встречи"
};
const DIGEST_LABEL: Record<DigestFrequency, string> = {
  none: "Без дайджеста",
  daily: "Ежедневно",
  weekly: "Еженедельно"
};

// Ключ строки настроек channel×type (для локального состояния формы).
const prefKey = (channel: NotificationChannel, notificationType: NotificationType) => `${channel}::${notificationType}`;
const selCls =
  "h-8 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--panel)] px-2 text-[length:var(--text-xs)] text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-60";

export function NotificationsSurface() {
  const [view, setView] = useState<View>("feed");
  return (
    <CommsFrame
      activeTab="Уведомления"
      subtitle="Лента уведомлений и настройки доставки"
      actions={
        <Segmented
          name="notif-view"
          value={view}
          onChange={setView}
          options={[
            { value: "feed", label: "Лента" },
            { value: "prefs", label: "Настройки" }
          ]}
        />
      }
    >
      {/* Честный баннер «Прототип» — только в Storybook/демо (prototypeNotesEnabled). */}
      {prototypeNotesEnabled ? (
        <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          <span>
            Реальный контракт: /api/workspace/{"{notifications, notification-preferences}"}. «Прочитать» — POST /notifications/:id/read (не идемпотентно); «Прочитать все» — отдельной ручки нет, поэтому честно шлём по одному POST на каждое непрочитанное. Настройки — PUT /notification-preferences (upsert переданных пар). В приложении лента живёт на SSE-push (notification.created); в этом демо realtime-сервера нет — обновление по действию.
          </span>
        </div>
      ) : null}

      <div key={view} className="anim-fade-in">{view === "feed" ? <NotificationsFeed /> : <NotificationsPrefs />}</div>
    </CommsFrame>
  );
}

/* ============================================================
   ЛЕНТА: фильтр-segmented (Все/Непрочитанные/Прочитанные → status ""|unread|read),
   per-item «Прочитать», bulk «Отметить все прочитанными» (N вызовов markRead).
   ============================================================ */
function NotificationsFeed() {
  const [filter, setFilter] = useState<FeedFilter>("");
  const { data, status, error, reload, markRead } = useNotifications(filter === "" ? undefined : filter);
  const [busy, setBusy] = useState(false);

  // P8 realtime: notification.created в user-канале (SSE) → инвалидация ленты.
  // Бейджи (топбар/comms-frame) живут на своей подписке в CommsFrame → useUnreadSummary.
  // В mock-режиме подписка — no-op (см. useWorkspaceRealtime).
  useWorkspaceRealtime({ onNotification: () => { void reload(); } });

  const notifications = data?.notifications ?? [];
  const unread = useMemo(() => notifications.filter((n) => n.readAt === null), [notifications]);

  async function readOne(id: string) {
    setBusy(true);
    const res = await markRead(id);
    setBusy(false);
    if (res.ok) toast.success("Уведомление отмечено прочитанным");
    else toast.error(`Не удалось: ${commsErr(res.code, res.message)}`);
  }

  // Bulk: отдельной ручки нет — честно шлём markRead по каждому непрочитанному, затем перезагружаем ленту.
  async function readAll() {
    if (unread.length === 0) return;
    setBusy(true);
    let failed = 0;
    for (const n of unread) {
      const res = await markRead(n.id);
      if (!res.ok) failed += 1;
    }
    await reload();
    setBusy(false);
    if (failed === 0) toast.success(`Отмечено прочитанными: ${unread.length}`);
    else toast.error(`Отмечено с ошибками (${failed} из ${unread.length} не удалось)`);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          name="notif-filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "", label: "Все" },
            { value: "unread", label: "Непрочитанные" },
            { value: "read", label: "Прочитанные" }
          ]}
        />
        {unread.length > 0 ? <Chip variant="violet">{unread.length} непрочит.</Chip> : null}
        <Button variant="secondary" size="sm" className="ml-auto" disabled={busy || unread.length === 0} onClick={() => void readAll()} title="Отметить все уведомления прочитанными">
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <CheckCheck className="size-3.5" aria-hidden />}
          Прочитать все
        </Button>
      </div>

      {/* Верхнеуровневые состояния ленты: forbidden (403) / error / loading — через SurfaceState.
          ВЛОЖЕННЫЙ EmptyState ленты (filter-aware «…нет») остаётся nested-состоянием в ready. */}
      <SurfaceState
        status={status === "forbidden" ? "forbidden" : status === "error" ? "error" : status === "loading" && !data ? "loading" : "ready"}
        error={error}
        onRetry={() => void reload()}
        errorFormat={commsErr}
        height="320px"
        loadingLabel="Загрузка уведомлений…"
        forbidden={{ title: "Нет доступа к уведомлениям", description: "У вас нет прав на просмотр уведомлений." }}
      >
        {notifications.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] py-6 shadow-[var(--shadow-card)]">
          <EmptyState
            title={filter === "unread" ? "Непрочитанных уведомлений нет" : filter === "read" ? "Прочитанных уведомлений нет" : "Уведомлений пока нет"}
            description="Здесь появятся упоминания, приглашения на встречи и задачи по итогам встреч."
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => {
            const isUnread = n.readAt === null;
            return (
              <li
                key={n.id}
                className={cn(
                  "flex items-start gap-3 rounded-[var(--radius-card)] border bg-[var(--panel)] px-3.5 py-3 shadow-[var(--shadow-card)] transition-colors",
                  isUnread ? "border-[var(--accent-muted)] bg-[var(--accent-soft)]" : "border-[var(--border)]"
                )}
              >
                <span className="relative mt-0.5 grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--panel-strong)]">
                  <NotifTypeIcon type={n.notificationType} />
                  {isUnread ? <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--panel)]" aria-hidden /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className={cn("text-[length:var(--text-sm)]", isUnread ? "font-bold text-[var(--text-strong)]" : "font-semibold text-[var(--text)]")}>{n.title}</span>
                    <Chip>{NOTIF_TYPE_LABEL[n.notificationType]}</Chip>
                    <span className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{relTime(n.createdAt)}</span>
                    {isUnread ? <span className="text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.03em] text-[var(--accent-text)]">Новое</span> : null}
                  </div>
                  <p className={cn("mt-0.5 text-[length:var(--text-sm)]", isUnread ? "text-[var(--text)]" : "text-[var(--muted)]")}>{n.body}</p>
                  {/* COMM-04: раньше route был просто текстом. Внутренний путь → ссылка-переход
                      (при клике помечаем прочитанным). Не-путь показываем как раньше. */}
                  {n.route && n.route.startsWith("/") ? (
                    <Link
                      href={n.route}
                      onClick={() => { if (isUnread) void readOne(n.id); }}
                      className="mt-0.5 inline-flex items-center gap-0.5 text-[length:var(--text-2xs)] font-medium text-[var(--accent)] hover:underline"
                    >
                      Перейти <ArrowUpRight className="size-3" aria-hidden />
                    </Link>
                  ) : n.route ? (
                    <p className="mt-0.5 text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{n.route}</p>
                  ) : null}
                </div>
                {isUnread ? (
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => void readOne(n.id)} className="shrink-0">Прочитать</Button>
                ) : (
                  <span className="shrink-0 text-[length:var(--text-2xs)] text-[var(--muted-soft)]">прочитано {n.readAt ? relTime(n.readAt) : ""}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      </SurfaceState>
    </div>
  );
}

/* ============================================================
   НАСТРОЙКИ: таблица channel × notificationType (switch enabled +
   select digestFrequency). «Сохранить» — полный upsert
   putNotificationPreferences(весь набор строк).
   ============================================================ */
type PrefRow = { enabled: boolean; digestFrequency: DigestFrequency };

// Экспортируется для переиспользования во вкладке «Уведомления» поверхности настроек
// (самодостаточен: собственный useNotificationPreferences + SurfaceState внутри).
export function NotificationsPrefs() {
  const { data, status, error, reload, savePreferences } = useNotificationPreferences();
  // Локальная матрица настроек: ключ channel::type → {enabled, digestFrequency}.
  const [rows, setRows] = useState<Map<string, PrefRow>>(new Map());
  const [busy, setBusy] = useState(false);

  // Инициализация матрицы из ответа: серверные строки + дефолты для отсутствующих ячеек.
  useEffect(() => {
    if (!data) return;
    const map = new Map<string, PrefRow>();
    for (const c of CHANNELS) {
      for (const t of NOTIF_TYPES) {
        map.set(prefKey(c, t), { enabled: false, digestFrequency: "none" });
      }
    }
    for (const p of data.preferences) {
      map.set(prefKey(p.channel, p.notificationType), { enabled: p.enabled, digestFrequency: p.digestFrequency });
    }
    setRows(map);
  }, [data]);

  const cell = (c: NotificationChannel, t: NotificationType): PrefRow => rows.get(prefKey(c, t)) ?? { enabled: false, digestFrequency: "none" };
  const setCell = (c: NotificationChannel, t: NotificationType, patch: Partial<PrefRow>) =>
    setRows((m) => {
      const next = new Map(m);
      const key = prefKey(c, t);
      next.set(key, { ...(next.get(key) ?? { enabled: false, digestFrequency: "none" }), ...patch });
      return next;
    });

  async function save() {
    setBusy(true);
    // Upsert по ключу channel×type: шлём все ячейки ДОСТУПНЫХ каналов (включая выключенные).
    // Все каналы (in_app/email/digest) теперь доставляемы (Блок 8) — PUT upsert'ит
    // переданные пары (не replace-all), поэтому нетронутые ключи сохраняются.
    const payload: PreferenceInput[] = [];
    for (const c of DELIVERABLE_CHANNELS) {
      for (const t of NOTIF_TYPES) {
        const r = cell(c, t);
        payload.push({ channel: c, notificationType: t, enabled: r.enabled, digestFrequency: r.digestFrequency });
      }
    }
    const res = await savePreferences(payload);
    setBusy(false);
    if (res.ok) toast.success("Настройки сохранены");
    else toast.error(`Не удалось: ${commsErr(res.code, res.message)}`);
  }

  // Верхнеуровневое состояние настроек: forbidden (403) / error / loading — общий surfaceStatusOf.
  const surfaceStatus = surfaceStatusOf(status, Boolean(data));
  if (surfaceStatus !== "ready") {
    return (
      <SurfaceState
        status={surfaceStatus}
        error={error}
        onRetry={() => void reload()}
        errorFormat={commsErr}
        height="320px"
        loadingLabel="Загрузка настроек…"
        forbidden={{ title: "Нет доступа к настройкам", description: "У вас нет прав на изменение настроек уведомлений." }}
      >
        <span />
      </SurfaceState>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[length:var(--text-xs)] text-[var(--muted)]">
          Включите доставку по типам уведомлений и каналам. «Сохранить» обновит настройки доступных каналов.
        </p>
        <Button variant="default" size="sm" disabled={busy} onClick={() => void save()}>
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Save className="size-3.5" aria-hidden />}
          Сохранить
        </Button>
      </div>

      <div className="overflow-auto rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] shadow-[var(--shadow-card)]">
        <table className="w-full border-collapse text-[length:var(--text-sm)]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--panel-subtle)] text-left text-[length:var(--text-xs)] uppercase tracking-[0.03em] text-[var(--muted-soft)]">
              <th className="px-3 py-2 font-semibold">Тип уведомления</th>
              {DELIVERABLE_CHANNELS.map((c) => (
                <th key={c} className="px-3 py-2 text-center font-semibold">{CHANNEL_LABEL[c]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {NOTIF_TYPES.map((t) => (
              <tr key={t} className="border-b border-[var(--border-subtle)] last:border-0">
                <td className="px-3 py-2">
                  <span className="flex items-center gap-2">
                    <NotifTypeIcon type={t} />
                    <span className="font-medium text-[var(--text-strong)]">{NOTIF_TYPE_LABEL[t]}</span>
                  </span>
                </td>
                {DELIVERABLE_CHANNELS.map((c) => {
                  const r = cell(c, t);
                  return (
                    <td key={c} className="px-3 py-2">
                      <div className="flex flex-col items-center gap-1.5">
                        <Switch
                          checked={r.enabled}
                          onCheckedChange={(v) => setCell(c, t, { enabled: v })}
                          aria-label={`${NOTIF_TYPE_LABEL[t]} · ${CHANNEL_LABEL[c]}`}
                        />
                        {/* Частота имеет смысл только для канала «Дайджест» — на прочих
                            каналах селект был бы контролом без эффекта (Н8: честность). */}
                        {c === "digest" ? (
                          <select
                            value={r.digestFrequency}
                            disabled={!r.enabled}
                            onChange={(e) => setCell(c, t, { digestFrequency: e.target.value as DigestFrequency })}
                            className={selCls}
                            title="Частота дайджеста"
                          >
                            {DIGEST_FREQS.map((f) => (
                              <option key={f} value={f}>{DIGEST_LABEL[f]}</option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Честная плашка на случай, если канал временно снят из DELIVERABLE_CHANNELS
          (нет рабочего пути доставки). Сейчас все каналы доставляемы — плашка скрыта. */}
      {PENDING_CHANNELS.length > 0 ? (
        <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--muted)]">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--panel-strong)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-[var(--muted-strong)]">Канал не настроен</span>
          <span>
            {PENDING_CHANNELS.map((c) => CHANNEL_LABEL[c]).join(" и ")}: сервер пока не отправляет письма и дайджесты, поэтому настройки этих каналов скрыты. Они появятся, когда канал доставки будет подключён.
          </span>
        </div>
      ) : null}

      {/* Контракт-заметка (API-путь) — dev-подсказка, только в Storybook/демо. */}
      {prototypeNotesEnabled ? (
        <p className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">
          PUT /notification-preferences — upsert по ключу channel × тип: отправляются {DELIVERABLE_CHANNELS.length * NOTIF_TYPES.length} ячеек доступных каналов, сервер возвращает актуальный набор. Пустой набор → ранний выход (никаких изменений).
        </p>
      ) : null}
    </div>
  );
}
