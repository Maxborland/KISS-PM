"use client";

import { useEffect, useState } from "react";

import { BannerInline } from "@/components/ui/banner-inline";
import { Button } from "@/components/ui/button";
import { fetchCallRoomEntity } from "@/lib/call/call-client";
import { useCallEngine } from "@/lib/call/call-engine";
import { useLobbyPreview } from "@/lib/call/use-lobby-preview";
import type { LobbySelection } from "@/lib/call/types";
import { CallLobby, CallStage } from "@/widgets/call";
import { ConversationView, MessageComposer } from "@/widgets/chat";

// Live container. Two steps: a pre-join lobby (device selection + preview), then
// the active call. Both render the SAME pure widgets the Storybook twins use.
export function CallRuntimeView({ roomId }: { roomId: string }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [selection, setSelection] = useState<LobbySelection | null>(null);

  // Verify access to the room BEFORE the lobby mounts — otherwise useLobbyPreview turns the
  // camera on (createLocalVideoTrack) for a room the user cannot join. Fail closed.
  useEffect(() => {
    let active = true;
    void fetchCallRoomEntity(roomId).then((entity) => {
      if (active) setAuthorized(entity !== null);
    });
    return () => {
      active = false;
    };
  }, [roomId]);

  if (authorized === null) {
    return (
      <div className="call-screen">
        <BannerInline variant="info">Проверка доступа к звонку…</BannerInline>
      </div>
    );
  }
  if (!authorized) {
    return (
      <div className="call-screen">
        <BannerInline variant="danger">Нет доступа к этому звонку</BannerInline>
      </div>
    );
  }
  if (!selection) {
    return <LobbyStep onJoin={setSelection} />;
  }
  return <ActiveStep roomId={roomId} selection={selection} />;
}

function LobbyStep({ onJoin }: { onJoin: (selection: LobbySelection) => void }) {
  const lobby = useLobbyPreview();
  return (
    <CallLobby
      cameras={lobby.cameras}
      microphones={lobby.microphones}
      selection={lobby.selection}
      permissionError={lobby.permissionError}
      attachPreview={lobby.attachPreview}
      onCamera={lobby.setCamera}
      onMicrophone={lobby.setMicrophone}
      onToggleCamera={lobby.toggleCamera}
      onToggleMicrophone={lobby.toggleMicrophone}
      onJoin={() => onJoin(lobby.selection)}
    />
  );
}

// RU-тексты известных причин отказа подключения. Прочие коды показываем как есть
// (сырой код лучше, чем ложный generic, — его можно назвать поддержке).
const JOIN_ERROR_RU: Record<string, { title: string; hint: string }> = {
  video_provider_disabled: {
    title: "Видеозвонки не настроены в этой инсталляции",
    hint: "Администратору нужно подключить медиасервер (KISS_PM_VIDEO_PROVIDER). Метаданные звонков и их история доступны в разделе «Коммуникации»."
  },
  call_session_not_found: {
    title: "Сессия звонка не найдена",
    hint: "Звонок мог завершиться. Проверьте список звонков."
  }
};

function ActiveStep({ roomId, selection }: { roomId: string; selection: LobbySelection }) {
  const { stage, controls, handlers, error, externalJoin, chat, sendChat } = useCallEngine(roomId, selection);

  if (externalJoin) {
    const providerLabel = externalJoin.provider === "jitsi" ? "Jitsi" : "провайдера";
    return (
      <div className="call-screen">
        <div className="mx-auto mt-[10vh] flex w-full max-w-[520px] flex-col gap-3">
          <BannerInline variant="info">Звонок готов к открытию в {providerLabel}</BannerInline>
          <Button asChild variant="primary">
            <a href={externalJoin.joinUrl}>Открыть звонок</a>
          </Button>
          <a href="/communications/calls" className="text-[length:var(--text-sm)] text-[var(--accent-text,var(--accent))] underline underline-offset-4">← К списку звонков</a>
        </div>
      </div>
    );
  }

  // Подключение не удалось — честный отказ вместо мёртвой сцены с чатом,
  // имитирующим отправку (G5-04/05), и с рабочим путём назад (G5-06).
  if (error) {
    const known = JOIN_ERROR_RU[error];
    return (
      <div className="call-screen">
        <div className="mx-auto mt-[10vh] flex w-full max-w-[520px] flex-col gap-3">
          <BannerInline variant="danger">{known?.title ?? `Не удалось подключиться к звонку (${error})`}</BannerInline>
          {known?.hint ? <p className="m-0 text-[length:var(--text-sm)] text-[var(--muted-strong)]">{known.hint}</p> : null}
          <a href="/communications/calls" className="text-[length:var(--text-sm)] text-[var(--accent-text,var(--accent))] underline underline-offset-4">← К списку звонков</a>
        </div>
      </div>
    );
  }

  return (
    <div className="call-screen">
      <div className="call-inchat">
        <div className="call-inchat__stage">
          <CallStage view={stage} controls={controls} handlers={handlers} />
        </div>
        <aside className="call-inchat__panel">
          <ConversationView
            view={{ title: "Чат звонка", subtitle: "Сообщения во время встречи", messages: chat }}
          />
          <MessageComposer onSend={sendChat} showExtras={false} />
        </aside>
      </div>
    </div>
  );
}
