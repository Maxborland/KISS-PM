"use client";

import { useEffect, useState } from "react";

import { BannerInline } from "@/components/ui/banner-inline";
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

function ActiveStep({ roomId, selection }: { roomId: string; selection: LobbySelection }) {
  const { stage, controls, handlers, error, chat, sendChat } = useCallEngine(roomId, selection);

  return (
    <div className="call-screen">
      {error ? (
        <BannerInline variant="danger">Не удалось подключиться к звонку</BannerInline>
      ) : null}
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
