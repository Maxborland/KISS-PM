"use client";

import {
  ConnectionQuality,
  ConnectionState,
  LocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteTrack
} from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MessageView } from "@/components/domain/message-bubble";
import { CallBackgroundController, backgroundProcessorsSupported } from "@/lib/call/call-background";
import {
  endCallSession,
  fetchCallRoomEntity,
  fetchJoinToken,
  fetchTurnCredentials,
  persistCallMessage,
  postParticipantState,
  resolveEntityConversationId,
  startCallSession
} from "@/lib/call/call-client";
import type {
  BackgroundMode,
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
    tile.videoTrackId = displayTrack.sid;
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
  const backgroundRef = useRef<CallBackgroundController | null>(null);
  if (!backgroundRef.current) {
    backgroundRef.current = new CallBackgroundController();
  }
  const [background, setBackground] = useState<BackgroundMode>("none");
  const backgroundSupported = useMemo(() => backgroundProcessorsSupported(), []);
  const conversationIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  // Remote audio is attached to detached <audio> elements the engine owns (the tile only
  // renders video); kept here so they are removed on teardown.
  const audioElementsRef = useRef<HTMLMediaElement[]>([]);
  // In-call messages sent before the durable conversation resolves are queued, then flushed.
  const pendingMessagesRef = useRef<string[]>([]);

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
      // Publishing optimization: VP9 SVC with a VP8 backup for older browsers,
      // simulcast layers for adaptiveStream/dynacast, DTX + RED for resilient audio.
      // (AV1 stays opt-in behind a future flag — higher encode cost.)
      publishDefaults: {
        simulcast: true,
        videoCodec: "vp9",
        backupCodec: { codec: "vp8" },
        dtx: true,
        red: true
      },
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

    const bindBackground = () => {
      if (disposed) return;
      const cameraTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
      void backgroundRef.current?.bind(
        cameraTrack instanceof LocalVideoTrack ? cameraTrack : null
      );
    };
    room
      .on(RoomEvent.LocalTrackPublished, bindBackground)
      .on(RoomEvent.LocalTrackUnpublished, bindBackground);

    // Play remote audio: the participant tile renders only video, so subscribed audio tracks
    // are attached to engine-owned hidden <audio> elements — without this, calls have no sound.
    const onAudioSubscribed = (track: RemoteTrack) => {
      if (disposed || track.kind !== Track.Kind.Audio) return;
      const element = track.attach();
      element.style.display = "none";
      document.body.appendChild(element);
      audioElementsRef.current.push(element);
    };
    const onAudioUnsubscribed = (track: RemoteTrack) => {
      if (track.kind !== Track.Kind.Audio) return;
      for (const element of track.detach()) {
        audioElementsRef.current = audioElementsRef.current.filter((existing) => existing !== element);
        element.remove();
      }
    };
    room
      .on(RoomEvent.TrackSubscribed, onAudioSubscribed)
      .on(RoomEvent.TrackUnsubscribed, onAudioUnsubscribed);

    void (async () => {
      try {
        const session = await startCallSession(roomId);
        sessionIdRef.current = session.id;
        const [join, turn] = await Promise.all([
          fetchJoinToken(roomId, session.id),
          fetchTurnCredentials(roomId, session.id)
        ]);
        if (join.provider !== "livekit" || !join.token) {
          throw new Error("video_provider_unavailable");
        }
        if (disposed) return;
        // TURN relay for symmetric-NAT / restrictive networks; falls back to STUN/host.
        const iceServers = turn
          ? [{ urls: turn.urls, username: turn.username, credential: turn.credential }]
          : undefined;
        await room.connect(
          join.joinUrl,
          join.token,
          iceServers ? { rtcConfig: { iceServers } } : undefined
        );
        if (disposed) return;
        await room.localParticipant.setMicrophoneEnabled(options?.micOn ?? true);
        await room.localParticipant.setCameraEnabled(options?.cameraOn ?? true);
        // Unblock playback of subscribed remote audio (the lobby join is the user gesture).
        void room.startAudio();
        refresh();
        // Record presence so the call shows up in occupancy (the recipe is connect → state).
        void postParticipantState(roomId, session.id, "joined");
        // Resolve the durable conversation for the room's parent entity (best-effort).
        const entity = await fetchCallRoomEntity(roomId);
        if (entity && !disposed) {
          conversationIdRef.current = await resolveEntityConversationId(
            entity.entityType,
            entity.entityId
          );
          // Flush any in-call messages queued before the conversation id resolved.
          const conversationId = conversationIdRef.current;
          if (conversationId && pendingMessagesRef.current.length > 0) {
            const queued = pendingMessagesRef.current;
            pendingMessagesRef.current = [];
            for (const queuedBody of queued) {
              void persistCallMessage(conversationId, queuedBody).catch(() => undefined);
            }
          }
        }
      } catch (cause) {
        if (disposed) return;
        // Initial media setup failed (e.g. the camera publish rejected) — do not leave a
        // connected room with a hot mic; disconnect before surfacing the error.
        void room.disconnect();
        setError(cause instanceof Error ? cause.message : "call_failed");
        setStage((previous) => ({ ...previous, phase: "error" }));
      }
    })();

    return () => {
      disposed = true;
      room.removeAllListeners();
      void room.disconnect();
      void backgroundRef.current?.dispose();
      for (const element of audioElementsRef.current) element.remove();
      audioElementsRef.current = [];
      pendingMessagesRef.current = [];
      conversationIdRef.current = null;
      sessionIdRef.current = null;
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
        const sessionId = sessionIdRef.current;
        if (sessionId) {
          // Mark presence and close the backend session — otherwise the room stays active
          // and call_room_already_active blocks the next call until something reconciles it.
          void postParticipantState(roomId, sessionId, "left");
          void endCallSession(roomId, sessionId);
          sessionIdRef.current = null;
        }
        void roomRef.current?.disconnect();
      }
    }),
    [refresh, roomId]
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
    // Durable persistence to the entity conversation (best-effort; ephemeral path is
    // authoritative for delivery). Queue until the conversation id resolves so a message sent
    // right after connect is not dropped from the durable transcript.
    const conversationId = conversationIdRef.current;
    if (conversationId) void persistCallMessage(conversationId, body).catch(() => undefined);
    else pendingMessagesRef.current.push(body);
  }, []);

  const onCycleBackground = useCallback(() => {
    const order: BackgroundMode[] = ["none", "blur", "image"];
    const next = order[(order.indexOf(background) + 1) % order.length] ?? "none";
    setBackground(next);
    void backgroundRef.current?.setMode(next).then((applied) => {
      if (applied !== next) setBackground(applied);
    });
  }, [background]);

  return {
    stage,
    controls: { ...controls, background, backgroundSupported },
    handlers: { ...handlers, onCycleBackground },
    error,
    chat,
    sendChat
  };
}
