"use client";

import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type Participant
} from "livekit-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchJoinToken, startCallSession } from "@/lib/call/call-client";
import type {
  CallControlHandlers,
  CallLocalControls,
  CallPhase,
  CallStageView,
  ParticipantTileView
} from "@/lib/call/types";

// The ONLY module that imports `livekit-client`. It maps the imperative Room state
// into the serialisable view-model the pure widgets render. The route loads this
// via next/dynamic({ ssr: false }) so the SDK never reaches SSR or Storybook.

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

function tileFor(participant: Participant, self: boolean, speakingIds: Set<string>): ParticipantTileView {
  const cameraPublication = participant.getTrackPublication(Track.Source.Camera);
  const microphonePublication = participant.getTrackPublication(Track.Source.Microphone);
  const videoTrack = cameraPublication?.videoTrack;
  const cameraOn = Boolean(cameraPublication) && !cameraPublication?.isMuted && Boolean(videoTrack);
  const microphoneOn = Boolean(microphonePublication) && !microphonePublication?.isMuted;
  const name = participant.name || participant.identity;

  const tile: ParticipantTileView = {
    id: participant.identity,
    name: self ? "Вы" : name,
    initials: initialsFor(name),
    color: colorFor(participant.identity),
    camera: cameraOn ? "on" : "off",
    mic: microphoneOn ? "on" : "off",
    speaking: speakingIds.has(participant.identity),
    self
  };

  if (cameraOn && videoTrack) {
    tile.attachVideo = (element) => {
      if (element) videoTrack.attach(element);
      else videoTrack.detach();
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
};

export function useCallEngine(roomId: string): CallEngineState {
  const roomRef = useRef<Room | null>(null);
  const [stage, setStage] = useState<CallStageView>({ phase: "idle", participants: [] });
  const [controls, setControls] = useState<CallLocalControls>({ micOn: false, cameraOn: false });
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    setStage(buildStage(room));
    setControls({
      micOn: room.localParticipant.isMicrophoneEnabled,
      cameraOn: room.localParticipant.isCameraEnabled
    });
  }, []);

  useEffect(() => {
    let disposed = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
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
      .on(RoomEvent.ConnectionStateChanged, onChange)
      .on(RoomEvent.Disconnected, onChange);

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
        await room.localParticipant.enableCameraAndMicrophone();
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
  }, [roomId, refresh]);

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
      onLeave: () => {
        void roomRef.current?.disconnect();
      }
    }),
    [refresh]
  );

  return { stage, controls, handlers, error };
}
