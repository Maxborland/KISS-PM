"use client";

import {
  ConnectionQuality,
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type Participant
} from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MessageView } from "@/components/domain/message-bubble";
import { fetchJoinToken, startCallSession } from "@/lib/call/call-client";
import type {
  CallControlHandlers,
  CallLocalControls,
  CallPhase,
  CallStageView,
  LobbySelection,
  ParticipantTileView,
  QualityLevel
} from "@/lib/call/types";

// The ONLY module that imports `livekit-client`. It maps the imperative Room state
// into the serialisable view-model the pure widgets render. The route loads this
// via next/dynamic({ ssr: false }) so the SDK never reaches SSR or Storybook.

const CHAT_TOPIC = "kiss-pm.call.chat";

const TILE_COLORS: ParticipantTileView["color"][] = ["c1", "c2", "c3", "c4", "c5"];

function colorFor(id: string): ParticipantTileView["color"] {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return TILE_COLORS[hash % TILE_COLORS.length] ?? "c1";
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function phaseFromConnectionState(state: ConnectionState): CallPhase {
  switch (state) {
    case ConnectionState.Connecting:
      return "connecting";
    case ConnectionState.Connected:
      return "connected";
    case ConnectionState.Reconnecting:
      return "reconnecting";
    case ConnectionState.Disconnected:
      return "disconnected";
    default:
      return "idle";
  }
}

function qualityFrom(quality: ConnectionQuality): QualityLevel {
  switch (quality) {
    case ConnectionQuality.Excellent:
      return "excellent";
    case ConnectionQuality.Good:
      return "good";
    case ConnectionQuality.Poor:
      return "poor";
    case ConnectionQuality.Lost:
      return "lost";
    default:
      return "unknown";
  }
}

function tileFor(participant: Participant, self: boolean, speakingIds: Set<string>): ParticipantTileView {
  const cameraPublication = participant.getTrackPublication(Track.Source.Camera);
  const microphonePublication = participant.getTrackPublication(Track.Source.Microphone);
  const screenPublication = participant.getTrackPublication(Track.Source.ScreenShare);
  const cameraTrack = cameraPublication?.videoTrack;
  const screenTrack = screenPublication?.videoTrack;
  const cameraOn = Boolean(cameraPublication) && !cameraPublication?.isMuted && Boolean(cameraTrack);
  const microphoneOn = Boolean(microphonePublication) && !microphonePublication?.isMuted;
  const sharingScreen = Boolean(screenPublication) && !screenPublication?.isMuted && Boolean(screenTrack);
  const name = participant.name || participant.identity;

  // Prefer the shared screen, then the camera, for the visible track.
  const displayTrack = sharingScreen ? screenTrack : cameraOn ? cameraTrack : undefined;

  const tile: ParticipantTileView = {
    id: participant.identity,
    name: self ? "Вы" : name,
    initials: initialsFor(name),
    color: colorFor(participant.identity),
    camera: cameraOn ? "on" : "off",
    mic: microphoneOn ? "on" : "off",
    speaking: speakingIds.has(participant.identity),
    sharingScreen,
    quality: qualityFrom(participant.connectionQuality),
    self
  };

  if (displayTrack) {
    tile.attachVideo = (element) => {
      if (element) displayTrack.attach(element);
      else displayTrack.detach();
    };
  }

  return tile;
}

function buildStage(room: Room): CallStageView {
  const speakingIds = new Set(room.activeSpeakers.map((participant) => participant.identity));
  const participants: ParticipantTileView[] = [];
  for (const participant of room.remoteParticipants.values()) {
    participants.push(tileFor(participant, false, speakingIds));
  }
  participants.push(tileFor(room.localParticipant, true, speakingIds));
  return { phase: phaseFromConnectionState(room.state), participants };
}

export type CallEngineState = {
  stage: CallStageView;
  controls: CallLocalControls;
  handlers: CallControlHandlers;
  error: string | null;
  chat: MessageView[];
  sendChat: (text: string) => void;
};

export function useCallEngine(roomId: string, options?: LobbySelection | null): CallEngineState {
  const roomRef = useRef<Room | null>(null);
  const [stage, setStage] = useState<CallStageView>({ phase: "idle", participants: [] });
  const [controls, setControls] = useState<CallLocalControls>({ micOn: false, cameraOn: false });
  const [error, setError] = useState<string | null>(null);
  const [chat, setChat] = useState<MessageView[]>([]);

  const refresh = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    setStage(buildStage(room));
    setControls({
      micOn: room.localParticipant.isMicrophoneEnabled,
      cameraOn: room.localParticipant.isCameraEnabled,
      screenShareOn: room.localParticipant.isScreenShareEnabled
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      ...(options?.videoDeviceId ? { videoCaptureDefaults: { deviceId: options.videoDeviceId } } : {}),
      ...(options?.audioDeviceId ? { audioCaptureDefaults: { deviceId: options.audioDeviceId } } : {})
    });
    roomRef.current = room;

    const onChange = () => {
      if (!disposed) refresh();
    };
    room
      .on(RoomEvent.ParticipantConnected, onChange)
      .on(RoomEvent.ParticipantDisconnected, onChange)
      .on(RoomEvent.TrackSubscribed, onChange)
      .on(RoomEvent.TrackUnsubscribed, onChange)
      .on(RoomEvent.TrackMuted, onChange)
      .on(RoomEvent.TrackUnmuted, onChange)
      .on(RoomEvent.LocalTrackPublished, onChange)
      .on(RoomEvent.LocalTrackUnpublished, onChange)
      .on(RoomEvent.ActiveSpeakersChanged, onChange)
      .on(RoomEvent.ConnectionQualityChanged, onChange)
      .on(RoomEvent.ConnectionStateChanged, onChange)
      .on(RoomEvent.Disconnected, onChange);

    room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
      if (disposed || topic !== CHAT_TOPIC) return;
      try {
        const data = JSON.parse(new TextDecoder().decode(payload)) as {
          kind?: string;
          clientId?: string;
          body?: string;
          time?: string;
        };
        if (data.kind !== "chat") return;
        const identity = participant?.identity ?? "remote";
        const name = participant?.name || identity;
        setChat((previous) => [
          ...previous,
          {
            id: data.clientId ?? `${identity}-${previous.length}`,
            authorName: name,
            authorInitials: initialsFor(name),
            authorColor: colorFor(identity),
            time: data.time ?? "",
            text: String(data.body ?? "")
          }
        ]);
      } catch {
        // ignore malformed chat packets
      }
    });

    void (async () => {
      try {
        const session = await startCallSession(roomId);
        const join = await fetchJoinToken(roomId, session.id);
        if (join.provider !== "livekit" || !join.token) {
          throw new Error("video_provider_unavailable");
        }
        if (disposed) return;
        await room.connect(join.joinUrl, join.token);
        if (disposed) return;
        await room.localParticipant.setMicrophoneEnabled(options?.micOn ?? true);
        await room.localParticipant.setCameraEnabled(options?.cameraOn ?? true);
        refresh();
      } catch (cause) {
        if (disposed) return;
        setError(cause instanceof Error ? cause.message : "call_failed");
        setStage((previous) => ({ ...previous, phase: "error" }));
      }
    })();

    return () => {
      disposed = true;
      room.removeAllListeners();
      void room.disconnect();
      roomRef.current = null;
    };
  }, [roomId, refresh, options]);

  const handlers = useMemo<CallControlHandlers>(
    () => ({
      onToggleMic: () => {
        const room = roomRef.current;
        if (!room) return;
        void room.localParticipant
          .setMicrophoneEnabled(!room.localParticipant.isMicrophoneEnabled)
          .then(refresh);
      },
      onToggleCamera: () => {
        const room = roomRef.current;
        if (!room) return;
        void room.localParticipant
          .setCameraEnabled(!room.localParticipant.isCameraEnabled)
          .then(refresh);
      },
      onToggleScreenShare: () => {
        const room = roomRef.current;
        if (!room) return;
        void room.localParticipant
          .setScreenShareEnabled(!room.localParticipant.isScreenShareEnabled)
          .then(refresh);
      },
      onLeave: () => {
        void roomRef.current?.disconnect();
      }
    }),
    [refresh]
  );

  const sendChat = useCallback((text: string) => {
    const room = roomRef.current;
    const body = text.trim();
    if (!room || !body) return;
    const clientId = crypto.randomUUID();
    const time = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    setChat((previous) => [
      ...previous,
      { id: clientId, authorName: "Вы", authorInitials: "Я", authorColor: "c5", time, text: body, own: true }
    ]);
    const packet = new TextEncoder().encode(JSON.stringify({ kind: "chat", clientId, body, time }));
    void room.localParticipant.publishData(packet, { reliable: true, topic: CHAT_TOPIC });
  }, []);

  return { stage, controls, handlers, error, chat, sendChat };
}
