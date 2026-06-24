"use client";

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
  Video
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { CommsFrame } from "@/communications/ui/comms-frame";
import { CallStatusChip, commsErr, relTime, userName } from "@/communications/lib/comms-bits";
import { useCallRoom, useCallRooms, type CallRoomDetail } from "@/communications/lib/use-comms";
import type {
  CallEventType,
  CallMediaKind,
  CallRoomProvider,
  VideoJoinContract
} from "@/communications/lib/comms-client";

/* ============================================================
   Поверхность «Звонки» блока «Коммуникации».
   Звонки реализованы ЧЕСТНО БЕЗ WebRTC: только метаданные комнаты,
   таймлайн событий и контракт join-token. Реального медиа-соединения
   нет — «Подключиться» лишь получает join-ссылку (demoAction).
   Демо-сущность: project / proj-portal.
   ============================================================ */

const DEMO_ENTITY = { entityType: "project" as const, entityId: "proj-portal" };

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
  recording_attached: <CircleDot className="size-3.5" aria-hidden />
};
const EVENT_LABEL: Record<CallEventType, string> = {
  room_created: "Комната создана",
  session_started: "Сессия начата",
  join_token_issued: "Выдан join-token",
  participant_invited: "Участник приглашён",
  participant_joining: "Участник подключается",
  participant_joined: "Участник вошёл",
  participant_left: "Участник вышел",
  session_ended: "Сессия завершена",
  recording_attached: "Прикреплена запись"
};

const selCls = "h-9 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel)] px-2.5 text-[length:var(--text-sm)] text-[var(--text)] outline-none focus:border-[var(--accent)]";
const labelCls = "flex flex-col gap-1 text-[length:var(--text-xs)] font-medium text-[var(--muted-strong)]";

export function CallsSurface() {
  const { data, status, error, reload, createRoom } = useCallRooms(DEMO_ENTITY.entityType, DEMO_ENTITY.entityId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const rooms = data?.callRooms ?? [];
  // Выбранная комната: явно выбранная → активная → первая.
  const activeRoomId = useMemo(() => {
    if (selectedId && rooms.some((r) => r.roomId === selectedId)) return selectedId;
    return rooms.find((r) => r.status === "active")?.roomId ?? rooms[0]?.roomId ?? null;
  }, [selectedId, rooms]);

  if (status === "loading" && !data) {
    return (
      <CommsFrame activeTab="Звонки">
        <div className="flex h-[420px] items-center justify-center gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)]">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Загрузка звонков…
        </div>
      </CommsFrame>
    );
  }
  if (status === "error" || !data) {
    return (
      <CommsFrame activeTab="Звонки">
        <div className="flex h-[420px] flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger-text)]">
          <span>Не удалось загрузить: {commsErr(undefined, error ?? "unknown")}</span>
          <Button variant="secondary" size="sm" onClick={() => void reload()}>Повторить</Button>
        </div>
      </CommsFrame>
    );
  }

  return (
    <CommsFrame
      activeTab="Звонки"
      subtitle="Комнаты звонков проекта · честно без WebRTC"
      actions={<CreateRoomDialog busy={busy} setBusy={setBusy} setNotice={setNotice} create={createRoom} onCreated={(id) => setSelectedId(id)} />}
    >
      {/* Честный баннер «Прототип» */}
      <div className="mb-3 flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--accent-muted)] bg-[var(--accent-soft)] px-3 py-1.5 text-[length:var(--text-xs)] text-[var(--muted-strong)]">
        <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">Прототип</span>
        <span>
          Реальный контракт: /api/workspace/call-rooms (комнаты, сессии, события, записи). Данные in-memory.
          Realtime-доставка появится в приложении; здесь обновление по действию (ре-фетч после мутации).
          Медиа честно без WebRTC: «Подключиться» лишь получает join-ссылку — реальное соединение Jitsi/LiveKit устанавливается только в проде.
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* СЛЕВА: список комнат */}
        <aside className="flex flex-col gap-2">
          {rooms.length === 0 ? (
            <div className="grid place-items-center rounded-[var(--radius-card)] border border-dashed border-[var(--border)] bg-[var(--panel-subtle)] px-3 py-8 text-center text-[length:var(--text-xs)] text-[var(--muted-soft)]">
              Комнат звонков пока нет. Создайте первую кнопкой «Комната».
            </div>
          ) : (
            rooms.map((r) => {
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
            })
          )}
        </aside>

        {/* СПРАВА: детальная комната */}
        <section className="min-w-0">
          {activeRoomId ? (
            <RoomDetail key={activeRoomId} roomId={activeRoomId} />
          ) : (
            <div className="grid h-[320px] place-items-center rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] text-[length:var(--text-sm)] text-[var(--muted-soft)]">
              Выберите комнату слева, чтобы открыть детали.
            </div>
          )}
        </section>
      </div>

      {notice ? <div className="mt-2 text-[length:var(--text-xs)] text-[var(--muted-strong)]">{notice}</div> : null}
    </CommsFrame>
  );
}

/* ============================================================
   Детальная комната: инфо + управление сессией + таймлайн + записи.
   ============================================================ */
function RoomDetail({ roomId }: { roomId: string }) {
  const { data, status, error, reload, startSession, joinToken, participantState, endSession } = useCallRoom(roomId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Честный inline-баннер с кодом ошибки (напр. video_provider_misconfigured).
  const [errCode, setErrCode] = useState<string | null>(null);
  const [join, setJoin] = useState<VideoJoinContract | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);

  if (status === "loading" && !data) {
    return (
      <div className="flex h-[320px] items-center justify-center gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--panel)] text-[var(--muted)]">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Загрузка комнаты…
      </div>
    );
  }
  if (status === "error" || !data) {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger-text)]">
        <span>Не удалось загрузить комнату: {commsErr(undefined, error ?? "unknown")}</span>
        <Button variant="secondary" size="sm" onClick={() => void reload()}>Повторить</Button>
      </div>
    );
  }

  const room = data.callRoom;
  // Активная сессия определяется по событиям: последнее session_started без последующего session_ended.
  const activeSessionId = resolveActiveSessionId(data);

  async function doStart() {
    setBusy(true); setNotice(null); setErrCode(null);
    const res = await startSession();
    setBusy(false);
    if (res.ok) setNotice("Сессия начата");
    else { setErrCode(res.code ?? null); setNotice(`Отклонено: ${commsErr(res.code, res.message)}`); }
  }

  // ЧЕСТНЫЙ demoAction: получить join-ссылку (реального WebRTC не устанавливаем).
  async function doJoin(sessionId: string) {
    setBusy(true); setNotice(null); setErrCode(null);
    const res = await joinToken(sessionId);
    setBusy(false);
    if (res.ok) { setJoin(res.data); setJoinOpen(true); }
    else { setErrCode(res.code ?? null); setNotice(`Отклонено: ${commsErr(res.code, res.message)}`); }
  }

  async function doParticipant(sessionId: string, state: "joined" | "left") {
    setBusy(true); setNotice(null); setErrCode(null);
    const res = await participantState(sessionId, { state });
    setBusy(false);
    if (res.ok) setNotice(state === "joined" ? "Отмечено: вы вошли" : "Отмечено: вы вышли");
    else { setErrCode(res.code ?? null); setNotice(`Отклонено: ${commsErr(res.code, res.message)}`); }
  }

  async function doEnd(sessionId: string) {
    setBusy(true); setNotice(null); setErrCode(null);
    const res = await endSession(sessionId);
    setBusy(false);
    if (res.ok) setNotice("Сессия завершена");
    else { setErrCode(res.code ?? null); setNotice(`Отклонено: ${commsErr(res.code, res.message)}`); }
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
            <span className="v4-mono">{room.roomId}</span> · создал {userName(room.createdByUserId)} · {relTime(room.createdAt)}
          </p>
        </div>
        <CallStatusChip status={room.status} />
        <Chip variant="violet">{PROVIDER_LABEL[room.provider]}</Chip>
        <Chip>{MEDIA_LABEL[room.mediaKind]}</Chip>
      </div>

      {/* Честный inline-баннер с кодом отказа (напр. video_provider_misconfigured) */}
      {errCode ? (
        <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--danger-text)]">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-[var(--danger)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-white">{errCode}</span>
          <span>
            {commsErr(errCode)}.
            {errCode === "video_provider_misconfigured"
              ? " Провайдер комнаты не совпадает с настроенным видеопровайдером деплоя (jitsi). join-token не выдан."
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
            {/* ЧЕСТНОЕ «Подключиться» — получить join-ссылку, не WebRTC */}
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void doJoin(activeSessionId)} title="Демо: получить join-ссылку (реальное WebRTC не устанавливается)">
              <LogIn className="size-3.5" aria-hidden /> Подключиться
            </Button>
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => void doParticipant(activeSessionId, "joined")}>
              <LogIn className="size-3.5" aria-hidden /> Я вошёл
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void doParticipant(activeSessionId, "left")}>
              <LogOut className="size-3.5" aria-hidden /> Я вышел
            </Button>
            <Button variant="destructive-soft" size="sm" disabled={busy} onClick={() => void doEnd(activeSessionId)}>
              <PhoneOff className="size-3.5" aria-hidden /> Завершить сессию
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void doStart()}>
              <Play className="size-3.5" aria-hidden /> Начать сессию
            </Button>
            <span className="text-[length:var(--text-xs)] text-[var(--muted-soft)]">Старт переведёт комнату в «Идёт» (повторный старт активной → 409 call_room_already_active).</span>
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
                    <span className="text-[10px] text-[var(--muted-soft)]">{relTime(ev.createdAt)}</span>
                  </div>
                  <p className="text-[length:var(--text-xs)] text-[var(--muted)]">
                    {userName(ev.actorUserId)}
                    {typeof ev.payload.userId === "string" && ev.payload.userId !== ev.actorUserId ? ` · участник ${userName(ev.payload.userId)}` : ""}
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
          <p className="py-2 text-[length:var(--text-xs)] text-[var(--muted-soft)]">Записей нет. В проде запись прикрепляется метаданной (POST /recordings) после загрузки вложения.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {data.recordings.map((rec) => (
              <li key={rec.id} className="flex items-center gap-2 text-[length:var(--text-xs)] text-[var(--text)]">
                <CircleDot className="size-3.5 text-[var(--accent-text)]" aria-hidden />
                <span className="font-medium">{rec.title}</span>
                <span className="v4-mono text-[10px] text-[var(--muted-soft)]">{rec.attachmentId}</span>
                <span className="ml-auto text-[10px] text-[var(--muted-soft)]">{relTime(rec.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {notice ? <div className="text-[length:var(--text-xs)] text-[var(--muted-strong)]">{notice}</div> : null}

      {/* Диалог join-ссылки с честной плашкой */}
      <JoinDialog open={joinOpen} onOpenChange={setJoinOpen} join={join} />
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
   Диалог join-ссылки: честная плашка про отсутствие WebRTC.
   ============================================================ */
function JoinDialog({ open, onOpenChange, join }: { open: boolean; onOpenChange: (v: boolean) => void; join: VideoJoinContract | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader><DialogTitle>Контракт подключения</DialogTitle></DialogHeader>
        {join ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--panel-subtle)] p-3 text-[length:var(--text-xs)]">
              <div className="flex items-center gap-2"><span className="w-20 text-[var(--muted-soft)]">Провайдер</span><Chip variant="violet">{PROVIDER_LABEL[join.provider]}</Chip></div>
              <div className="flex items-start gap-2"><span className="w-20 shrink-0 text-[var(--muted-soft)]">join-ссылка</span><span className="v4-mono break-all text-[var(--text)]">{join.joinUrl}</span></div>
              <div className="flex items-center gap-2"><span className="w-20 text-[var(--muted-soft)]">token</span><span className="text-[var(--text)]">{join.token ? "выдан (JWT)" : "не требуется (null)"}</span></div>
              {join.expiresAt ? <div className="flex items-center gap-2"><span className="w-20 text-[var(--muted-soft)]">истекает</span><span className="text-[var(--text)]">{new Date(join.expiresAt).toLocaleString("ru-RU")}</span></div> : null}
            </div>
            {/* Честная плашка */}
            <div className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--warning)] bg-[var(--warning-soft)] px-3 py-2 text-[length:var(--text-xs)] text-[var(--warning-text)]">
              <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>Демо: реальное WebRTC-соединение не устанавливается. В проде по этой ссылке откроется Jitsi/LiveKit.</span>
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
function CreateRoomDialog({ busy, setBusy, setNotice, create, onCreated }: {
  busy: boolean;
  setBusy: (v: boolean) => void;
  setNotice: (v: string | null) => void;
  create: ReturnType<typeof useCallRooms>["createRoom"];
  onCreated: (roomId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [mediaKind, setMediaKind] = useState<CallMediaKind>("video");
  const [provider, setProvider] = useState<CallRoomProvider>("jitsi");
  const [providerRoomId, setProviderRoomId] = useState("");

  const valid = title.trim().length > 0;

  const submit = async () => {
    if (!valid) return;
    setBusy(true); setNotice(null);
    const trimmedRoomId = providerRoomId.trim();
    const res = await create({
      entityType: DEMO_ENTITY.entityType,
      entityId: DEMO_ENTITY.entityId,
      title: title.trim(),
      provider,
      mediaKind,
      // providerRoomId опционален: передаём только при заполнении (exactOptionalPropertyTypes).
      ...(trimmedRoomId ? { providerRoomId: trimmedRoomId } : {})
    });
    setBusy(false);
    if (res.ok) {
      setNotice("Комната создана");
      setOpen(false);
      setTitle(""); setProviderRoomId("");
    } else {
      setNotice(`Отклонено: ${commsErr(res.code, res.message)}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="default" size="sm"><Plus className="size-3.5" aria-hidden />Комната</Button></DialogTrigger>
      <DialogContent className="max-w-[480px]">
        <DialogHeader><DialogTitle>Новая комната звонка</DialogTitle></DialogHeader>
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
          <label className={`col-span-2 ${labelCls}`}>ID комнаты провайдера (опц.)<Input value={providerRoomId} onChange={(e) => setProviderRoomId(e.target.value)} placeholder="portal-sync (уникален в тенанте)" /></label>
        </div>
        <p className="text-[10px] text-[var(--muted-soft)]">
          POST /call-rooms — статус принудительно «Открыт». ID комнаты провайдера уникален (409 call_room_provider_room_conflict).
          join-token выдаётся только при совпадении провайдера с настроенным деплоем (jitsi); иначе 409 video_provider_misconfigured.
        </p>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
          <Button variant="default" disabled={!valid || busy} onClick={() => void submit()}><Plus className="size-3.5" aria-hidden />Создать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
