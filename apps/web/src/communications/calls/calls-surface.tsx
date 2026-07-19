"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  CircleDot,
  Link2,
  Loader2,
  LogIn,
  LogOut,
  PhoneCall,
  PhoneOff,
  Play,
  Plus,
  Radio,
  Sparkles,
  UserPlus,
  Video,
  VideoOff
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormDialog } from "@/components/domain/form-dialog";
import { Input } from "@/components/ui/input";
import { SurfaceState, surfaceStatusOf } from "@/components/domain/surface-state";
import { cn } from "@/lib/cn";
import { CommsFrame } from "@/communications/ui/comms-frame";
import { prototypeNotesEnabled } from "@/views/lib/prototype-gate";
import { CallStatusChip, commsErr, relTime } from "@/communications/lib/comms-bits";
import { useCallRoom, useCallRooms, useCommsUsers, type CallRoomDetail, type CommsUsersDir } from "@/communications/lib/use-comms";
import { WithCommsEntityScope, type ResolvedCommsScope } from "@/communications/lib/entity-scope";
import type {
  CallEventType,
  CallMediaKind,
  CallRoomProvider,
  EntityType,
  VideoJoinContract
} from "@/communications/lib/comms-client";

/* ============================================================
   Поверхность «Звонки» блока «Коммуникации».
   Метаданные комнаты, таймлайн событий и управление сессией.
   Живое медиа-соединение — во внутренней комнате /calls/{roomId}
   (кнопка «Открыть комнату»); рантайм комнаты сам получает
   join-токен по roomId через API. Сырой контракт join-ссылки —
   dev-диалог только под prototypeNotesEnabled.
   Scope: реальный проект воркспейса (WithCommsEntityScope).
   ============================================================ */

/* Провайдеры/тип медиа — RU-подписи. */
const PROVIDER_LABEL: Record<CallRoomProvider, string> = { manual: "Ручной", jitsi: "Jitsi", livekit: "LiveKit" };
const MEDIA_LABEL: Record<CallMediaKind, string> = { audio: "Аудио", video: "Видео" };

/* Иконки таймлайна событий по eventType. */
const EVENT_ICON: Record<CallEventType, ReactNode> = {
  room_created: <PhoneCall className="size-3.5" aria-hidden />,
  session_started: <Play className="size-3.5" aria-hidden />,
  join_token_issued: <Link2 className="size-3.5" aria-hidden />,
  participant_invited: <UserPlus className="size-3.5" aria-hidden />,
  participant_joining: <Loader2 className="size-3.5" aria-hidden />,
  participant_joined: <LogIn className="size-3.5" aria-hidden />,
  participant_left: <LogOut className="size-3.5" aria-hidden />,
  session_ended: <PhoneOff className="size-3.5" aria-hidden />,
  recording_attached: <CircleDot className="size-3.5" aria-hidden />,
  recording_started: <CircleDot className="size-3.5" aria-hidden />,
  recording_track_completed: <CircleDot className="size-3.5" aria-hidden />,
  recording_completed: <CircleDot className="size-3.5" aria-hidden />,
  recording_failed: <PhoneOff className="size-3.5" aria-hidden />
};
const EVENT_LABEL: Record<CallEventType, string> = {
  room_created: "Комната создана",
  session_started: "Сессия начата",
  join_token_issued: "Выдана ссылка для подключения",
  participant_invited: "Участник приглашён",
  participant_joining: "Участник подключается",
  participant_joined: "Участник вошёл",
  participant_left: "Участник вышел",
  session_ended: "Сессия завершена",
  recording_attached: "Прикреплена запись",
  recording_started: "Запись начата",
  recording_track_completed: "Дорожка записи готова",
  recording_completed: "Запись завершена",
  recording_failed: "Ошибка записи"
};

const selCls = "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)]";
const labelCls = "flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]";

// Scope сущности резолвится из реальных проектов воркспейса (WithCommsEntityScope);
// явные entityType/entityId пропсы (встраивание, тесты) отключают резолв.
export function CallsSurface({ entityType, entityId }: { entityType?: EntityType; entityId?: string } = {}) {
  return (
    <WithCommsEntityScope activeTab="Звонки" {...(entityType ? { explicitEntityType: entityType } : {})} {...(entityId ? { explicitEntityId: entityId } : {})}>
      {(scope) => <CallsSurfaceScoped scope={scope} />}
    </WithCommsEntityScope>
  );
}

function CallsSurfaceScoped({ scope }: { scope: ResolvedCommsScope }) {
  const { entityType, entityId } = scope;
  const { data, status, error, reload, createRoom } = useCallRooms(entityType, entityId);
  // Справочник людей тенанта (имена создателей/участников событий): mock=COMMS_USERS, live=GET /api/workspace/users.
  const users = useCommsUsers();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const rooms = data?.callRooms ?? [];
  // Выбранная комната: явно выбранная → активная → первая.
  const activeRoomId = useMemo(() => {
    if (selectedId && rooms.some((r) => r.roomId === selectedId)) return selectedId;
    return rooms.find((r) => r.status === "active")?.roomId ?? rooms[0]?.roomId ?? null;
  }, [selectedId, rooms]);

  // Верхнеуровневый статус поверхности: forbidden (403) / error / loading / empty (нет комнат).
  // Кнопку создания сохраняем и в шапке, и в empty-action — пустое состояние остаётся рабочим.
  if (status === "forbidden" || status === "error" || !data || rooms.length === 0) {
    const createAction = (
      <CreateRoomDialog busy={busy} setBusy={setBusy} create={createRoom} onCreated={(id) => setSelectedId(id)} entityType={entityType} entityId={entityId} />
    );
    return (
      <CommsFrame activeTab="Звонки" subtitle={`Звонки · ${scope.title}`} actions={data && rooms.length === 0 ? <>{scope.picker}{createAction}</> : scope.picker ?? undefined}>
        <SurfaceState
          status={
            status === "forbidden"
              ? "forbidden"
              : status === "error"
                ? "error"
                : !data
                  ? "loading"
                  : "empty"
          }
          error={error}
          onRetry={() => void reload()}
          errorFormat={commsErr}
          loadingLabel="Загрузка звонков…"
          forbidden={{ title: "Нет доступа к звонкам", description: "У вас нет прав на просмотр звонков этой сущности." }}
          empty={{ title: "Нет комнат звонков", description: "Создайте первую комнату кнопкой «Комната».", action: createAction }}
        >
          <span />
        </SurfaceState>
      </CommsFrame>
    );
  }

  return (
    <CommsFrame
      activeTab="Звонки"
      subtitle={`Звонки · ${scope.title}`}
      actions={<>{scope.picker}<CreateRoomDialog busy={busy} setBusy={setBusy} create={createRoom} onCreated={(id) => setSelectedId(id)} entityType={entityType} entityId={entityId} /></>}
    >
      {/* Честный баннер «Прототип» — только в Storybook/демо (prototypeNotesEnabled). */}
      {prototypeNotesEnabled ? (
        <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
          <span>
            Реальный контракт: /api/workspace/call-rooms (комнаты, сессии, события, записи). Данные in-memory.
            Realtime-доставка появится в приложении; здесь обновление по действию (ре-фетч после мутации).
            «Открыть комнату» ведёт в живую комнату звонка /calls/{"{roomId}"} (LiveKit); сырой контракт join-ссылки — в dev-кнопке «Данные подключения».
          </span>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* СЛЕВА: список комнат (rooms непуст — пустой список разведён в top-level SurfaceState empty) */}
        <aside className="flex flex-col gap-2">
          {rooms.map((r) => {
              const selected = r.roomId === activeRoomId;
              return (
                <button
                  key={r.roomId}
                  type="button"
                  onClick={() => setSelectedId(r.roomId)}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-[var(--radius-card)] border bg-[var(--panel)] p-3 text-left shadow-[var(--shadow-card)] transition-colors",
                    selected ? "border-[var(--accent)] ring-1 ring-[var(--accent-muted)]" : "border-[var(--border)] hover:border-[var(--accent-muted)]"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {r.mediaKind === "video" ? <Video className="size-3.5 shrink-0 text-[var(--muted)]" aria-hidden /> : <Radio className="size-3.5 shrink-0 text-[var(--muted)]" aria-hidden />}
                      <span className="truncate text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">{r.title}</span>
                    </span>
                    <CallStatusChip status={r.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[length:var(--text-xs)] text-[var(--muted)]">
                    <Chip variant="violet">{PROVIDER_LABEL[r.provider]}</Chip>
                    <Chip>{MEDIA_LABEL[r.mediaKind]}</Chip>
                  </div>
                </button>
              );
            })}
        </aside>

        {/* СПРАВА: детальная комната */}
        <section className="min-w-0">
          {activeRoomId ? (
            <RoomDetail key={activeRoomId} roomId={activeRoomId} users={users} />
          ) : (
            <div className="grid h-[320px] place-items-center rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] text-[length:var(--text-sm)] text-[var(--muted-soft)]">
              Выберите комнату слева, чтобы открыть детали.
            </div>
          )}
        </section>
      </div>
    </CommsFrame>
  );
}

/* ============================================================
   Детальная комната: инфо + управление сессией + таймлайн + записи.
   ============================================================ */
function RoomDetail({ roomId, users }: { roomId: string; users: CommsUsersDir }) {
  const { data, status, error, reload, startSession, joinToken, participantState, endSession } = useCallRoom(roomId);
  const [busy, setBusy] = useState(false);
  // Честный inline-баннер с кодом ошибки (напр. video_provider_misconfigured).
  const [errCode, setErrCode] = useState<string | null>(null);
  const [join, setJoin] = useState<VideoJoinContract | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);

  // Верхнеуровневое состояние детальной комнаты: forbidden (403) / error / loading — общий surfaceStatusOf.
  // Доп. проверка !data в if дублирует hasData только ради TS-narrowing (тело ниже дереференсит data).
  const surfaceStatus = surfaceStatusOf(status, Boolean(data));
  if (surfaceStatus !== "ready" || !data) {
    return (
      <SurfaceState
        status={surfaceStatus}
        error={error}
        onRetry={() => void reload()}
        errorFormat={commsErr}
        errorTitle="Не удалось загрузить комнату"
        loadingLabel="Загрузка комнаты…"
        height="320px"
        forbidden={{ title: "Нет доступа к комнате", description: "У вас нет прав на просмотр этого звонка." }}
      >
        <span />
      </SurfaceState>
    );
  }

  const room = data.callRoom;
  // Активная сессия определяется по событиям: последнее session_started без последующего session_ended.
  const activeSessionId = resolveActiveSessionId(data);
  // Честный capability-гейт (Н10): KISS_PM_VIDEO_PROVIDER=disabled ⇒ подключение к звонку
  // невозможно — вместо кнопок старта/подключения показываем плашку. Гейт НЕ касается
  // manual-комнат: их путь не зависит от глобального видео-провайдера (лобби/ручной
  // сценарий работают и при disabled). null capabilities — «неизвестно», не гейтим.
  const providerDisabled = room.provider !== "manual" && data.capabilities?.videoProviderKind === "disabled";
  const providerDisabledNote = (
    <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--warning)] bg-[var(--warning-soft)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--warning-text)]">
      <VideoOff className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        Видео-провайдер не настроен (KISS_PM_VIDEO_PROVIDER) — подключение к звонку недоступно.
        История, события и записи звонка остаются доступны.
      </span>
    </div>
  );

  async function doStart() {
    setBusy(true); setErrCode(null);
    const res = await startSession();
    setBusy(false);
    if (res.ok) toast.success("Сессия начата");
    else { setErrCode(res.code ?? null); toast.error(`Отклонено: ${commsErr(res.code, res.message)}`); }
  }

  // Dev-инспекция контракта join-ссылки (только под prototypeNotesEnabled):
  // получает VideoJoinContract и показывает его в диалоге. Живой путь подключения —
  // кнопка «Открыть комнату» (внутренний роут /calls/{roomId}).
  async function doJoin(sessionId: string) {
    setBusy(true); setErrCode(null);
    const res = await joinToken(sessionId);
    setBusy(false);
    if (res.ok) { setJoin(res.data); setJoinOpen(true); }
    else { setErrCode(res.code ?? null); toast.error(`Отклонено: ${commsErr(res.code, res.message)}`); }
  }

  async function doParticipant(sessionId: string, state: "joined" | "left") {
    setBusy(true); setErrCode(null);
    const res = await participantState(sessionId, { state });
    setBusy(false);
    if (res.ok) toast.success(state === "joined" ? "Отмечено: вы вошли" : "Отмечено: вы вышли");
    else { setErrCode(res.code ?? null); toast.error(`Отклонено: ${commsErr(res.code, res.message)}`); }
  }

  async function doEnd(sessionId: string) {
    setBusy(true); setErrCode(null);
    const res = await endSession(sessionId);
    setBusy(false);
    if (res.ok) toast.success("Сессия завершена");
    else { setErrCode(res.code ?? null); toast.error(`Отклонено: ${commsErr(res.code, res.message)}`); }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Инфо комнаты */}
      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] px-4 py-3 shadow-[var(--shadow-card)]">
        <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)] bg-[var(--panel-strong)] text-[var(--muted-strong)]">
          {room.mediaKind === "video" ? <Video className="size-4" aria-hidden /> : <Radio className="size-4" aria-hidden />}
        </span>
        <div className="mr-auto min-w-0">
          <h2 className="truncate text-[length:var(--text-lg)] font-bold text-[var(--text-strong)]">{room.title}</h2>
          <p className="truncate text-[length:var(--text-xs)] text-[var(--muted)]">
            {/* Технический id комнаты — dev-подсказка, только в Storybook/демо (G5-11). */}
            {prototypeNotesEnabled ? <><span className="v4-mono">{room.roomId}</span> · </> : null}
            создал {users.name(room.createdByUserId)} · {relTime(room.createdAt)}
          </p>
        </div>
        <CallStatusChip status={room.status} />
        <Chip variant="violet">{PROVIDER_LABEL[room.provider]}</Chip>
        <Chip>{MEDIA_LABEL[room.mediaKind]}</Chip>
      </div>

      {/* Честный inline-баннер с кодом отказа (напр. video_provider_misconfigured) */}
      {errCode ? (
        <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--danger-text)]">
          {/* Сырой код ошибки — dev-подсказка, только в Storybook/демо; человеческое описание рядом. */}
          {prototypeNotesEnabled ? (
            <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--danger)] px-1.5 py-0.5 text-[length:var(--text-2xs)] font-semibold uppercase tracking-[0.04em] text-white">{errCode}</span>
          ) : null}
          <span>
            {commsErr(errCode)}.
            {errCode === "video_provider_misconfigured"
              ? " Провайдер комнаты не совпадает с настроенным видеопровайдером — ссылка для подключения не выдана."
              : " Сервер отклонил действие."}
          </span>
        </div>
      ) : null}

      {/* Управление сессией */}
      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
        <h3 className="mb-2.5 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Управление сессией</h3>
        {room.status === "ended" ? (
          <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
            <PhoneOff className="size-4 text-[var(--muted-soft)]" aria-hidden /> Звонок завершён — сессии закрыты.
          </div>
        ) : room.status === "active" && activeSessionId ? (
          <div className="flex flex-wrap items-center gap-2">
            {/* Живой путь: внутренняя комната звонка. Рантайм /calls/{roomId} сам получает
                join-токен по roomId через API — токен через URL не передаём.
                При disabled-провайдере кнопка подключения заменяется честной плашкой (Н10):
                join-token в таком деплое всегда 501 video_provider_disabled. */}
            {providerDisabled ? (
              <div className="w-full">{providerDisabledNote}</div>
            ) : (
              <Button asChild variant="primary" size="sm" title="Открыть комнату звонка">
                <Link href={`/calls/${encodeURIComponent(roomId)}`}>
                  <Video className="size-3.5" aria-hidden /> Открыть комнату
                </Link>
              </Button>
            )}
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void doParticipant(activeSessionId, "joined")}>
              <LogIn className="size-3.5" aria-hidden /> Я вошёл
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void doParticipant(activeSessionId, "left")}>
              <LogOut className="size-3.5" aria-hidden /> Я вышел
            </Button>
            <Button variant="destructive-soft" size="sm" disabled={busy} onClick={() => void doEnd(activeSessionId)}>
              <PhoneOff className="size-3.5" aria-hidden /> Завершить сессию
            </Button>
            {/* Сырой контракт join-ссылки — dev-подсказка, только в Storybook/демо. */}
            {prototypeNotesEnabled ? (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void doJoin(activeSessionId)} title="Показать сырые данные подключения (демо)">
                <Link2 className="size-3.5" aria-hidden /> Данные подключения
              </Button>
            ) : null}
          </div>
        ) : providerDisabled ? (
          /* Н10: старт сессии без настроенного видеопровайдера — тупик (подключиться будет
             невозможно), поэтому кнопку не рисуем, а честно объясняем причину. */
          providerDisabledNote
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void doStart()}>
              <Play className="size-3.5" aria-hidden /> Начать сессию
            </Button>
            <span className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Старт переведёт комнату в «Идёт»; повторный старт уже активного звонка будет отклонён.</span>
          </div>
        )}
      </section>

      {/* Таймлайн событий */}
      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
        <h3 className="mb-2.5 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Лента событий</h3>
        {data.events.length === 0 ? (
          <p className="py-3 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Событий пока нет.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {data.events.map((ev) => (
              <li key={ev.id} className="flex gap-2.5">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[var(--panel-strong)] text-[var(--muted-strong)]">{EVENT_ICON[ev.eventType]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-[length:var(--text-xs)] font-semibold text-[var(--text-strong)]">{EVENT_LABEL[ev.eventType]}</strong>
                    <span className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{relTime(ev.createdAt)}</span>
                  </div>
                  <p className="text-[length:var(--text-xs)] text-[var(--muted)]">
                    {users.name(ev.actorUserId)}
                    {typeof ev.payload.userId === "string" && ev.payload.userId !== ev.actorUserId ? ` · участник ${users.name(ev.payload.userId)}` : ""}
                    {typeof ev.payload.provider === "string" ? ` · ${PROVIDER_LABEL[ev.payload.provider as CallRoomProvider] ?? ev.payload.provider}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Записи */}
      <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow-card)]">
        <h3 className="mb-2.5 text-[length:var(--text-sm)] font-semibold text-[var(--text-strong)]">Записи</h3>
        {data.recordings.length === 0 ? (
          <p className="py-2 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Записей нет. Запись прикрепляется к звонку после загрузки вложения.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {data.recordings.map((rec) => (
              <li key={rec.id} className="flex items-center gap-2 text-[length:var(--text-xs)] text-[var(--text)]">
                <CircleDot className="size-3.5 text-[var(--accent-text)]" aria-hidden />
                <span className="font-medium">{rec.title}</span>
                {/* Сырой id вложения — dev-подсказка, только в Storybook/демо (рядом есть название записи). */}
                {prototypeNotesEnabled ? <span className="v4-mono text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{rec.attachmentId}</span> : null}
                <span className="ml-auto text-[length:var(--text-2xs)] text-[var(--muted-soft)]">{relTime(rec.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Диалог сырой join-ссылки — достижим только через dev-кнопку под prototypeNotesEnabled. */}
      {prototypeNotesEnabled ? <JoinDialog open={joinOpen} onOpenChange={setJoinOpen} join={join} /> : null}
    </div>
  );
}

/* Активная сессия по таймлайну: последний session_started без последующего session_ended той же сессии. */
function resolveActiveSessionId(data: CallRoomDetail): string | null {
  if (data.callRoom.status !== "active") return null;
  // events отсортированы по убыванию времени (свежие первыми).
  const endedSessionIds = new Set(data.events.filter((e) => e.eventType === "session_ended" && e.sessionId).map((e) => e.sessionId as string));
  const started = data.events.find((e) => e.eventType === "session_started" && e.sessionId && !endedSessionIds.has(e.sessionId));
  return started?.sessionId ?? null;
}

/* ============================================================
   Dev-диалог сырого контракта join-ссылки (только prototypeNotesEnabled).
   Живой путь подключения — «Открыть комнату» → /calls/{roomId}.
   ============================================================ */
function JoinDialog({ open, onOpenChange, join }: { open: boolean; onOpenChange: (v: boolean) => void; join: VideoJoinContract | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader><DialogTitle>Данные для подключения</DialogTitle></DialogHeader>
        {join ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] p-3 text-[length:var(--text-xs)]">
              <div className="flex items-center gap-2"><span className="w-20 text-[var(--muted-soft)]">Провайдер</span><Chip variant="violet">{PROVIDER_LABEL[join.provider]}</Chip></div>
              <div className="flex items-start gap-2"><span className="w-20 shrink-0 text-[var(--muted-soft)]">Ссылка</span><span className="v4-mono break-all text-[var(--text)]">{join.joinUrl}</span></div>
              <div className="flex items-center gap-2"><span className="w-20 text-[var(--muted-soft)]">Токен</span><span className="text-[var(--text)]">{join.token ? "выдан" : "не требуется"}</span></div>
              {join.expiresAt ? <div className="flex items-center gap-2"><span className="w-20 text-[var(--muted-soft)]">Истекает</span><span className="text-[var(--text)]">{new Date(join.expiresAt).toLocaleString("ru-RU")}</span></div> : null}
            </div>
            {/* Честная плашка: это dev-инспекция контракта, живой путь — «Открыть комнату». */}
            <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--warning)] bg-[var(--warning-soft)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--warning-text)]">
              <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>Dev-инспекция контракта join-ссылки. Для реального подключения используйте кнопку «Открыть комнату».</span>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Закрыть</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   Диалог создания комнаты: title / mediaKind / provider (+ опц.).
   ============================================================ */
function CreateRoomDialog({ busy, setBusy, create, onCreated, entityType, entityId }: {
  busy: boolean;
  setBusy: (v: boolean) => void;
  create: ReturnType<typeof useCallRooms>["createRoom"];
  onCreated: (roomId: string) => void;
  entityType: EntityType;
  entityId: string;
}) {
  const [title, setTitle] = useState("");
  const [mediaKind, setMediaKind] = useState<CallMediaKind>("video");
  const [provider, setProvider] = useState<CallRoomProvider>("jitsi");
  const [providerRoomId, setProviderRoomId] = useState("");

  const valid = title.trim().length > 0;

  return (
    <FormDialog
      title="Новая комната звонка"
      trigger={<Button variant="default" size="sm"><Plus className="size-3.5" aria-hidden />Комната</Button>}
      submitLabel={<><Plus className="size-3.5" aria-hidden />Создать</>}
      submitDisabled={!valid || busy}
      successToast="Комната создана"
      contentClassName="max-w-[480px]"
      // Ошибка остаётся В модалке — по месту действия.
      onSubmit={async () => {
        if (!valid) return null;
        setBusy(true);
        const trimmedRoomId = providerRoomId.trim();
        const res = await create({
          entityType,
          entityId,
          title: title.trim(),
          provider,
          mediaKind,
          // providerRoomId опционален: передаём только при заполнении (exactOptionalPropertyTypes).
          ...(trimmedRoomId ? { providerRoomId: trimmedRoomId } : {})
        });
        setBusy(false);
        return res.ok ? null : `Отклонено: ${commsErr(res.code, res.message)}`;
      }}
      onSuccess={() => { setTitle(""); setProviderRoomId(""); }}
    >
      <div className="grid grid-cols-2 gap-3">
        <label className={`col-span-2 ${labelCls}`}>Название<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Синхронизация команды" /></label>
        <label className={labelCls}>Тип медиа
          <select value={mediaKind} onChange={(e) => setMediaKind(e.target.value as CallMediaKind)} className={selCls}>
            <option value="video">Видео</option>
            <option value="audio">Аудио</option>
          </select>
        </label>
        <label className={labelCls}>Провайдер
          <select value={provider} onChange={(e) => setProvider(e.target.value as CallRoomProvider)} className={selCls}>
            <option value="jitsi">Jitsi</option>
            <option value="manual">Ручной</option>
            <option value="livekit">LiveKit</option>
          </select>
        </label>
        <label className={`col-span-2 ${labelCls}`}>ID комнаты провайдера (опц.)<Input value={providerRoomId} onChange={(e) => setProviderRoomId(e.target.value)} placeholder="portal-sync" /></label>
      </div>
      <p className="text-[length:var(--text-2xs)] text-[var(--muted-soft)]">
        Новая комната создаётся в статусе «Открыт». ID комнаты провайдера должен быть уникальным.
        Ссылка для подключения выдаётся, только если провайдер комнаты совпадает с настроенным видеопровайдером.
      </p>
    </FormDialog>
  );
}
